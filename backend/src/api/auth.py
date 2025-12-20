# 任务：实现注册与登录接口
# 方案：校验输入、保存 pending 用户，并签发 JWT

import re
from datetime import datetime
from connexion import request

from src.core.db import session_scope
from src.core.errors import ApiError, ERROR_VALIDATION, ERROR_CONFLICT, ERROR_UNAUTHORIZED
from src.models.user import User
from src.services.auth_service import hash_password, verify_password, create_access_token


_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _validate_register(data):
    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    if not username:
        raise ApiError(400, ERROR_VALIDATION, "username required")
    if not email or not _EMAIL_RE.match(email):
        raise ApiError(400, ERROR_VALIDATION, "email format invalid")
    if len(password.encode("utf-8")) < 6:
        raise ApiError(400, ERROR_VALIDATION, "password too short")
    return username, email, password


def register():
    payload = request.get_json(silent=True) or {}
    username, email, password = _validate_register(payload)

    with session_scope() as session:
        if session.query(User).filter(User.username == username).first():
            raise ApiError(409, ERROR_CONFLICT, "username already exists")
        if session.query(User).filter(User.email == email).first():
            raise ApiError(409, ERROR_CONFLICT, "email already exists")

        user = User(
            username=username,
            email=email,
            password_hash=hash_password(password),
            role="pending",
            created_at=datetime.utcnow(),
            is_active=True,
        )
        session.add(user)
        session.flush()
        return {"id": user.id, "role": user.role}


def login():
    payload = request.get_json(silent=True) or {}
    username = (payload.get("username") or "").strip()
    password = payload.get("password") or ""

    with session_scope() as session:
        user = session.query(User).filter(User.username == username).first()
        if not user or not verify_password(password, user.password_hash):
            raise ApiError(401, ERROR_UNAUTHORIZED, "invalid credentials")
        user.last_login_at = datetime.utcnow()
        token, expires_in = create_access_token(user.id, user.role)
        return {
            "access_token": token,
            "token_type": "Bearer",
            "expires_in": expires_in,
            "role": user.role,
        }
