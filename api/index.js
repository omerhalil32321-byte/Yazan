const TOKEN = "8889976501:AAGqPijRKckYZDhuxUss1KPXTS6TFWtLyu0";
const DOMAIN = "https://dank-0.vercel.app";

const HTML_CONTENT = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>حالة البوت | Dank Bot</title>
    <style>
        body { font-family: system-ui, sans-serif; background-color: #0f172a; color: #f8fafc; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .card { background-color: #1e293b; padding: 2rem; border-radius: 12px; text-align: center; max-width: 400px; border: 1px solid #334155; }
        .status-badge { background-color: #10b981; color: #1e293b; font-weight: bold; padding: 6px 16px; border-radius: 20px; display: inline-block; margin-bottom: 1rem; }
        h1 { margin-bottom: 0.5rem; font-size: 1.5rem; }
        p { color: #94a3b8; font-size: 0.95rem; line-height: 1.5; }
        code { background: #0f172a; padding: 4px 8px; border-radius: 4px; color: #38bdf8; }
    </style>
</head>
<body>
    <div class="card">
        <div class="status-badge">● يعمل بنجاح</div>
        <h1>Telegram Bot Webhook</h1>
        <p>تم ربط البوت واستضافته بنجاح على منصة <strong>Vercel</strong>.</p>
        <p>الدومين النشط:<br><code>${DOMAIN}</code></p>
    </div>
</body>
</html>`;

export default async function handler(req, res) {
    if (req.method === 'GET') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(HTML_CONTENT);
    }

    if (req.method === 'POST') {
        const update = req.body;
        if (update && update.message) {
            const chatId = update.message.chat.id;
            const text = update.message.text || '';
            const reply = text === '/start' ? `أهلاً بك! البوت يعمل بنجاح 🚀\nالرابط: ${DOMAIN}` : `تم استلام رسالتك: ${text}`;

            await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, text: reply })
            });
        }
        return res.status(200).json({ status: 'ok' });
    }

    return res.status(405).send('Method Not Allowed');
}
