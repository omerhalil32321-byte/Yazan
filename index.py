<?php
// إذا كان الطلب من المتصفح (GET) نسعرض صفحة HTML
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
?>
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>حالة البوت | Dank Bot</title>
    <style>
        body {
            font-family: system-ui, -apple-system, sans-serif;
            background-color: #0f172a;
            color: #f8fafc;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
        }
        .card {
            background-color: #1e293b;
            padding: 2rem;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.3);
            text-align: center;
            max-width: 400px;
            border: 1px solid #334155;
        }
        .status-badge {
            background-color: #10b981;
            color: #1e293b;
            font-weight: bold;
            padding: 6px 16px;
            border-radius: 20px;
            display: inline-block;
            margin-bottom: 1rem;
        }
        h1 { margin-bottom: 0.5rem; font-size: 1.5rem; }
        p { color: #94a3b8; font-size: 0.95rem; line-height: 1.5; }
    </style>
</head>
<body>
    <div class="card">
        <div class="status-badge">● يعمل بنجاح</div>
        <h1>Telegram Bot Webhook</h1>
        <p>البوت يعمل واستجابة الـ Webhook متصلة بنجاح 🚀</p>
    </div>
</body>
</html>
<?php
    exit();
}

// إذا كان الطلب قادماً من تيليجرام (POST) نعالج الرسالة
http_response_code(200);

$token = "8889976501:AAGqPijRKckYZDhuxUs1KPXTS6TFWtLyu0";
$apiUrl = "https://api.telegram.org/bot" . $token . "/";

$content = file_get_contents("php://input");
$update = json_decode($content, true);

if (isset($update["message"])) {
    $chatId = $update["message"]["chat"]["id"];
    $text = $update["message"]["text"] ?? '';

    if ($text === "/start") {
        $reply = "أهلاً بك! البوت يعمل بنجاح 🚀";
    } else {
        $reply = "تم استلام رسالتك: " . $text;
    }

    file_get_contents($apiUrl . "sendMessage?chat_id=" . $chatId . "&text=" . urlencode($reply));
}
?>
