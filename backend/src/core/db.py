# 任务：初始化数据库连接与会话，并在启动时创建表结构
# 方案：SQLAlchemy 2.x + sessionmaker，使用 create_all 简化实验部署

from contextlib import contextmanager
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from src.core.config_loader import get_config

Base = declarative_base()
_engine = None
_SessionLocal = None


def _normalize_db_url(db_url: str) -> str:
    # 任务：让 sqlite 的相对路径与 config.yaml 同级目录对齐
    # 方案：解析 sqlite:/// 后的路径，非内存库则用项目根目录补全为绝对路径
    if not db_url.startswith("sqlite:///"):
        return db_url
    db_path = Path(db_url.replace("sqlite:///", "", 1))
    if db_path.name == ":memory:":
        return db_url
    from src.utils.path_utils import resolve_path

    resolved_path = resolve_path(str(db_path))
    return f"sqlite:///{resolved_path}"


def init_engine():
    global _engine, _SessionLocal
    if _engine is None:
        cfg = get_config()
        db_url = cfg.get("database", {}).get("url")
        if not db_url:
            raise RuntimeError("database.url missing in config.yaml")
        db_url = _normalize_db_url(db_url)
        if db_url.startswith("sqlite:///"):
            db_path = Path(db_url.replace("sqlite:///", "", 1))
            if db_path.name != ":memory:":
                db_path.parent.mkdir(parents=True, exist_ok=True)
        _engine = create_engine(db_url, future=True)
        _SessionLocal = sessionmaker(bind=_engine, autoflush=False, autocommit=False, expire_on_commit=False)
    return _engine


def get_session():
    if _SessionLocal is None:
        init_engine()
    return _SessionLocal()


@contextmanager
def session_scope():
    # 任务：提供简洁的会话生命周期管理
    # 方案：正常提交，异常回滚（必要的 try/except 仅用于事务一致性）
    session = get_session()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def init_db():
    init_engine()
    cfg = get_config()
    from src.utils.path_utils import resolve_path

    storage_root = resolve_path(cfg.get("storage", {}).get("root_dir", "./data/images"))
    backup_root = resolve_path(cfg.get("storage", {}).get("backup_dir", "./data/images/backup"))
    storage_root.mkdir(parents=True, exist_ok=True)
    backup_root.mkdir(parents=True, exist_ok=True)

    from src import models  # noqa: F401  # 任务：触发模型导入，确保 Base 元数据完整

    Base.metadata.create_all(bind=_engine)
