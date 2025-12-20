# 任务：启动 Connexion 应用并加载 OpenAPI 规范
# 方案：指定根目录 openapi.yaml，初始化数据库与管理员账号

from pathlib import Path
import sys

ROOT_DIR = Path(__file__).resolve().parents[1]

# 任务：确保 src 包可被导入
# 方案：将 backend 目录加入 sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

import connexion
from flask import jsonify

from src.core.db import init_db, session_scope
from src.core.errors import ApiError
from src.core.config_loader import get_config
from src.services.user_service import ensure_admin

connexion_app = connexion.FlaskApp(__name__, specification_dir=str(ROOT_DIR))
connexion_app.add_api("openapi.yaml", strict_validation=True, validate_responses=False)
app = connexion_app.app


@app.errorhandler(ApiError)
def handle_api_error(error: ApiError):
    response = {
        "error": {
            "code": error.code,
            "message": error.message,
            "details": error.details,
        }
    }
    return jsonify(response), error.status_code


def bootstrap():
    init_db()
    with session_scope() as session:
        ensure_admin(session)


bootstrap()


if __name__ == "__main__":
    port = get_config().get("port", 6007)
    app.run(host="0.0.0.0", port=port, debug=True)
