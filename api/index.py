import json
import urllib.request
import urllib.parse
from http.server import BaseHTTPRequestHandler

TOKEN = "8889976501:AAGqPijRKckYZDhuxUs1KPXTS6TFWtLyu0"
API_URL = f"https://api.telegram.org/bot{TOKEN}/"
DOMAIN = "https://dank-0.vercel.app"

# واجهة HTML التي ستظهر عند فتح الرابط من المتصفح
HTML_CONTENT = f"""<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>حالة البوت | Dank Bot</title>
    <style>
        body {{
            font-family: system-ui, -apple-system, sans-serif;
            background-color: #0f172a;
            color: #f8fafc;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
        }}
        .card {{
            background-color: #1e293b;
            padding: 2rem;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.3);
            text-align: center;
            max-width: 400px;
            border: 1px solid #334155;
        }}
        .status-badge {{
            background-color: #10b981;
            color: #1e293b;
            font-weight: bold;
            padding: 6px 16px;
            border-radius: 20px;
            display: inline-block;
            margin-bottom: 1rem;
        }}
        h1 {{ margin-bottom: 0.5rem; font-size: 1.5rem; }}
        p {{ color: #94a3b8; font-size: 0.95rem; line-height: 1.5; }}
        code {{ background: #0f172a; padding: 4px 8px; border-radius: 4px; color: #38bdf8; }}
    </style>
</head>
<body>
    <div class="card">
        <div class="status-badge">● يعمل بنجاح</div>
        <h1>Telegram Bot Webhook</h1>
        <p>تم ربط البوت واستضافته بنجاح على منصة <strong>Vercel</strong>.</p>
        <p>الدومين النشط:<br><code>{DOMAIN}</code></p>
    </div>
</body>
</html>"""

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # عرض صفحة HTML عند فتح الرابط بالمتصفح بدلاً من تنزيل الملف
        self.send_response(200)
        self.send_header('Content-type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(HTML_CONTENT.encode('utf-8'))

    def do_POST(self):
        # معالجة رسائل الـ Webhook القادمة من تيليجرام
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({"status": "ok"}).encode('utf-8'))

        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)
        
        if not post_data:
            return

        try:
            update = json.loads(post_data.decode('utf-8'))
            if "message" in update:
                chat_id = update["message"]["chat"]["id"]
                text = update["message"].get("text", "")

                if text == "/start":
                    reply = f"أهلاً بك! البوت يعمل بنجاح على Vercel 🚀\nالرابط: {DOMAIN}"
                else:
                    reply = f"تم استلام رسالتك عبر ({DOMAIN}):\n{text}"

                params = urllib.parse.urlencode({'chat_id': chat_id, 'text': reply})
                urllib.request.urlopen(f"{API_URL}sendMessage?{params}")
        except Exception as e:
            print("Error:", e)
