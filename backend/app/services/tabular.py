"""Shared CSV/XLSX reader for bulk imports (participants, cameras, …)."""
import csv
import io

from fastapi import HTTPException

TABLE_EXTENSIONS = {".csv", ".xlsx", ".xls"}


def read_table(table_bytes: bytes, filename: str):
    """Read a CSV/XLSX into (headers, rows) where rows are dicts keyed by header."""
    import os

    ext = os.path.splitext(filename)[1].lower()
    if ext not in TABLE_EXTENSIONS:
        raise HTTPException(status_code=400,
                            detail=f"Unsupported file type '{ext}' — use .csv, .xlsx, or .xls")

    if ext == ".csv":
        text = table_bytes.decode("utf-8-sig", errors="ignore")
        reader = csv.reader(io.StringIO(text))
        rows = [row for row in reader if any(cell.strip() for cell in row)]
    else:
        from openpyxl import load_workbook
        wb = load_workbook(io.BytesIO(table_bytes), read_only=True, data_only=True)
        ws = wb.active
        rows = [[("" if cell is None else str(cell)) for cell in row] for row in ws.iter_rows(values_only=True)]
        rows = [row for row in rows if any(str(cell).strip() for cell in row)]

    if not rows:
        raise HTTPException(status_code=400, detail="File has no rows")

    headers = [str(h).strip() for h in rows[0]]
    table = []
    for row in rows[1:]:
        row = row + [""] * (len(headers) - len(row))
        table.append({headers[i]: str(row[i]).strip() for i in range(len(headers))})
    return headers, table
