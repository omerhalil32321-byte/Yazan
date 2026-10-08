const { Telegraf, Markup } = require('telegraf');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

const BOT_TOKEN = process.env.BOT_TOKEN || '8947458303:AAHTU5hlyre5kVNSxYxnGe7bFaUBbcVw_bk';
const ADMIN_ID = parseInt(process.env.ADMIN_ID || '7074242190');

const bot = new Telegraf(BOT_TOKEN);
let db;

async function getDb() {
    if (db) return db;
    db = await open({
        filename: '/tmp/database.sqlite',
        driver: sqlite3.Database
    });

    await db.exec(`
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

    const check = await db.get('SELECT setting_value FROM settings WHERE setting_key = "syriatel"');
    if (!check) {
        await db.run('INSERT INTO settings (setting_key, setting_value) VALUES ("syriatel", "87524496")');
        await db.run('INSERT INTO settings (setting_key, setting_value) VALUES ("shamcash", "0912345678")');
        await db.run('INSERT INTO settings (setting_key, setting_value) VALUES ("usdt", "TXXXXXXXXXXXXXX")');
        await db.run('INSERT INTO settings (setting_key, setting_value) VALUES ("deposit_bonus_percent", "10")');
        await db.run('INSERT INTO settings (setting_key, setting_value) VALUES ("withdraw_discount_percent", "10")');
    }
    return db;
}

// (جميع الأوامر والدوال تبقى هنا كما هي...)

bot.start(async (ctx) => {
    try {
        const userId = ctx.from.id;
        const database = await getDb();
        let user = await database.get('SELECT * FROM users WHERE user_id = ?', [userId]);
        if (!user) {
            await database.run('INSERT INTO users (user_id, balance) VALUES (?, 0)', [userId]);
            user = { user_id: userId, balance: 0 };
        }
        await ctx.reply(`📋 **مرحباً بك في بوت سوخوي**\n\n💰 الرصيد الحالي: ${user.balance || 0} SYP`);
    } catch (e) { console.error(e); }
});

// تصدير المعالج ليعمل كـ API على Vercel
module.exports = async (req, res) => {
    try {
        await getDb();
        if (req.method === 'POST') {
            await bot.handleUpdate(req.body);
            return res.status(200).send('OK');
        }
        return res.status(200).send('Sukhoi Bot API is active!');
    } catch (e) {
        console.error(e);
        return res.status(500).send('Error');
    }
};
