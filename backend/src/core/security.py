# 任务：为 Connexion 提供 bearerAuth 的校验函数，消除缺失告警
# 方案：解码 JWT，返回用户标识；异常时抛出 ApiError 供中间件处理

from connexion import request

from src.core.errors import ApiError, ERROR_UNAUTHORIZED
from src.services.auth_service import decode_access_token


# 任务：仅在图片文件下载接口允许 query token，通过 JWT 直链访问文件
# 方案：校验路径是否匹配 /api/images/{id}/file，匹配时读取 token 参数，否则返回空字符串
def _extract_file_query_token() -> str:
    path = request.path or ""
    if not path.startswith("/api/images/") or not path.endswith("/file"):
        return ""
    return request.args.get("token", "") or ""


def bearer_info(token: str, required_scopes=None):
    if not token:
        token = _extract_file_query_token()
    if not token:
        raise ApiError(401, ERROR_UNAUTHORIZED, "missing token")
    payload = decode_access_token(token)
    return {"sub": payload.get("sub"), "role": payload.get("role")}
