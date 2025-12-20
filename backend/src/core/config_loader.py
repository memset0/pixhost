# 任务：加载与热重载 config.yaml，确保配置不入库
# 方案：基于文件 mtime 缓存配置，读时自动刷新

from pathlib import Path
import threading
import yaml


class ConfigLoader:
    def __init__(self, path: Path):
        self._path = path
        self._lock = threading.Lock()
        self._cache = None
        self._mtime = None

    def _load(self):
        if not self._path.exists():
            raise RuntimeError(f"config.yaml not found: {self._path}")
        with self._path.open("r", encoding="utf-8") as handle:
            data = yaml.safe_load(handle) or {}
        self._cache = data
        self._mtime = self._path.stat().st_mtime
        return data

    def get(self):
        with self._lock:
            if self._cache is None:
                return self._load()
            current_mtime = self._path.stat().st_mtime
            if current_mtime != self._mtime:
                return self._load()
            return self._cache

    def write(self, data):
        # 任务：原子写入配置文件，避免并发写入导致破坏
        # 方案：先写临时文件再替换，并用线程锁保证单进程互斥
        tmp_path = self._path.with_suffix(self._path.suffix + ".tmp")
        with self._lock:
            with tmp_path.open("w", encoding="utf-8") as handle:
                yaml.safe_dump(data, handle, allow_unicode=True, sort_keys=False)
            tmp_path.replace(self._path)
            self._cache = data
            self._mtime = self._path.stat().st_mtime


_root_dir = Path(__file__).resolve().parents[3]
_config_loader = ConfigLoader(_root_dir / "config.yaml")


def get_config():
    return _config_loader.get()


def write_config(data):
    _config_loader.write(data)
