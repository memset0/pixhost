# 任务：处理图片编辑前备份与编辑后状态更新
# 方案：编辑前复制原图到 backup 目录，编辑后清理缩略图

from PIL import Image

import shutil
from datetime import datetime

from src.core.config_loader import get_config
from src.models.image_dimensions import ImageDimensions
from src.utils.file_paths import build_backup_relpath, ensure_parent
from src.utils.path_utils import resolve_path
from src.services.thumbnail_service import invalidate_thumbnail


def backup_original(image):
    cfg = get_config()
    backup_dir = resolve_path(cfg["storage"]["backup_dir"])
    backup_relpath = build_backup_relpath(image.hash, image.ext)
    backup_path = backup_dir / backup_relpath
    ensure_parent(backup_path)

    source_path = resolve_path(cfg["storage"]["root_dir"]) / image.storage_relpath
    shutil.copy2(source_path, backup_path)
    return backup_path


def after_edit(session, image):
    # 任务：裁剪等编辑后同步宽高与文件大小，确保基础信息即时更新
    # 方案：重新读取落盘文件获取尺寸，更新/补全 image_dimensions，并刷新 updated_at 与 size_bytes
    image.updated_at = datetime.utcnow()
    cfg = get_config()
    file_path = resolve_path(cfg["storage"]["root_dir"]) / image.storage_relpath
    if file_path.exists():
        image.size_bytes = file_path.stat().st_size
        with Image.open(file_path) as img:
            width, height = img.size
        if image.dimensions:
            image.dimensions.width = width
            image.dimensions.height = height
        else:
            session.add(ImageDimensions(image_id=image.id, width=width, height=height))
    invalidate_thumbnail(session, image)
