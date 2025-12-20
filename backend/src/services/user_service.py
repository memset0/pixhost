# 任务：提供用户相关辅助逻辑（初始化管理员等）
# 方案：启动时检查 admin 用户是否存在，不存在则创建

from datetime import datetime

from src.models.user import User
from src.services.auth_service import hash_password


def ensure_admin(session):
    admin = session.query(User).filter(User.username == "admin").first()
    if admin:
        return admin
    admin = User(
        username="admin",
        email="admin@example.com",
        password_hash=hash_password("123456"),
        role="admin",
        created_at=datetime.utcnow(),
        is_active=True,
    )
    session.add(admin)
    session.flush()
    return admin
