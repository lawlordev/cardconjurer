"""Local Card Conjurer server with automatic browser reloads."""

from __future__ import annotations

import argparse
import html
import json
import os
from pathlib import Path
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parent
RELOAD_PATH = "/__live_reload"
WATCHED_EXTENSIONS = {
    ".css", ".gif", ".html", ".jpeg", ".jpg", ".js", ".json", ".png", ".svg", ".webp"
}
IGNORED_DIRECTORIES = {
    ".git", ".idea", ".vscode", "__pycache__", "data", "docs", "fonts", "img", "local_art", "node_modules"
}

LIVE_RELOAD_SCRIPT = f"""
<script data-card-conjurer-live-reload>
(() => {{
  const events = new EventSource('{RELOAD_PATH}');
  events.onmessage = event => {{
    const changedPath = JSON.parse(event.data).toLowerCase();
    if (changedPath.endsWith('.css')) {{
      document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {{
        const url = new URL(link.href, location.href);
        url.searchParams.set('liveReload', Date.now());
        link.href = url.href;
      }});
      return;
    }}
    location.reload();
  }};
}})();
</script>
""".strip()


class ChangeState:
    def __init__(self) -> None:
        self.condition = threading.Condition()
        self.version = 0
        self.path = ""

    def publish(self, path: str) -> None:
        with self.condition:
            self.version += 1
            self.path = path
            self.condition.notify_all()


CHANGES = ChangeState()


def source_snapshot() -> dict[str, int]:
    result: dict[str, int] = {}
    for directory, names, files in os.walk(ROOT):
        names[:] = [name for name in names if name not in IGNORED_DIRECTORIES]
        folder = Path(directory)
        for name in files:
            path = folder / name
            if path.suffix.lower() not in WATCHED_EXTENSIONS:
                continue
            try:
                result[path.relative_to(ROOT).as_posix()] = path.stat().st_mtime_ns
            except OSError:
                pass
    return result


def watch_sources() -> None:
    previous = source_snapshot()
    while True:
        time.sleep(0.35)
        current = source_snapshot()
        changed = sorted(
            path for path in current.keys() | previous.keys()
            if current.get(path) != previous.get(path)
        )
        previous = current
        if changed:
            CHANGES.publish(changed[-1])


class LiveReloadHandler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_GET(self) -> None:
        route = urlsplit(self.path).path
        if route == RELOAD_PATH:
            self.send_reload_events()
            return

        html_path = self.requested_html_file(route)
        if html_path is not None:
            self.send_html(html_path)
            return

        super().do_GET()

    def requested_html_file(self, route: str) -> Path | None:
        relative = unquote(route).lstrip("/")
        candidate = (ROOT / relative).resolve()
        try:
            candidate.relative_to(ROOT)
        except ValueError:
            return None
        if candidate.is_dir():
            candidate /= "index.html"
        return candidate if candidate.is_file() and candidate.suffix.lower() == ".html" else None

    def send_html(self, path: Path) -> None:
        try:
            source = path.read_text(encoding="utf-8")
        except (OSError, UnicodeError) as error:
            self.send_error(500, html.escape(str(error)))
            return
        marker = "</body>"
        document = source.replace(marker, LIVE_RELOAD_SCRIPT + "\n" + marker, 1)
        if document == source:
            document += "\n" + LIVE_RELOAD_SCRIPT
        payload = document.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def send_reload_events(self) -> None:
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Connection", "keep-alive")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()
        version = CHANGES.version
        try:
            while True:
                with CHANGES.condition:
                    CHANGES.condition.wait_for(lambda: CHANGES.version != version, timeout=15)
                    next_version = CHANGES.version
                    changed_path = CHANGES.path
                if next_version == version:
                    self.wfile.write(b": keep-alive\n\n")
                else:
                    version = next_version
                    message = "data: " + json.dumps(changed_path) + "\n\n"
                    self.wfile.write(message.encode("utf-8"))
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass

    def log_message(self, message: str, *args) -> None:
        if urlsplit(self.path).path != RELOAD_PATH:
            super().log_message(message, *args)


class LiveReloadServer(ThreadingHTTPServer):
    allow_reuse_address = False
    allow_reuse_port = False
    daemon_threads = True


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8081, type=int)
    arguments = parser.parse_args()

    threading.Thread(target=watch_sources, name="live-reload-watcher", daemon=True).start()
    server = LiveReloadServer((arguments.host, arguments.port), LiveReloadHandler)
    print(f"Card Conjurer live server: http://{arguments.host}:{arguments.port}/", flush=True)
    print("Edit HTML, CSS, or JavaScript and the browser will refresh automatically.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
