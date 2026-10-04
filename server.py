"""Serve the local app without retaining outdated application files."""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class AppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(Path(__file__).parent), **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_GET(self):
        # Always return the current file, even after switching branches quickly.
        if 'If-Modified-Since' in self.headers:
            del self.headers['If-Modified-Since']
        super().do_GET()

    def do_HEAD(self):
        if 'If-Modified-Since' in self.headers:
            del self.headers['If-Modified-Since']
        super().do_HEAD()


if __name__ == '__main__':
    with ThreadingHTTPServer(('127.0.0.1', 5173), AppHandler) as server:
        print('Serving timeline at http://localhost:5173 (file caching disabled)', flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
