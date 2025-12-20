# 任务：实现图片上传、元数据入库、标签管理与查询
# 方案：落盘后解析 EXIF/尺寸/缩略图并写入拆分表结构

from datetime import datetime
from pathlib import Path
from typing import List, Optional
from PIL import Image, UnidentifiedImageError

from src.core.config_loader import get_config
from src.core.errors import (
    ApiError,
    ERROR_VALIDATION,
    ERROR_TOO_LARGE,
    ERROR_UNSUPPORTED,
    ERROR_NOT_FOUND,
)
from src.models.image import Image as ImageModel
from src.models.image_dimensions import ImageDimensions
from src.models.image_capture_time import ImageCaptureTime
from src.models.image_location import ImageLocation
from src.models.image_exif import ImageExifEntry
from src.models.tag import Tag
from src.utils.file_paths import build_storage_relpath, ensure_parent
from src.utils.path_utils import resolve_path
from src.utils.exif_utils import extract_exif_dict, parse_capture_time, parse_location, build_exif_tags
from src.services.thumbnail_service import upsert_thumbnail


def parse_tag_string(tags_value: str) -> List[str]:
    if not tags_value:
        return []
    return [item.strip() for item in tags_value.split(",") if item.strip()]


def _allowed_exts() -> List[str]:
    cfg = get_config()
    allowed = cfg.get("upload", {}).get("allowed_exts", "")
    return [item.strip().lower() for item in allowed.split(",") if item.strip()]


def _max_size_bytes() -> int:
    cfg = get_config()
    return int(cfg.get("upload", {}).get("max_size_mb", 20) * 1024 * 1024)


def validate_upload(file_storage, content_length: Optional[int]):
    # 任务：校验上传文件的后缀与大小
    # 方案：后缀白名单 + 请求体大小限制
    if not file_storage or not file_storage.filename:
        raise ApiError(400, ERROR_VALIDATION, "file missing")
    ext = Path(file_storage.filename).suffix.lstrip(".").lower()
    if ext not in _allowed_exts():
        raise ApiError(415, ERROR_UNSUPPORTED, "file extension not allowed")
    max_bytes = _max_size_bytes()
    if content_length and content_length > max_bytes:
        raise ApiError(413, ERROR_TOO_LARGE, "file too large")
    return ext


def find_or_create_tags(session, names: List[str], source: str) -> List[Tag]:
    tags = []
    for name in names:
        tag = session.query(Tag).filter(Tag.name == name, Tag.source == source).first()
        if not tag:
            tag = Tag(name=name, source=source)
            session.add(tag)
        tags.append(tag)
    return tags


def save_upload(session, file_storage, uploader, tags_value: str, content_length: Optional[int]):
    ext = validate_upload(file_storage, content_length)
    root_dir = resolve_path(get_config()["storage"]["root_dir"])
    storage_relpath, hash_value = build_storage_relpath(ext)
    abs_path = root_dir / storage_relpath
    while abs_path.exists():
        storage_relpath, hash_value = build_storage_relpath(ext)
        abs_path = root_dir / storage_relpath
    ensure_parent(abs_path)

    file_storage.save(abs_path)
    size_bytes = abs_path.stat().st_size
    if size_bytes > _max_size_bytes():
        abs_path.unlink(missing_ok=True)
        raise ApiError(413, ERROR_TOO_LARGE, "file too large")

    try:
        with Image.open(abs_path) as img:
            img.verify()
    except (UnidentifiedImageError, OSError) as exc:
        abs_path.unlink(missing_ok=True)
        raise ApiError(415, ERROR_UNSUPPORTED, "invalid image") from exc

    image = ImageModel(
        uploader_id=uploader.id,
        original_filename=file_storage.filename,
        ext=ext,
        hash=hash_value,
        storage_relpath=str(storage_relpath),
        size_bytes=size_bytes,
        mime_type=file_storage.mimetype,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        is_deleted=False,
    )
    session.add(image)
    session.flush()

    with Image.open(abs_path) as img:
        width, height = img.size
        exif_dict = extract_exif_dict(img)
        taken_at, taken_at_raw = parse_capture_time(exif_dict)
        latitude, longitude, altitude, gps_raw = parse_location(exif_dict)

    session.add(ImageDimensions(image_id=image.id, width=width, height=height))
    session.add(
        ImageCaptureTime(image_id=image.id, taken_at=taken_at, taken_at_raw=taken_at_raw)
    )
    session.add(
        ImageLocation(
            image_id=image.id,
            latitude=latitude,
            longitude=longitude,
            altitude=altitude,
            gps_raw=str(gps_raw) if gps_raw else None,
        )
    )

    for key, value in exif_dict.items():
        session.add(
            ImageExifEntry(
                image_id=image.id,
                exif_key=str(key),
                exif_value=str(value) if value is not None else None,
            )
        )

    exif_tags = find_or_create_tags(session, build_exif_tags(exif_dict), "exif")
    custom_tags = find_or_create_tags(session, parse_tag_string(tags_value), "custom")
    image.tags.extend(exif_tags + custom_tags)

    upsert_thumbnail(session, image)

    return image


def get_image_or_404(session, image_id: int):
    image = session.get(ImageModel, image_id)
    if not image:
        raise ApiError(404, ERROR_NOT_FOUND, "image not found")
    return image
