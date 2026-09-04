from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.services.security import (
    hash_password, verify_password, create_access_token, get_current_user, require_admin,
)

router = APIRouter()


class BootstrapRequest(BaseModel):
    username: str
    password: str
    full_name: str = ""


class CreateUserRequest(BaseModel):
    username: str
    password: str
    full_name: str = ""
    role: str = "operator"


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


def _validate_password(password: str):
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")


@router.get("/api/auth/needs-bootstrap")
def needs_bootstrap(db: Session = Depends(get_db)):
    return {"needs_bootstrap": db.query(User).count() == 0}


@router.post("/api/auth/bootstrap")
def bootstrap_first_admin(payload: BootstrapRequest, db: Session = Depends(get_db)):
    if db.query(User).count() > 0:
        raise HTTPException(status_code=403, detail="Setup already complete. Ask an admin to create your account.")
    _validate_password(payload.password)
    user = User(username=payload.username.strip().lower(), full_name=payload.full_name,
                password_hash=hash_password(payload.password), role="admin", active=1)
    db.add(user)
    db.commit()
    return {"created": user.username, "role": "admin"}


@router.post("/api/auth/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username.strip().lower()).first()
    if user is None or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password",
                            headers={"WWW-Authenticate": "Bearer"})
    if not user.active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account has been deactivated.")
    user.last_login = datetime.utcnow()
    db.commit()
    token = create_access_token(user)
    return {"access_token": token, "token_type": "bearer",
            "user": {"username": user.username, "full_name": user.full_name, "role": user.role}}


@router.get("/api/auth/me")
def read_me(current_user: User = Depends(get_current_user)):
    return {"username": current_user.username, "full_name": current_user.full_name, "role": current_user.role}


@router.post("/api/auth/change-password")
def change_password(payload: ChangePasswordRequest, current_user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    _validate_password(payload.new_password)
    current_user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"changed": current_user.username}


@router.post("/api/auth/users")
def create_user(payload: CreateUserRequest, _admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    if payload.role not in ("admin", "operator"):
        raise HTTPException(status_code=400, detail="role must be 'admin' or 'operator'")
    _validate_password(payload.password)
    username = payload.username.strip().lower()
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=400, detail="That username is already taken.")
    user = User(username=username, full_name=payload.full_name,
                password_hash=hash_password(payload.password), role=payload.role, active=1)
    db.add(user)
    db.commit()
    return {"created": user.username, "role": user.role}


@router.get("/api/auth/users")
def list_users(_admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    users = db.query(User).all()
    return [{"id": u.id, "username": u.username, "full_name": u.full_name, "role": u.role,
             "active": bool(u.active), "last_login": u.last_login.isoformat() if u.last_login else None}
            for u in users]


@router.patch("/api/auth/users/{user_id}/deactivate")
def deactivate_user(user_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="You can't deactivate your own account while logged in.")
    user.active = 0
    db.commit()
    return {"user_id": user_id, "active": False}
