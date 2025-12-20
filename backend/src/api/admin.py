# 任务：管理员审批与角色管理接口
# 方案：限制 admin 角色访问，并进行分页查询

from connexion import request

from src.core.db import session_scope
from src.core.auth import get_current_user, require_role
from src.core.config_loader import get_config
from src.core.errors import ApiError, ERROR_NOT_FOUND, ERROR_VALIDATION
from src.models.user import User
from src.services.serializers import serialize_user


def list_users(role: str = None, page: int = 1, page_size: int = None):
    with session_scope() as session:
        current = get_current_user(session)
        require_role(current, ["admin"])

        cfg = get_config()
        max_size = cfg.get("pagination", {}).get("page_size", 20)
        size = page_size or max_size
        size = min(size, max_size)
        offset = (page - 1) * size

        query = session.query(User)
        if role:
            query = query.filter(User.role == role)
        total = query.count()
        items = query.order_by(User.created_at.desc()).offset(offset).limit(size).all()

        return {
            "page": page,
            "page_size": size,
            "total": total,
            "items": [serialize_user(item) for item in items],
        }


def approve_user(user_id: int):
    with session_scope() as session:
        current = get_current_user(session)
        require_role(current, ["admin"])

        user = session.get(User, user_id)
        if not user:
            raise ApiError(404, ERROR_NOT_FOUND, "user not found")
        if user.role != "pending":
            raise ApiError(400, ERROR_VALIDATION, "user not pending")
        user.role = "user"
        return serialize_user(user)


def set_role(user_id: int):
    payload = request.get_json(silent=True) or {}
    role = payload.get("role")
    if role not in ["user", "admin"]:
        raise ApiError(400, ERROR_VALIDATION, "invalid role")

    with session_scope() as session:
        current = get_current_user(session)
        require_role(current, ["admin"])

        user = session.get(User, user_id)
        if not user:
            raise ApiError(404, ERROR_NOT_FOUND, "user not found")
        user.role = role
        return serialize_user(user)
