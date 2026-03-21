import os
import sys
from pathlib import Path


APP_NAME = "Baithak"


def _repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def is_desktop_mode() -> bool:
    mode = os.getenv("BAITHAK_DESKTOP", "").strip().lower()
    if mode in {"1", "true", "yes"}:
        return True
    return bool(getattr(sys, "frozen", False))


def get_runtime_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return _repo_root()


def get_bundle_root() -> Path:
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS)
    return _repo_root()


def get_data_dir() -> Path:
    override = os.getenv("BAITHAK_APP_DIR", "").strip()
    if override:
        path = Path(override).expanduser().resolve()
    elif getattr(sys, "frozen", False):
        appdata = os.getenv("APPDATA", "").strip()
        if appdata:
            path = Path(appdata) / APP_NAME
        else:
            path = Path.home() / f".{APP_NAME.lower()}"
    else:
        path = _repo_root() / "desktop_data"

    path.mkdir(parents=True, exist_ok=True)
    return path


def get_frontend_dist_dir() -> Path:
    return get_bundle_root() / "frontend" / "dist"


def get_uploads_dir() -> Path:
    path = get_data_dir() / "uploads"
    path.mkdir(parents=True, exist_ok=True)
    return path
