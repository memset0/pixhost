# 任务：将 ORM 对象序列化为 OpenAPI 定义的响应结构
# 方案：针对列表与详情提供独立的序列化函数
import logging

from src.core.config_loader import get_config
from src.services.thumbnail_service import upsert_thumbnail
from src.utils.path_utils import resolve_path


def serialize_user(user):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
    }


def serialize_image_summary(session, image):
    cfg = get_config()
    image_path = resolve_path(cfg["storage"]["root_dir"]) / image.storage_relpath
    if not image_path.exists():
        logging.warning(
            "skip image without file: id=%s path=%s", image.id, image_path
        )
        return None

    thumb_data = upsert_thumbnail(session, image)
    return {
        "id": image.id,
        "created_at": image.created_at.isoformat() + "Z",
        "original_filename": image.original_filename,
        "size_bytes": thumb_data.get("size_bytes") or image.size_bytes,
        "thumbnail": {
            "format": thumb_data["format"],
            "data_base64": thumb_data["data_base64"],
        },
        "tags": [tag.name for tag in image.tags],
        "is_deleted": image.is_deleted,
        # 任务：列表接口补充收藏状态，用于前端渲染收藏按钮与轮播列表
        # 方案：序列化 images.is_favorite，保持字段命名与数据库一致
        "is_favorite": image.is_favorite,
    }


def serialize_image_detail(image):
    dimensions = None
    if image.dimensions:
        dimensions = {
            "width": image.dimensions.width,
            "height": image.dimensions.height,
        }
    capture_time = None
    if image.capture_time:
        capture_time = {
            "taken_at": image.capture_time.taken_at.isoformat() + "Z"
            if image.capture_time.taken_at
            else None,
            "taken_at_raw": image.capture_time.taken_at_raw,
        }
    location = None
    if image.location:
        location = {
            "latitude": float(image.location.latitude) if image.location.latitude is not None else None,
            "longitude": float(image.location.longitude) if image.location.longitude is not None else None,
            "altitude": float(image.location.altitude) if image.location.altitude is not None else None,
        }
    exif_entries = [
        {"key": entry.exif_key, "value": entry.exif_value}
        for entry in image.exif_entries
    ]

    return {
        "id": image.id,
        "uploader": {"id": image.uploader.id, "username": image.uploader.username}
        if image.uploader
        else {"id": image.uploader_id, "username": ""},
        "storage_relpath": image.storage_relpath,
        # 任务：详情返回上传时的文件名，便于前端展示原文件信息
        # 方案：序列化可空的 original_filename 字段
        "original_filename": image.original_filename,
        "dimensions": dimensions,
        "capture_time": capture_time,
        "location": location,
        "exif": exif_entries,
        "tags": [tag.name for tag in image.tags],
        "size_bytes": image.size_bytes,
        "created_at": image.created_at.isoformat() + "Z",
        "updated_at": image.updated_at.isoformat() + "Z",
        "is_deleted": image.is_deleted,
        # 任务：详情接口补充收藏状态，便于详情页切换收藏/取消收藏
        # 方案：直接返回 is_favorite 布尔字段
        "is_favorite": image.is_favorite,
    }
