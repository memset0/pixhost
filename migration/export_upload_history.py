# 任务：导出 SQLite 图片上传历史到 JSONL，便于备份/迁移
# 方案：argparse 接收 DB/输出路径（默认 data/PicUploader.db -> data/pic_uploader_history.jsonl），读取 history 表，解析 url 中的 年/月/日/文件名 为相对路径，写出 file_path/upload_time/original_name JSONL

from argparse import ArgumentParser
from datetime import datetime
import json
import sqlite3
from urllib.parse import urlparse
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def parse_args():
    parser = ArgumentParser(description="导出图片上传历史为 JSONL")
    parser.add_argument(
        "--db",
        type=Path,
        default=Path("data/PicUploader.db"),
        help="SQLite 数据库路径，默认 data/PicUploader.db",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/pic_uploader_history.jsonl"),
        help="输出 JSONL 路径，默认 data/pic_uploader_history.jsonl",
    )
    return parser.parse_args()


def _normalize_relpath(raw_path: str) -> str:
    path = Path(raw_path)
    if len(path.parts) < 4:
        return None
    year, month, day, filename = path.parts[-4:]
    if not (year.isdigit() and month.isdigit() and day.isdigit()):
        return None
    return f"{int(year):04d}/{int(month):02d}/{int(day):02d}/{filename}"


def _resolve_path(base: Path) -> Path:
    return base if base.is_absolute() else PROJECT_ROOT / base


def _to_iso_string(raw: str) -> str:
    normalized = raw.replace(" ", "T").replace("Z", "+00:00")
    dt = datetime.fromisoformat(normalized)
    return dt.isoformat()


def _extract_relpath_from_url(url: str) -> str:
    path = urlparse(url).path
    parts = [part for part in Path(path).parts if part not in ("", "/")]
    if len(parts) < 4:
        return None
    return _normalize_relpath("/".join(parts[-4:]))


def export_history(db_path: Path, output_path: Path):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT filename, url, created_at FROM history"
        ).fetchall()

    with output_path.open("w", encoding="utf-8") as handle:
        for row in rows:
            relpath = _extract_relpath_from_url(row["url"])
            if not relpath:
                continue
            upload_time = _to_iso_string(row["created_at"]) if row["created_at"] else None
            payload = {
                "file_path": relpath,
                "upload_time": upload_time,
                "original_name": row["filename"],
            }
            handle.write(json.dumps(payload, ensure_ascii=False) + "\n")


def main():
    args = parse_args()
    db_path = _resolve_path(args.db)
    output_path = _resolve_path(args.output)
    export_history(db_path, output_path)


if __name__ == "__main__":
    main()
