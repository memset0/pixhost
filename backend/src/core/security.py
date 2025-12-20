# 任务：为 Connexion 提供 bearerAuth 的校验函数，消除缺失告警
# 方案：解码 JWT，返回用户标识；异常时抛出 ApiError 供中间件处理

from src.core.errors import ApiError, ERROR_UNAUTHORIZED
from src.services.auth_service import decode_access_token


def bearer_info(token: str, required_scopes=None):
    if not token:
        raise ApiError(401, ERROR_UNAUTHORIZED, "missing token")
    payload = decode_access_token(token)
    return {"sub": payload.get("sub"), "role": payload.get("role")}
