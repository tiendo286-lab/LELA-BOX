"""Máy chủ nhỏ cho bài thử: phục vụ thư mục, nhận kết quả POST /ketqua rồi ghi ra tệp."""
import functools
import http.server
import os
import socketserver
import sys

root, port, out = sys.argv[1], int(sys.argv[2]), sys.argv[3]


class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_POST(self):
        if self.path.startswith('/ketqua'):
            n = int(self.headers.get('Content-Length', 0))
            data = self.rfile.read(n)
            with open(out + '.tmp', 'wb') as f:
                f.write(data)
            os.replace(out + '.tmp', out)
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'ok')
        else:
            self.send_response(404)
            self.end_headers()


class S(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


S(('127.0.0.1', port), functools.partial(H, directory=root)).serve_forever()
