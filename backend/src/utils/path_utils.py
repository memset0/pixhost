# 任务：将 config.yaml 中的相对路径解析为项目根目录下的绝对路径
# 方案：若配置为相对路径，则以项目根路径拼接

from pathlib import Path


def project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def resolve_path(path_value: str) -> Path:
    raw = Path(path_value)
    if raw.is_absolute():
        return raw
    return (project_root() / raw).resolve()
