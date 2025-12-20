# 任务：实现密码加密与 JWT 生成/解析
# 方案：bcrypt 哈希密码，PyJWT 签发/验证 token

from datetime import datetime, timedelta
import jwt
import bcrypt

from src.core.config_loader import get_config
from src.core.errors import ApiError, ERROR_UNAUTHORIZED


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: int, role: str) -> tuple[str, int]:
    cfg = get_config()
    secret = cfg.get("security", {}).get("jwt_secret")
    exp_minutes = cfg.get("security", {}).get("jwt_exp_minutes", 120)
    if not secret:
        raise RuntimeError("security.jwt_secret missing in config.yaml")
    exp = datetime.utcnow() + timedelta(minutes=exp_minutes)
    payload = {"sub": str(user_id), "role": role, "exp": exp}
    token = jwt.encode(payload, secret, algorithm="HS256")
    return token, exp_minutes * 60


def decode_access_token(token: str) -> dict:
    # 任务：将无效 token 转换为统一 401 错误
    # 方案：捕获 jwt 异常并抛出 ApiError（必要的异常转换）
    cfg = get_config()
    secret = cfg.get("security", {}).get("jwt_secret")
    if not secret:
        raise RuntimeError("security.jwt_secret missing in config.yaml")
    try:
        return jwt.decode(token, secret, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise ApiError(401, ERROR_UNAUTHORIZED, "invalid token") from exc
