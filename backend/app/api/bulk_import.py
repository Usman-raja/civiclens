import json
import os
import zipfile

import cv2
import numpy as np
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.participant import Participant
from app.models.face_embedding import FaceEmbedding
from app.services.face_engine import detect_faces, cosine_similarity
from app.services.quality_engine import assess_quality
from app.services.tabular import read_table
from app.config import REGISTERED_DIR
from app.services.security import require_admin, get_current_user

router = APIRouter()

DUPLICATE_THRESHOLD = 0.5
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp"}
PREVIEW_ROWS = 5

# CivicLens import fields -> header aliases for auto-detection. External
# exports (NADRA, HR spreadsheets, …) name these columns differently, so the
# UI also lets the user map columns explicitly.
FIELD_ALIASES = {
    "name": ["name", "full name", "family member", "person name", "candidate name",
             "applicant name", "member name", "citizen name", "employee name",
             "staff name", "customer name", "student name", "owner name",
             "license holder", "subject"],
    "image": ["image", "image filename", "image file", "photo", "photo filename",
              "photo file", "picture", "picture filename", "filename", "file"],
    "external_id": ["cnic", "cnic no", "cnic number", "nic", "nic no", "nic number",
                    "id", "id no", "id number", "id card", "id card no",
                    "registration no", "registration number", "employee id",
                    "employee no", "student id", "roll no", "roll number"],
    "phone": ["phone", "phone no", "phone number", "mobile", "mobile no",
              "mobile number", "cell", "cell no", "contact", "contact no",
              "contact number", "whatsapp"],
    "address": ["address", "residence", "home address", "mailing address",
                "permanent address", "street", "street address"],
    "notes": ["notes", "note", "remarks", "remark", "description", "comments",
              "comment", "details"],
}

SUPPORTED_FIELDS = list(FIELD_ALIASES.keys())
REQUIRED_FIELDS = ["name", "image"]


def _load_existing_embeddings(db: Session):
    rows = db.query(FaceEmbedding).all()
    return [(row.person_id, np.array(json.loads(row.embedding), dtype=np.float32)) for row in rows]


def _name_from_filename(filename: str) -> str:
    stem = os.path.splitext(os.path.basename(filename))[0]
    return stem.replace("_", " ").strip()


def _extract_zip_images(zip_bytes: bytes):
    images = {}
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        for info in zf.infolist():
            if info.is_dir():
                continue
            ext = os.path.splitext(info.filename)[1].lower()
            if ext not in IMAGE_EXTENSIONS:
                continue
            images[os.path.basename(info.filename)] = zf.read(info.filename)
    return images


def _read_table(table_bytes: bytes, filename: str):
    return read_table(table_bytes, filename)


def _suggest_mapping(headers):
    """Best-guess CivicLens field -> column for arbitrary external exports."""
    normalized = {h.strip().lower(): h for h in headers}
    mapping = {}
    for field, aliases in FIELD_ALIASES.items():
        for alias in aliases:
            if alias in normalized:
                mapping[field] = normalized[alias]
                break

    # Substring fallback for headers like "Employee Name" or "CNIC Number"
    # that the exact alias list missed. Skip columns another field already
    # claimed, and for the name field skip anything file/image-flavored.
    for field, aliases in FIELD_ALIASES.items():
        if field in mapping:
            continue
        taken = set(mapping.values())
        for header in headers:
            if header in taken:
                continue
            lowered = header.strip().lower()
            if field == "name" and any(tag in lowered for tag in ("file", "image", "photo", "picture", "path", "cnic", "nic")):
                continue
            if any(alias in lowered for alias in aliases):
                mapping[field] = header
                break
    return mapping


def _resolve_mapping(headers, column_mapping):
    """Merge user-selected mapping with auto-detection; validate column names."""
    by_lower = {h.strip().lower(): h for h in headers}
    resolved = {}
    for field in SUPPORTED_FIELDS:
        chosen = (column_mapping or {}).get(field)
        if not chosen:
            continue
        if chosen not in headers and chosen.strip().lower() in by_lower:
            chosen = by_lower[chosen.strip().lower()]
        if chosen not in headers:
            raise HTTPException(status_code=400,
                                detail=f"Column '{chosen}' mapped to '{field}' does not exist in the file")
        resolved[field] = chosen
    for field, col in _suggest_mapping(headers).items():
        resolved.setdefault(field, col)
    return resolved


@router.post("/api/participants/bulk-import/inspect")
async def inspect_import_file(
    mapping_file: UploadFile = File(...),
    _auth = Depends(require_admin)):
    """Read an external data file (CSV/XLSX) and report its columns, a preview
    of the first rows, and a suggested column mapping — so the UI can let the
    user confirm or adjust which column means what before importing."""
    table_bytes = await mapping_file.read()
    headers, table = _read_table(table_bytes, mapping_file.filename)

    return {
        "filename": mapping_file.filename,
        "columns": headers,
        "row_count": len(table),
        "preview_rows": table[:PREVIEW_ROWS],
        "suggested_mapping": _suggest_mapping(headers),
        "supported_fields": SUPPORTED_FIELDS,
        "required_fields": REQUIRED_FIELDS,
    }


