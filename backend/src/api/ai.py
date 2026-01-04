# 任务：为图片生成 AI 标签并查询最新状态
# 方案：接入 Qwen 接口生成标签，落库 source=ai，再返回结果

from src.core.auth import get_current_user, require_owner, require_role
from src.core.db import session_scope
from src.services.ai_tag_service import generate_ai_tags
from src.services.image_service import get_image_or_404


def analyze_image(image_id: int):
    with session_scope() as session:
        current = get_current_user(session)
        require_role(current, ["user", "admin"])

        image = get_image_or_404(session, image_id)
        require_owner(current, image)

        tags = generate_ai_tags(session, image)
        return {"tags": tags, "source": "ai"}


def analyze_status(image_id: int):
    with session_scope() as session:
        current = get_current_user(session)
        require_role(current, ["user", "admin"])

        image = get_image_or_404(session, image_id)
        require_owner(current, image)

        tags = [tag.name for tag in image.tags if tag.source == "ai"]
        return {"tags": tags, "source": "ai", "status": "ready"}
