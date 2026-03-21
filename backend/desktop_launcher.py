import os
import socket
import threading
import time
import webbrowser

import uvicorn


def resolve_port(default: int = 8000) -> int:
    requested = int(os.getenv("BAITHAK_PORT", str(default)))
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        try:
            sock.bind(("127.0.0.1", requested))
            return requested
        except OSError:
            sock.bind(("127.0.0.1", 0))
            return int(sock.getsockname()[1])


def open_browser(url: str) -> None:
    time.sleep(1.5)
    webbrowser.open(url)


def main() -> None:
    port = resolve_port()
    url = f"http://127.0.0.1:{port}"
    threading.Thread(target=open_browser, args=(url,), daemon=True).start()
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=False)


if __name__ == "__main__":
    main()
