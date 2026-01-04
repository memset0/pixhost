# 任务：生成并维护缩略图记录，控制大小到 100KB 以内
# 方案：缩放到最大边 100px 后按质量压缩，写入数据库
import logging

from src.core.config_loader import get_config
from src.core.errors import ApiError, ERROR_NOT_FOUND
from src.models.thumbnail import ImageThumbnail
from src.utils.image_ops import generate_thumbnail
from src.utils.path_utils import resolve_path


def upsert_thumbnail(session, image):
    cfg = get_config()
    thumb_cfg = cfg.get("thumbnail", {})
    max_edge = thumb_cfg.get("max_edge", 100)
    max_bytes = thumb_cfg.get("max_bytes", 102400)
    output_format = thumb_cfg.get("format", "jpeg")
    quality = thumb_cfg.get("quality", 80)

    image_path = resolve_path(cfg["storage"]["root_dir"]) / image.storage_relpath
    if not image_path.exists():
        logging.warning(
            "image file missing, skip thumbnail generation: id=%s path=%s",
            image.id,
            image_path,
        )
        raise ApiError(404, ERROR_NOT_FOUND, "image file not found")

    if image.thumbnail:
        return {
            "format": image.thumbnail.format,
            "width": image.thumbnail.width,
            "height": image.thumbnail.height,
            "size_bytes": image.thumbnail.size_bytes,
            "data_base64": image.thumbnail.data_base64,
        }

    data = generate_thumbnail(image_path, max_edge, max_bytes, output_format, quality)
    size_bytes = image_path.stat().st_size

    if image.thumbnail:
        image.thumbnail.format = data["format"]
        image.thumbnail.width = data["width"]
        image.thumbnail.height = data["height"]
        image.thumbnail.size_bytes = size_bytes
        image.thumbnail.data_base64 = data["data_base64"]
    else:
        thumb = ImageThumbnail(
            image_id=image.id,
            format=data["format"],
            width=data["width"],
            height=data["height"],
            size_bytes=size_bytes,
            data_base64=data["data_base64"],
        )
        session.add(thumb)

    return {**data, "size_bytes": size_bytes}


def invalidate_thumbnail(session, image):
    if image.thumbnail:
        session.delete(image.thumbnail)
