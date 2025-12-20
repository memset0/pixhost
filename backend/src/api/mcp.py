# 任务：预留 MCP 检索接口（暂不实现）
# 方案：先走鉴权再返回 501，后续可接入大模型

from src.core.auth import get_current_user, require_role
from src.core.db import session_scope


def search():
    with session_scope() as session:
        current = get_current_user(session)
        require_role(current, ["user", "admin"])
        return {"items": []}, 501
