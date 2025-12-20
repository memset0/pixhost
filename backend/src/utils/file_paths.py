# 任务：生成图片存储与备份路径，符合实验要求
# 方案：按日期分目录 + 8 位随机哈希文件名

from datetime import datetime
from pathlib import Path
import secrets
import string


ALPHABET = string.ascii_letters + string.digits


def random_hash(length: int = 8) -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(length))


def build_storage_relpath(ext: str) -> tuple[str, str]:
    now = datetime.utcnow()
    date_path = f"{now.year:04d}/{now.month:02d}/{now.day:02d}"
    hash_value = random_hash(8)
    filename = f"{hash_value}.{ext}"
    return f"{date_path}/{filename}", hash_value


def build_backup_relpath(hash_value: str, ext: str) -> str:
    now = datetime.utcnow()
    timestamp = now.strftime("%Y%m%d%H%M%S")
    date_path = f"{now.year:04d}/{now.month:02d}/{now.day:02d}"
    filename = f"{hash_value}_{timestamp}.{ext}"
    return f"{date_path}/{filename}"


def ensure_parent(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
