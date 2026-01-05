# 任务：提供“帮我找图”检索接口
# 方案：读取标签库 -> 调用 AI 选择标签 -> 按重合度排序查询图片 -> 返回前 5 张与 AI 输出

from connexion import request
from sqlalchemy import func, distinct

from src.core.auth import get_current_user, require_role
from src.core.db import session_scope
from src.core.config_loader import get_config
from src.core.errors import ApiError, ERROR_VALIDATION
from src.models.image import Image as ImageModel
from src.models.tag import Tag
from src.services.ai_search_service import generate_search_tags
from src.services.serializers import serialize_image_summary
from src.services.tag_service import list_all_tag_names


def _build_public_image_url(image) -> str:
    # 任务：为检索结果拼出可访问的图片外链
    # 方案：优先使用配置的 public_base_url，否则使用当前请求 host 作为前缀
    cfg = get_config()
    base_url = (cfg.get("links", {}) or {}).get("public_base_url", "") or ""
    if base_url:
        prefix = base_url.rstrip("/")
    else:
        prefix = str(request.base_url).rstrip("/")
    return f"{prefix}/images/{image.storage_relpath}"


def _query_images_by_tags(session, tags: list, limit: int = 5):
    # 任务：按标签重合度检索图片并排序
    # 方案：统计匹配标签数量，主按重合数降序、次按 id 降序并限制数量
    if not tags:
        return []

    match_count = func.count(distinct(Tag.id)).label("match_count")
    query = (
        session.query(ImageModel, match_count)
        .join(ImageModel.tags)
        .filter(ImageModel.is_deleted.is_(False), Tag.name.in_(tags))
        .group_by(ImageModel.id)
        .order_by(match_count.desc(), ImageModel.id.desc())
    )
    rows = query.limit(limit).all()

    items = []
    for image, _count in rows:
        summary = serialize_image_summary(session, image)
        if not summary:
            continue
        items.append({**summary, "public_url": _build_public_image_url(image)})
    return items


def search(body: dict):
    payload = body or {}
    query = str(payload.get("query") or "").strip()
    if not query:
        raise ApiError(400, ERROR_VALIDATION, "query is required")

    with session_scope() as session:
        current = get_current_user(session)
        require_role(current, ["user", "admin"])

        tag_pool = list_all_tag_names(session)
        ai_output, selected_tags = generate_search_tags(tag_pool, query)
        items = _query_images_by_tags(session, selected_tags, limit=5)

        return {
            "query": query,
            "tags": selected_tags,
            "ai_output": ai_output,
            "items": items,
        }
