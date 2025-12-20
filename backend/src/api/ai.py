# 任务：预留 AI 分析接口（暂不实现）
# 方案：先走鉴权再返回 501，便于后续接入真实实现

from src.core.auth import get_current_user, require_role
from src.core.db import session_scope


def analyze_image(image_id: int):
    with session_scope() as session:
        current = get_current_user(session)
        require_role(current, ["user", "admin"])
        return {"status": "not_implemented", "message": "ai analyze not implemented"}, 501


def analyze_status(image_id: int):
    with session_scope() as session:
        current = get_current_user(session)
        require_role(current, ["user", "admin"])
        return {"status": "not_implemented", "message": "ai analyze not implemented"}, 501
