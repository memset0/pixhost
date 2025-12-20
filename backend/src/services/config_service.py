# 任务：读取与更新 config.yaml（不入库）
# 方案：读取配置后按需写回，并支持 favicon_base64 写文件

import base64
from typing import Optional

from src.core.config_loader import get_config, write_config
from src.utils.path_utils import resolve_path


def get_config_view():
    cfg = get_config()
    return {
        "site_name": cfg.get("site", {}).get("name", ""),
        "favicon_path": cfg.get("site", {}).get("favicon_path", ""),
        "upload_allowed_exts": cfg.get("upload", {}).get("allowed_exts", ""),
        "pagination_page_size": cfg.get("pagination", {}).get("page_size", 20),
        "copy_link_base_url": cfg.get("links", {}).get("public_base_url", ""),
    }


def update_config(
    site_name: Optional[str],
    favicon_base64: Optional[str],
    upload_allowed_exts: Optional[str],
    pagination_page_size: Optional[int],
    copy_link_base_url: Optional[str],
):
    cfg = get_config()
    if site_name:
        cfg.setdefault("site", {})["name"] = site_name
    if upload_allowed_exts:
        cfg.setdefault("upload", {})["allowed_exts"] = upload_allowed_exts
    if pagination_page_size:
        cfg.setdefault("pagination", {})["page_size"] = int(pagination_page_size)
    if copy_link_base_url is not None:
        cfg.setdefault("links", {})["public_base_url"] = copy_link_base_url
    if favicon_base64:
        favicon_path = cfg.get("site", {}).get("favicon_path", "./static/favicon.ico")
        abs_path = resolve_path(favicon_path)
        abs_path.parent.mkdir(parents=True, exist_ok=True)
        data = base64.b64decode(favicon_base64)
        abs_path.write_bytes(data)
        cfg.setdefault("site", {})["favicon_path"] = favicon_path
    write_config(cfg)
    return get_config_view()
