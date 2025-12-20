# 任务：启动 Connexion 应用并加载 OpenAPI 规范
# 方案：指定根目录 openapi.yaml，初始化数据库与管理员账号

from pathlib import Path
import sys

from connexion.options import SwaggerUIOptions

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

swagger_opts = SwaggerUIOptions(swagger_ui=False)
connexion_app = connexion.FlaskApp(__name__, specification_dir=str(ROOT_DIR))
connexion_app.add_api(
    "openapi.yaml",
    strict_validation=True,
    validate_responses=False,
    swagger_ui_options=swagger_opts,
)
# 任务：分别暴露 Flask 实例用于错误处理，以及 ASGI 应用供 uvicorn 启动
flask_app = connexion_app.app
app = connexion_app


# 错误处理挂在 Flask 应用上，Connexion 调用的视图会复用该处理
@flask_app.errorhandler(ApiError)
def handle_api_error(error: ApiError):
    response = {
        "error": {
            "code": error.code,
            "message": error.message,
            "details": error.details,
        }
    }
    return jsonify(response), error.status_code
connexion_app.middleware.add_error_handler(ApiError, handle_api_error)


def bootstrap():
    init_db()
    with session_scope() as session:
        ensure_admin(session)
    # 任务：提前构建中间件栈，使蓝图注册到 flask_app，便于 test_client 与 uvicorn 访问
    app.middleware.app, app.middleware.middleware_stack = app.middleware._build_middleware_stack()


bootstrap()


if __name__ == "__main__":
    port = get_config().get("port", 6007)
    # 任务：使用 uvicorn 跑 ASGI 应用，确保 Connexion 路由生效
    # 方案：调用 connexion_app.run，它内部使用 uvicorn
    connexion_app.run(port=port, host="0.0.0.0")
