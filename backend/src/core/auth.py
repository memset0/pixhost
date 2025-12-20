# 任务：解析请求中的 JWT 并加载当前用户
# 方案：优先读取 Authorization 头，必要时支持 query token

from typing import List
from connexion import request

from src.core.errors import ApiError, ERROR_UNAUTHORIZED, ERROR_FORBIDDEN
from src.models.user import User
from src.services.auth_service import decode_access_token


def _extract_token(allow_query: bool) -> str:
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header.split(" ", 1)[1].strip()
    if allow_query:
        return request.args.get("token", "")
    return ""


def get_current_user(session, allow_query_token: bool = False) -> User:
    token = _extract_token(allow_query_token)
    if not token:
        raise ApiError(401, ERROR_UNAUTHORIZED, "missing token")
    payload = decode_access_token(token)
    user_id = int(payload.get("sub"))
    user = session.get(User, user_id)
    if not user or not user.is_active:
        raise ApiError(401, ERROR_UNAUTHORIZED, "user inactive")
    return user


def require_role(user: User, roles: List[str]):
    if user.role not in roles:
        raise ApiError(403, ERROR_FORBIDDEN, "insufficient role")


def require_owner(user: User, image):
    # 任务：限制编辑/删除只能操作自己上传的图片
    # 方案：比对 uploader_id 与当前用户 id，不匹配即拒绝
    if image.uploader_id != user.id:
        raise ApiError(403, ERROR_FORBIDDEN, "only owner can modify")