@router.post("/api/participants/bulk-import")
async def bulk_import_participants(
    zip_file: UploadFile = File(...),
    mapping_file: UploadFile = File(None),
    column_mapping: str = Form(""),
    source: str = Form(""),
    dry_run: bool = Form(True),
    db: Session = Depends(get_db), _auth = Depends(require_admin)):
    zip_bytes = await zip_file.read()
    try:
        images = _extract_zip_images(zip_bytes)
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid ZIP archive")

    if not images:
        raise HTTPException(status_code=400, detail="No supported image files found in ZIP")

    if column_mapping:
        try:
            column_mapping = json.loads(column_mapping)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="column_mapping must be valid JSON")
    else:
        column_mapping = None

    unmatched = []
    resolved = []
    if mapping_file is not None:
        mapping_bytes = await mapping_file.read()
        headers, table = _read_table(mapping_bytes, mapping_file.filename)
        mapping = _resolve_mapping(headers, column_mapping)

        name_col = mapping.get("name")
        image_col = mapping.get("image")
        if not name_col or not image_col:
            raise HTTPException(status_code=400,
                                detail="Could not determine name and image columns — map them explicitly")

        for row in table:
            name = row.get(name_col, "").strip()
            image_filename = row.get(image_col, "").strip()
            if not name or not image_filename:
                continue
            image_bytes = images.get(image_filename) or images.get(os.path.basename(image_filename))
            if image_bytes is None:
                unmatched.append({"name": name, "image": image_filename})
            else:
                extra = {}
                for field in ("external_id", "phone", "address", "notes"):
                    col = mapping.get(field)
                    if col and row.get(col, "").strip():
                        extra[field] = row[col].strip()
                resolved.append((name, image_filename, image_bytes, extra))
    else:
        resolved = [(_name_from_filename(fname), fname, data, {}) for fname, data in images.items()]

    existing_count = db.query(Participant).count()
    known_embeddings = _load_existing_embeddings(db)

    registered, duplicates, no_face, multiple_faces = [], [], [], []
    low_quality, errors = [], []
    pending_commits = []

    for name, image_filename, image_bytes, extra in resolved:
        try:
            np_arr = np.frombuffer(image_bytes, np.uint8)
            image_bgr = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            if image_bgr is None:
                errors.append({"image": image_filename, "name": name, "error": "Could not decode image"})
                continue

            quality_issue = assess_quality(image_bgr)
            if quality_issue:
                low_quality.append({"image": image_filename, "name": name, "reason": quality_issue})
                continue

            faces = detect_faces(image_bgr)
            if len(faces) == 0:
                no_face.append({"image": image_filename, "name": name})
                continue
            if len(faces) > 1:
                multiple_faces.append({"image": image_filename, "name": name, "faces_detected": len(faces)})
                continue

            embedding = faces[0].embedding

            dup_found = None
            for pid, known_emb in known_embeddings:
                score = cosine_similarity(embedding, known_emb)
                if score >= DUPLICATE_THRESHOLD:
                    dup_found = (pid, score)
                    break
            if dup_found:
                duplicates.append({"image": image_filename, "name": name,
                                    "matched_person_id": dup_found[0], "similarity": round(float(dup_found[1]), 3)})
                continue

            person_id = f"P{existing_count + len(registered) + 1:03d}"
            registered.append({"person_id": person_id, "name": name, "image": image_filename, **extra})
            known_embeddings.append((person_id, embedding))  # dedupe against this within the same batch too
            pending_commits.append((person_id, name, embedding, image_bgr, extra))

        except Exception as exc:
            errors.append({"image": image_filename, "name": name, "error": str(exc)})

    if not dry_run:
        os.makedirs(REGISTERED_DIR, exist_ok=True)
        for person_id, name, embedding, image_bgr, extra in pending_commits:
            image_path = os.path.join(REGISTERED_DIR, f"{person_id}.jpg")
            cv2.imwrite(image_path, image_bgr)
            db.add(Participant(person_id=person_id, name=name, registered_face_image_path=image_path,
                               current_score=5,
                               external_id=extra.get("external_id"),
                               phone=extra.get("phone"),
                               address=extra.get("address"),
                               notes=extra.get("notes"),
                               source=source or None))
            db.add(FaceEmbedding(person_id=person_id, embedding=json.dumps(embedding.tolist()), model_name="buffalo_l"))
        db.commit()

    return {
        "dry_run": dry_run,
        "source": source or None,
        "registered": registered,
        "duplicates_skipped": duplicates,
        "no_face": no_face,
        "multiple_faces": multiple_faces,
        "low_quality": low_quality,
        "errors": errors,
        "unmatched_mapping_rows": unmatched,
    }
