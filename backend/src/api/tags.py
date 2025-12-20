# 任务：提供标签列表接口供前端筛选
# 方案：返回所有标签名去重列表

from src.core.db import session_scope
from src.core.auth import get_current_user, require_role
from src.models.tag import Tag


def list_tags():
    with session_scope() as session:
        current = get_current_user(session)
        require_role(current, ["user", "admin"])

        tags = session.query(Tag.name).order_by(Tag.name.asc()).all()
        return {"items": [row[0] for row in tags]}
