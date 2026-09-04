from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.settings_service import get_all_settings, set_setting
from app.services.security import require_admin, get_current_user

router = APIRouter()


class UpdateSettingRequest(BaseModel):
    value: float


@router.get("/api/settings")
def list_settings(_auth=Depends(get_current_user), db: Session = Depends(get_db)):
    return get_all_settings(db)


@router.put("/api/settings/{key}")
def update_setting(key: str, payload: UpdateSettingRequest, _admin=Depends(require_admin), db: Session = Depends(get_db)):
    try:
        new_value = set_setting(db, key, payload.value)
    except KeyError:
        raise HTTPException(status_code=404, detail="Unknown setting")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"key": key, "value": new_value}
