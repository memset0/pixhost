# 任务：将 ORM 对象序列化为 OpenAPI 定义的响应结构
# 方案：针对列表与详情提供独立的序列化函数

from src.services.thumbnail_service import upsert_thumbnail


def serialize_user(user):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
    }


def serialize_image_summary(session, image):
    thumb_data = upsert_thumbnail(session, image)
    return {
        "id": image.id,
        "created_at": image.created_at.isoformat() + "Z",
        "thumbnail": {
            "format": thumb_data["format"],
            "data_base64": thumb_data["data_base64"],
        },
        "tags": [tag.name for tag in image.tags],
        "is_deleted": image.is_deleted,
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
        "created_at": image.created_at.isoformat() + "Z",
        "updated_at": image.updated_at.isoformat() + "Z",
        "is_deleted": image.is_deleted,
    }
