import json
import urllib.request
import urllib.parse
from http.server import BaseHTTPRequestHandler

TOKEN = "8889976501:AAGqPijRKckYZDhuxUs1KPXTS6TFWtLyu0"
API_URL = f"https://api.telegram.org/bot{TOKEN}/"
DOMAIN = "https://dank-0.vercel.app"

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        # إرسال استجابة فورية 200 لتليجرام
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({"status": "ok"}).encode('utf-8'))

        # قراءة البيانات الواردة من تليجرام
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

                # إرسال الرد إلى المستخدم
                params = urllib.parse.urlencode({'chat_id': chat_id, 'text': reply})
                urllib.request.urlopen(f"{API_URL}sendMessage?{params}")
        except Exception as e:
            print("Error:", e)

    def do_GET(self):
        # عرض صفحة تأكيد عند فتح الرابط في المتصفح
        self.send_response(200)
        self.send_header('Content-type', 'text/html; charset=utf-8')
        self.end_headers()
        response_html = f"<h1>البوت يعمل بنجاح على Vercel!</h1><p>الدومين النشط: {DOMAIN}</p>"
        self.wfile.write(response_html.encode('utf-8'))
