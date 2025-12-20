# 任务：编写磁盘图片迁移脚本，支持目录扫描、可选 JSONL 覆盖并同步到 SQLite
# 方案：读取 data/images 年/月/日 结构推断时间与 hash，融合 JSONL 上传时间与原始名，解析 EXIF/尺寸后按 storage_relpath upsert 入库

from argparse import ArgumentParser
from datetime import datetime, timezone
import hashlib
import json
import mimetypes
from pathlib import Path
import sys
from typing import Dict, Optional

from PIL import Image

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from src.core.config_loader import get_config  # noqa: E402
from src.core.db import init_db, session_scope  # noqa: E402
from src.models.image import Image as ImageModel  # noqa: E402
from src.models.image_capture_time import ImageCaptureTime  # noqa: E402
from src.models.image_dimensions import ImageDimensions  # noqa: E402
from src.models.image_exif import ImageExifEntry  # noqa: E402
from src.models.image_location import ImageLocation  # noqa: E402
from src.services.image_service import find_or_create_tags  # noqa: E402
from src.services.thumbnail_service import upsert_thumbnail  # noqa: E402
from src.services.user_service import ensure_admin  # noqa: E402
from src.utils.exif_utils import (  # noqa: E402
    build_exif_tags,
    extract_exif_dict,
    parse_capture_time,
    parse_location,
)
from src.utils.path_utils import resolve_path  # noqa: E402


def parse_args():
    parser = ArgumentParser(description="迁移 data/images 到 SQLite")
    parser.add_argument(
        "--jsonl",
        type=Path,
        default=None,
        help="可选：包含 file_path/upload_time/original_name 的 JSONL 覆盖文件",
    )
    return parser.parse_args()


def _normalize_relpath(raw_path: str) -> Optional[str]:
    path = Path(raw_path)
    if len(path.parts) < 4:
        return None
    year, month, day, filename = path.parts[-4:]
    if not (year.isdigit() and month.isdigit() and day.isdigit()):
        return None
    return f"{int(year):04d}/{int(month):02d}/{int(day):02d}/{filename}"


def _parse_time(value: Optional[str], default_dt: datetime) -> datetime:
    if not value:
        return default_dt
    candidate = value.replace("Z", "+00:00")
    dt = datetime.fromisoformat(candidate)
    if dt.tzinfo:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _load_overrides(jsonl_path: Path) -> Dict[str, Dict]:
    overrides: Dict[str, Dict] = {}
    for line in jsonl_path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        payload = json.loads(line)
        rel = _normalize_relpath(str(payload.get("file_path", "")))
        if not rel:
            continue
        overrides[rel] = {
            "upload_time": payload.get("upload_time"),
            "original_name": payload.get("original_name"),
        }
    return overrides


def _calc_sha256(path: Path) -> str:
    sha = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(8192), b""):
            sha.update(chunk)
    return sha.hexdigest()


def _build_metadata(file_path: Path, relpath: str, override: Optional[Dict]) -> Dict:
    year_str, month_str, day_str, filename = relpath.split("/", 3)
    base_dt = datetime(int(year_str), int(month_str), int(day_str))
    upload_dt = _parse_time((override or {}).get("upload_time"), base_dt)
    original_name = (override or {}).get("original_name") or filename

    mime_type, _ = mimetypes.guess_type(filename)
    sha256 = _calc_sha256(file_path)
    ext = file_path.suffix.lstrip(".").lower()
    hash_value = file_path.stem

    with Image.open(file_path) as img:
        width, height = img.size
        exif_dict = extract_exif_dict(img)
        taken_at, taken_at_raw = parse_capture_time(exif_dict)
        latitude, longitude, altitude, gps_raw = parse_location(exif_dict)

    return {
        "storage_relpath": relpath,
        "hash": hash_value,
        "ext": ext,
        "size_bytes": file_path.stat().st_size,
        "mime_type": mime_type,
        "sha256": sha256,
        "created_at": upload_dt,
        "original_filename": original_name,
        "width": width,
        "height": height,
        "taken_at": taken_at,
        "taken_at_raw": taken_at_raw,
        "latitude": latitude,
        "longitude": longitude,
        "altitude": altitude,
        "gps_raw": str(gps_raw) if gps_raw else None,
        "exif_entries": list(exif_dict.items()),
        "exif_tags": build_exif_tags(exif_dict),
    }


