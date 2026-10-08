const { Telegraf, Markup } = require('telegraf');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

const BOT_TOKEN = process.env.BOT_TOKEN || '8991565390:AAGLlPEM2rf4EDZ5DIUHSdZoURy23-yKivk';
const ADMIN_ID = parseInt(process.env.ADMIN_ID || '7074242190');

let botInstance = null;
let dbInstance = null;

async function getDb() {
    if (dbInstance) return dbInstance;
    dbInstance = await open({
        filename: '/tmp/database.sqlite',
        driver: sqlite3.Database
    });

    await dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY,
            balance REAL DEFAULT 0,
            ichancy_user TEXT,
            ichancy_pass TEXT,
            referrer_id INTEGER
        );
        CREATE TABLE IF NOT EXISTS settings (
            setting_key TEXT PRIMARY KEY,
            setting_value TEXT
        );
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            type TEXT,
            amount REAL,
            net_amount REAL,
            transaction_id TEXT,
            target_account TEXT,
            status TEXT DEFAULT 'pending'
        );
    `);

    const check = await dbInstance.get('SELECT setting_value FROM settings WHERE setting_key = "syriatel"');
    if (!check) {
        await dbInstance.run('INSERT INTO settings (setting_key, setting_value) VALUES ("syriatel", "87524496")');
        await dbInstance.run('INSERT INTO settings (setting_key, setting_value) VALUES ("shamcash", "0912345678")');
        await dbInstance.run('INSERT INTO settings (setting_key, setting_value) VALUES ("usdt", "TXXXXXXXXXXXXXX")');
        await dbInstance.run('INSERT INTO settings (setting_key, setting_value) VALUES ("deposit_bonus_percent", "10")');
        await dbInstance.run('INSERT INTO settings (setting_key, setting_value) VALUES ("withdraw_discount_percent", "10")');
    }
    return dbInstance;
}

function getBot() {
    if (botInstance) return botInstance;
    const bot = new Telegraf(BOT_TOKEN);
    const userStates = {};
    const pendingDeposits = {};
    const pendingWithdrawals = {};
    const pendingGifts = {};

    async function getUser(userId) {
        const db = await getDb();
        let user = await db.get('SELECT * FROM users WHERE user_id = ?', [userId]);
        if (!user) {
            await db.run('INSERT INTO users (user_id, balance) VALUES (?, 0)', [userId]);
            user = { user_id: userId, balance: 0 };
        }
        return user;
    }

    async function sendMainMenu(ctx, user) {
        const userId = ctx.from.id;
        const msg = `📋 **قائمة الخيارات الرئيسية** \n\n💰 الرصيد الحالي: ${user.balance || 0} SYP\n🆔 أيدي حسابك: \`${userId}\``;
        const buttons = [
            [Markup.button.callback('حساب ايسانسي وشحنه ⚡', 'account_menu')],
            [Markup.button.callback('شحن رصيد في البوت 📥', 'deposit_menu'), Markup.button.callback('سحب رصيد من البوت 📤', 'withdraw_menu')],
            [Markup.button.callback('كود جائزة 🏆', 'promo'), Markup.button.callback('إهداء صديق 🎁', 'gift_menu')],
            [Markup.button.callback('الإحالات 💰', 'referrals_menu')],
            [Markup.button.callback('إرسال رسالة للدعم 💬', 'support_menu'), Markup.button.callback('السجلات 📄', 'logs_menu')],
            [Markup.button.callback('العروض النشطة 🎁', 'offers'), Markup.button.callback('شروط الاستخدام ⚠️', 'terms')]
        ];
        if (userId === ADMIN_ID) buttons.unshift([Markup.button.callback('⚙️ لوحة تحكم الأدمن', 'admin_panel')]);
        const keyboard = Markup.inlineKeyboard(buttons);
        try {
            if (ctx.callbackQuery) return await ctx.editMessageText(msg, { parse_mode: 'Markdown', ...keyboard });
            return await ctx.reply(msg, { parse_mode: 'Markdown', ...keyboard });
        } catch (e) {
            return await ctx.reply(msg, { parse_mode: 'Markdown', ...keyboard });
        }
    }

    bot.start(async (ctx) => {
        const user = await getUser(ctx.from.id);
        return sendMainMenu(ctx, user);
    });

    bot.action('main_menu', async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        const user = await getUser(ctx.from.id);
        return sendMainMenu(ctx, user);
    });

    botInstance = bot;
    return bot;
}

module.exports = async (req, res) => {
    try {
        await getDb();
        const bot = getBot();

        if (req.method === 'POST') {
            await bot.handleUpdate(req.body);
            return res.status(200).json({ status: 'success' });
        }
        return res.status(200).send('Sukhoi Bot Vercel Webhook is active and ready!');
    } catch (e) {
        console.error('Vercel Handler Error:', e);
        return res.status(500).json({ error: e.message });
    }
};
