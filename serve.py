# Server tĩnh cho dự án, TẮT bộ nhớ đệm để sửa code xong chỉ cần F5 là thấy ngay.
# Chạy:  python serve.py        (mặc định cổng 5173)
#        python serve.py 8765   (cổng khác)
import http.server
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5173


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Expires", "0")
        super().end_headers()


NoCacheHandler.extensions_map.update({".js": "text/javascript", ".mjs": "text/javascript"})

if __name__ == "__main__":
    print(f"Phi Kiem Tran: http://localhost:{PORT}", flush=True)  # ASCII: console Windows không in được tiếng Việt
    http.server.ThreadingHTTPServer(("", PORT), NoCacheHandler).serve_forever()
