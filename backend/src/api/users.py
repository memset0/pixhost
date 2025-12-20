# 任务：提供当前用户信息与修改密码功能
# 方案：从 JWT 解析用户并校验旧密码

from connexion import request

from src.core.db import session_scope
from src.core.auth import get_current_user
from src.core.errors import ApiError, ERROR_VALIDATION
from src.services.auth_service import verify_password, hash_password
from src.services.serializers import serialize_user


def me():
    with session_scope() as session:
        user = get_current_user(session)
        return serialize_user(user)


def change_password():
    payload = request.get_json(silent=True) or {}
    old_password = payload.get("old_password") or ""
    new_password = payload.get("new_password") or ""
    if len(new_password.encode("utf-8")) < 6:
        raise ApiError(400, ERROR_VALIDATION, "password too short")

    with session_scope() as session:
        user = get_current_user(session)
        if not verify_password(old_password, user.password_hash):
            raise ApiError(400, ERROR_VALIDATION, "old password incorrect")
        user.password_hash = hash_password(new_password)
        return {"status": "ok"}
