# 任务：处理图片编辑前备份与编辑后状态更新
# 方案：编辑前复制原图到 backup 目录，编辑后清理缩略图

import shutil
from datetime import datetime

from src.core.config_loader import get_config
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
    image.updated_at = datetime.utcnow()
    invalidate_thumbnail(session, image)
