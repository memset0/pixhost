# 任务：提供图片上传、列表、详情、编辑、删除等接口
# 方案：按权限校验后操作数据库与磁盘文件

from datetime import datetime

from connexion import request
from flask import send_file
from sqlalchemy import func, distinct

from src.core.db import session_scope
from src.core.auth import get_current_user, require_role, require_owner
from src.core.config_loader import get_config
from src.core.errors import ApiError, ERROR_VALIDATION, ERROR_NOT_FOUND
from src.models.image import Image as ImageModel
from src.models.tag import Tag
from src.services.image_service import save_upload, parse_tag_string, get_image_or_404, find_or_create_tags
from src.services.serializers import serialize_image_summary, serialize_image_detail
from src.services.thumbnail_service import upsert_thumbnail
from src.services.edit_service import backup_original, after_edit
from src.utils.path_utils import resolve_path
from src.utils.image_ops import crop_image, adjust_hue


def list_images(page: int = 1, page_size: int = None, tags: str = None, tag_mode: str = "all", include_deleted: bool = False):
    with session_scope() as session:
        current = get_current_user(session)
        require_role(current, ["user", "admin"])

        cfg = get_config()
        max_size = cfg.get("pagination", {}).get("page_size", 20)
        size = page_size or max_size
        size = min(size, max_size)
        offset = (page - 1) * size

        query = session.query(ImageModel).order_by(ImageModel.created_at.desc())

        if not include_deleted or current.role != "admin":
            query = query.filter(ImageModel.is_deleted.is_(False))

        tag_list = parse_tag_string(tags)
        if tag_list:
            query = query.join(ImageModel.tags).filter(Tag.name.in_(tag_list))
            if tag_mode == "all":
                query = query.group_by(ImageModel.id).having(func.count(distinct(Tag.id)) == len(tag_list))
            else:
                query = query.distinct()

        total = query.count()
        items = query.offset(offset).limit(size).all()

        return {
            "page": page,
            "page_size": size,
            "total": total,
            "items": [serialize_image_summary(session, item) for item in items],
        }


def upload_image(file, tags: str = ""):
    with session_scope() as session:
        current = get_current_user(session)
        require_role(current, ["user", "admin"])

        content_length = int(request.headers.get("Content-Length", 0))
        image = save_upload(session, file, current, tags or "", content_length)

        auth_header = request.headers.get("Authorization", "")
        token = ""
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1].strip()

        return {
            "id": image.id,
            "view_url": f"/images/{image.id}",
            "api_url": f"/api/images/{image.id}",
            "file_url": f"/api/images/{image.id}/file",
            "file_url_with_token": f"/api/images/{image.id}/file?token={token}" if token else f"/api/images/{image.id}/file",
        }


def get_image(image_id: int):
    with session_scope() as session:
        current = get_current_user(session)
        require_role(current, ["user", "admin"])

        image = get_image_or_404(session, image_id)
        if image.is_deleted and image.uploader_id != current.id:
            raise ApiError(404, ERROR_NOT_FOUND, "image not found")
        return serialize_image_detail(image)


def get_file(image_id: int, token: str = None):
    with session_scope() as session:
        current = get_current_user(session, allow_query_token=True)
        require_role(current, ["user", "admin"])

        image = get_image_or_404(session, image_id)
        if image.is_deleted and image.uploader_id != current.id:
            raise ApiError(404, ERROR_NOT_FOUND, "image not found")

        cfg = get_config()
        file_path = resolve_path(cfg["storage"]["root_dir"]) / image.storage_relpath
        if not file_path.exists():
            raise ApiError(404, ERROR_NOT_FOUND, "file not found")
        return send_file(file_path)


def get_thumbnail(image_id: int):
    with session_scope() as session:
        current = get_current_user(session)
        require_role(current, ["user", "admin"])

        image = get_image_or_404(session, image_id)
        if image.is_deleted and image.uploader_id != current.id:
            raise ApiError(404, ERROR_NOT_FOUND, "image not found")
        data = upsert_thumbnail(session, image)
        return {"format": data["format"], "data_base64": data["data_base64"]}


def update_tags(image_id: int, body: dict):
    payload = body or {}
    tags = payload.get("tags")
    if not isinstance(tags, list):
        raise ApiError(400, ERROR_VALIDATION, "tags must be list")

    with session_scope() as session:
        current = get_current_user(session)
        require_role(current, ["user", "admin"])

        image = get_image_or_404(session, image_id)
        require_owner(current, image)

        image.tags = [tag for tag in image.tags if tag.source != "custom"]
        custom_tags = find_or_create_tags(session, [item.strip() for item in tags if item.strip()], "custom")
        image.tags.extend(custom_tags)
        return {"status": "ok"}


def edit_crop(image_id: int, body: dict):
    payload = body or {}
    ratios = {
        "top": float(payload.get("top", 0)),
        "bottom": float(payload.get("bottom", 0)),
        "left": float(payload.get("left", 0)),
        "right": float(payload.get("right", 0)),
    }
    for key, value in ratios.items():
        if value < 0 or value > 100:
            raise ApiError(400, ERROR_VALIDATION, f"{key} out of range")
    if ratios["left"] + ratios["right"] >= 100 or ratios["top"] + ratios["bottom"] >= 100:
        raise ApiError(400, ERROR_VALIDATION, "crop ratios too large")

    with session_scope() as session:
        current = get_current_user(session)
        require_role(current, ["user", "admin"])

        image = get_image_or_404(session, image_id)
        require_owner(current, image)

        backup_original(image)
        cfg = get_config()
        file_path = resolve_path(cfg["storage"]["root_dir"]) / image.storage_relpath
        crop_image(file_path, ratios)
        after_edit(session, image)
        return {"status": "ok"}


def edit_hue(image_id: int, body: dict):
    payload = body or {}
    delta = float(payload.get("delta", 0))
    if delta < -180 or delta > 180:
        raise ApiError(400, ERROR_VALIDATION, "delta out of range")

    with session_scope() as session:
        current = get_current_user(session)
        require_role(current, ["user", "admin"])

        image = get_image_or_404(session, image_id)
        require_owner(current, image)

        backup_original(image)
        cfg = get_config()
        file_path = resolve_path(cfg["storage"]["root_dir"]) / image.storage_relpath
        adjust_hue(file_path, delta)
        after_edit(session, image)
        return {"status": "ok"}


def delete_image(image_id: int):
    with session_scope() as session:
        current = get_current_user(session)
        require_role(current, ["user", "admin"])

        image = get_image_or_404(session, image_id)
        require_owner(current, image)

        image.is_deleted = True
        image.deleted_at = datetime.utcnow()
        return {"status": "ok"}


def restore_image(image_id: int):
    with session_scope() as session:
        current = get_current_user(session)
        require_role(current, ["user", "admin"])

        image = get_image_or_404(session, image_id)
        require_owner(current, image)

        image.is_deleted = False
        image.deleted_at = None
        return {"status": "ok"}
