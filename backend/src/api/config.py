# 任务：提供全站配置读取与更新接口
# 方案：仅管理员可读写 config.yaml

from connexion import request

from src.core.db import session_scope
from src.core.auth import get_current_user, require_role
from src.services.config_service import get_config_view, update_config as update_config_service


def get_config():
    with session_scope() as session:
        current = get_current_user(session)
        require_role(current, ["admin"])
        return get_config_view()


def update_config():
    payload = request.get_json(silent=True) or {}
    site_name = payload.get("site_name")
    favicon_base64 = payload.get("favicon_base64")
    upload_allowed_exts = payload.get("upload_allowed_exts")
    pagination_page_size = payload.get("pagination_page_size")
    with session_scope() as session:
        current = get_current_user(session)
        require_role(current, ["admin"])
        return update_config_service(
            site_name,
            favicon_base64,
            upload_allowed_exts,
            pagination_page_size,
        )
