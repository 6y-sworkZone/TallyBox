from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.auth import create_access_token, verify_password, ACCESS_TOKEN_EXPIRE_MINUTES
from backend.app.database import get_db
from backend.app.models import Admin
from backend.app.schemas import LoginRequest, LoginResponse, AdminResponse

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    admin = db.query(Admin).filter(Admin.username == request.username).first()
    if not admin or not verify_password(request.password, admin.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误"
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": admin.username}, expires_delta=access_token_expires
    )
    
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        admin={"id": admin.id, "username": admin.username, "name": admin.name}
    )


@router.get("/me", response_model=AdminResponse)
def get_current_user(current_admin: Admin = Depends(lambda: None)):
    from backend.app.auth import get_current_admin
    return current_admin