def _upsert_related(session, image, meta: Dict):
    if image.dimensions:
        image.dimensions.width = meta["width"]
        image.dimensions.height = meta["height"]
    else:
        session.add(
            ImageDimensions(
                image_id=image.id,
                width=meta["width"],
                height=meta["height"],
            )
        )

    if image.capture_time:
        image.capture_time.taken_at = meta["taken_at"]
        image.capture_time.taken_at_raw = meta["taken_at_raw"]
    else:
        session.add(
            ImageCaptureTime(
                image_id=image.id,
                taken_at=meta["taken_at"],
                taken_at_raw=meta["taken_at_raw"],
            )
        )

    if image.location:
        image.location.latitude = meta["latitude"]
        image.location.longitude = meta["longitude"]
        image.location.altitude = meta["altitude"]
        image.location.gps_raw = meta["gps_raw"]
    else:
        session.add(
            ImageLocation(
                image_id=image.id,
                latitude=meta["latitude"],
                longitude=meta["longitude"],
                altitude=meta["altitude"],
                gps_raw=meta["gps_raw"],
            )
        )

    session.query(ImageExifEntry).filter(ImageExifEntry.image_id == image.id).delete()
    for key, value in meta["exif_entries"]:
        session.add(
            ImageExifEntry(
                image_id=image.id,
                exif_key=str(key),
                exif_value=str(value) if value is not None else None,
            )
        )

    if meta["exif_tags"]:
        tag_objs = find_or_create_tags(session, meta["exif_tags"], "exif")
        existing_ids = {tag.id for tag in image.tags}
        for tag in tag_objs:
            if tag.id not in existing_ids:
                image.tags.append(tag)


def _update_image(session, image, meta: Dict):
    if not image.original_filename and meta["original_filename"]:
        image.original_filename = meta["original_filename"]
    image.ext = meta["ext"]
    image.hash = meta["hash"]
    image.storage_relpath = meta["storage_relpath"]
    image.size_bytes = meta["size_bytes"]
    image.mime_type = meta["mime_type"]
    image.sha256 = meta["sha256"]
    # 任务：已存在记录不回写上传时间，保留原 created_at/updated_at
    _upsert_related(session, image, meta)
    upsert_thumbnail(session, image)


def _insert_image(session, meta: Dict, uploader_id: int):
    image = ImageModel(
        uploader_id=uploader_id,
        original_filename=meta["original_filename"],
        ext=meta["ext"],
        hash=meta["hash"],
        storage_relpath=meta["storage_relpath"],
        size_bytes=meta["size_bytes"],
        mime_type=meta["mime_type"],
        sha256=meta["sha256"],
        created_at=meta["created_at"],
        updated_at=meta["created_at"],
        is_deleted=False,
    )
    session.add(image)
    session.flush()
    _upsert_related(session, image, meta)
    if meta["exif_tags"]:
        image.tags.extend(find_or_create_tags(session, meta["exif_tags"], "exif"))
    upsert_thumbnail(session, image)
    return image


def main():
    args = parse_args()
    init_db()

    cfg = get_config()
    images_root = resolve_path(cfg.get("storage", {}).get("root_dir", "./data/images"))
    overrides = _load_overrides(args.jsonl) if args.jsonl else {}

    with session_scope() as session:
        admin = ensure_admin(session)
        inserted = 0
        updated = 0

        for file_path in images_root.rglob("*"):
            if not file_path.is_file():
                continue
            rel_parts = file_path.relative_to(images_root).parts
            if rel_parts and rel_parts[0] == "backup":
                continue
            relpath = "/".join(rel_parts)
            normalized = _normalize_relpath(relpath)
            if not normalized:
                continue
            meta = _build_metadata(file_path, normalized, overrides.get(normalized))
            image = (
                session.query(ImageModel)
                .filter(ImageModel.storage_relpath == normalized)
                .first()
            )
            if image:
                _update_image(session, image, meta)
                updated += 1
            else:
                _insert_image(session, meta, admin.id)
                inserted += 1

        print(f"迁移完成：inserted={inserted}, updated={updated}")


if __name__ == "__main__":
    main()
