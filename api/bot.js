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

    const defaults = {
        'syriatel': '87524496',
        'syriatel_apk': 'https://t.me/A_ToolsX',
        'syriatel_video': 'https://t.me/A_ToolsX',
        'shamcash': '0912345678',
        'shamcash_apk': 'https://t.me/A_ToolsX',
        'shamcash_video': 'https://t.me/A_ToolsX',
        'usdt': 'TXXXXXXXXXXXXXX',
        'usdt_apk': 'https://t.me/A_ToolsX',
        'usdt_video': 'https://t.me/A_ToolsX',
        'deposit_bonus_percent': '10',
        'withdraw_discount_percent': '10'
    };

    for (const [key, val] of Object.entries(defaults)) {
        const check = await dbInstance.get('SELECT setting_value FROM settings WHERE setting_key = ?', [key]);
        if (!check) {
            await dbInstance.run('INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)', [key, val]);
        }
    }

    return dbInstance;
}

async function getSetting(key, def = '') {
    const db = await getDb();
    const row = await db.get('SELECT setting_value FROM settings WHERE setting_key = ?', [key]);
    return (row && row.setting_value !== undefined) ? row.setting_value : def;
}

async function setSetting(key, val) {
    const db = await getDb();
    await db.run('INSERT OR REPLACE INTO settings (setting_key, setting_value) VALUES (?, ?)', [key, val]);
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
            user = { user_id: userId, balance: 0, ichancy_user: null, ichancy_pass: null };
        }
        return user;
    }

    async function updateBalance(userId, amount) {
        const db = await getDb();
        await db.run('UPDATE users SET balance = balance + ? WHERE user_id = ?', [amount, userId]);
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
        
        if (userId === ADMIN_ID) {
            buttons.unshift([Markup.button.callback('⚙️ لوحة تحكم الأدمن', 'admin_panel')]);
        }

        const keyboard = Markup.inlineKeyboard(buttons);
        try {
            if (ctx.callbackQuery) {
                return await ctx.editMessageText(msg, { parse_mode: 'Markdown', ...keyboard });
            }
            return await ctx.reply(msg, { parse_mode: 'Markdown', ...keyboard });
        } catch (e) {
            return await ctx.reply(msg, { parse_mode: 'Markdown', ...keyboard });
        }
    }

    bot.start(async (ctx) => {
        const userId = ctx.from.id;
        delete userStates[userId];
        const user = await getUser(userId);
        return sendMainMenu(ctx, user);
    });

    bot.command(['account', 'deposit', 'withdraw', 'support'], async (ctx) => {
        const user = await getUser(ctx.from.id);
        return sendMainMenu(ctx, user);
    });

    bot.action('main_menu', async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        delete userStates[ctx.from.id];
        const user = await getUser(ctx.from.id);
        return sendMainMenu(ctx, user);
    });

    bot.action('admin_panel', async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        if (ctx.from.id !== ADMIN_ID) return;
        return ctx.editMessageText(`⚙️ **لوحة تحكم الأدمن:**\n\nلإدارة وتعديل الأرقام، التطبيقات، وفيديوهات الشرح، افتح موقعك على Vercel من المتصفح.`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([[Markup.button.callback('رجوع ↩️', 'main_menu')]])
        });
    });

    bot.action('deposit_menu', async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        return ctx.editMessageText('اختر طريقة الشحن المتاحة:', Markup.inlineKeyboard([
            [Markup.button.callback('سيرياتيل كاش 📱', 'pay_syriatel')],
            [Markup.button.callback('شام كاش 💳', 'pay_shamcash')],
            [Markup.button.callback('USDT 🌐', 'pay_usdt')],
            [Markup.button.callback('رجوع ↩️', 'main_menu')]
        ]));
    });

    bot.action(/^pay_/, async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        const userId = ctx.from.id;
        const method = ctx.match[0];
        
        let num = '';
        let name = '';
        let apkUrl = '';
        let videoUrl = '';

        if (method === 'pay_syriatel') {
            num = await getSetting('syriatel', '87524496');
            apkUrl = await getSetting('syriatel_apk', 'https://t.me/A_ToolsX');
            videoUrl = await getSetting('syriatel_video', 'https://t.me/A_ToolsX');
            name = 'سيرياتيل كاش';
        } else if (method === 'pay_shamcash') {
            num = await getSetting('shamcash', '0912345678');
            apkUrl = await getSetting('shamcash_apk', 'https://t.me/A_ToolsX');
            videoUrl = await getSetting('shamcash_video', 'https://t.me/A_ToolsX');
            name = 'شام كاش';
        } else if (method === 'pay_usdt') {
            num = await getSetting('usdt', 'TXXXXXXXXXXXXXX');
            apkUrl = await getSetting('usdt_apk', 'https://t.me/A_ToolsX');
            videoUrl = await getSetting('usdt_video', 'https://t.me/A_ToolsX');
            name = 'USDT';
        }

        userStates[userId] = 'awaiting_transaction_number';
        pendingDeposits[userId] = { paymentMethod: name };

        return ctx.editMessageText(`⚡ قم بالتحويل عبر **${name}** إلى الحساب التالي:\n\n\`${num}\`\n\nأدخل رقم العملية لتأكيد الشحن:`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.url(`تطبيق ${name} APK 📱`, apkUrl), Markup.button.url('فيديو الشرح 🎬', videoUrl)],
                [Markup.button.callback('إلغاء ❌', 'main_menu')]
            ])
        });
    });

    bot.action('account_menu', async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        const userId = ctx.from.id;
        const user = await getUser(userId);
        if (!user.ichancy_user) {
            userStates[userId] = 'awaiting_account_creation';
            return ctx.editMessageText('⚡ أدخل اسم المستخدم المراد إنشاؤه فوراً على آيسانسي:', Markup.inlineKeyboard([
                [Markup.button.callback('إلغاء ↩️', 'main_menu')]
            ]));
        } else {
            return ctx.editMessageText(`⚡ تفاصيل حسابك الفوري على آيسانسي:\n\nالمستخدم: \`${user.ichancy_user}\`\nكلمة المرور: \`${user.ichancy_pass}\``, {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('سحب رصيد 💸', 'withdraw_menu'), Markup.button.callback('شحن رصيد 🪙', 'deposit_menu')],
                    [Markup.button.callback('رجوع ↩️', 'main_menu')]
                ])
            });
        }
    });

    bot.action('withdraw_menu', async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        userStates[ctx.from.id] = 'awaiting_withdraw_account';
        pendingWithdrawals[ctx.from.id] = {};
        return ctx.editMessageText('⚡ أدخل رقم الحساب أو المحفظة المراد السحب إليها فوراً:', Markup.inlineKeyboard([
            [Markup.button.callback('إلغاء ❌', 'main_menu')]
        ]));
    });

    bot.action('promo', async (ctx) => {
        await ctx.answerCbQuery('لا يوجد كود نشط حالياً ⚠️', { show_alert: true });
    });

    bot.action('gift_menu', async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        userStates[ctx.from.id] = 'awaiting_gift_target_id';
        pendingGifts[ctx.from.id] = {};
        return ctx.editMessageText('🎁 أدخل أيدي (ID) الصديق المراد إرسال الهدية له فوراً:', Markup.inlineKeyboard([
            [Markup.button.callback('إلغاء ❌', 'main_menu')]
        ]));
    });

    bot.action('referrals_menu', async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        const userId = ctx.from.id;
        const db = await getDb();
        const row = await db.get('SELECT COUNT(*) as count FROM users WHERE referrer_id = ?', [userId]);
        return ctx.editMessageText(`👥 **الإحالات الفورية**\n\nعدد إحالاتك: ${row ? row.count : 0}`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([[Markup.button.callback('رجوع ↩️', 'main_menu')]])
        });
    });

    bot.action('support_menu', async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        userStates[ctx.from.id] = 'awaiting_support_message';
        return ctx.editMessageText('💬 أكتب رسالتك للدعم وستصل للإدارة فوراً:', Markup.inlineKeyboard([
            [Markup.button.callback('إلغاء ❌', 'main_menu')]
        ]));
    });

    bot.action('logs_menu', async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        const userId = ctx.from.id;
        const db = await getDb();
        const txs = await db.all('SELECT * FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT 5', [userId]);
        let msg = '📄 **آخر العمليات الخاصة بك:**\n\n';
        if (txs.length === 0) {
            msg += 'لا توجد عمليات سابقة.';
        } else {
            txs.forEach(t => {
                msg += `- النوع: ${t.type} | المبلغ: ${t.amount} | الحالة: ${t.status}\n`;
            });
        }
        return ctx.editMessageText(msg, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([[Markup.button.callback('رجوع ↩️', 'main_menu')]])
        });
    });

    bot.action('offers', async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        const b = await getSetting('deposit_bonus_percent', '10');
        const d = await getSetting('withdraw_discount_percent', '10');
        return ctx.editMessageText(`🎁 **العروض الفورية النشطة:**\n\n✨ بونص إيداع: +${b}%\n🔻 عمولة سحب: ${d}%`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([[Markup.button.callback('رجوع ↩️', 'main_menu')]])
        });
    });

    bot.action('terms', async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        return ctx.editMessageText('⚠️ **شروط الاستخدام:**\n\nيجب التأكد من إدخال رقم العملية الصحيح والمبلغ المطابق لضمان سرعة معالجة طلبك.', {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([[Markup.button.callback('رجوع ↩️', 'main_menu')]])
        });
    });

    bot.on('text', async (ctx) => {
        try {
            const userId = ctx.from.id;
            const state = userStates[userId];
            const text = ctx.message.text.trim();
            const db = await getDb();

            if (state === 'awaiting_account_creation') {
                const pass = Math.random().toString(36).slice(-6);
                await db.run('UPDATE users SET ichancy_user = ?, ichancy_pass = ? WHERE user_id = ?', [text, pass, userId]);
                delete userStates[userId];
                await ctx.reply('✅ تم إنشاء حسابك على آيسانسي بنجاح!');
                return sendMainMenu(ctx, await getUser(userId));
            }

            if (state === 'awaiting_transaction_number') {
                if (!pendingDeposits[userId]) pendingDeposits[userId] = {};
                pendingDeposits[userId].transactionId = text;
                userStates[userId] = 'awaiting_deposit_amount';
                return ctx.reply('✅ تم استلام رقم العملية. أدخل المبلغ المراد شحنه:');
            }

            if (state === 'awaiting_deposit_amount') {
                const amount = parseFloat(text);
                if (isNaN(amount) || amount <= 0) return ctx.reply('❌ يرجى إدخال مبلغ صحيح.');
                const bonus = parseFloat(await getSetting('deposit_bonus_percent', '10'));
                const net = amount + (amount * (bonus / 100));
                
                const depositData = pendingDeposits[userId] || {};
                const txId = depositData.transactionId || 'غير محدد';
                const method = depositData.paymentMethod || 'طريقة إلكترونية';

                delete userStates[userId];
                delete pendingDeposits[userId];

                const res = await db.run(
                    'INSERT INTO transactions (user_id, type, amount, net_amount, transaction_id, target_account, status) VALUES (?, "deposit", ?, ?, ?, ?, "pending")',
                    [userId, amount, net, txId, method]
                );

                await ctx.reply('⏳ تم إرسال طلب الشحن للإدارة للمراجعة الفورية.');
                await bot.telegram.sendMessage(ADMIN_ID, `📥 **طلب شحن جديد (#${res.lastID})**\n\n👤 ID: \`${userId}\`\n💳 الطريقة: \`${method}\`\n🔢 العملية: \`${txId}\`\n💰 المبلغ: ${amount}\n🎁 مع البونص: **${net}**`, {
                    parse_mode: 'Markdown',
                    ...Markup.inlineKeyboard([
                        [Markup.button.callback(`✅ موافقة وشحن فوراً (${net})`, `approve_dep_${res.lastID}`), Markup.button.callback('❌ رفض', `reject_dep_${res.lastID}`)]
                    ])
                });
                return sendMainMenu(ctx, await getUser(userId));
            }

            if (state === 'awaiting_withdraw_account') {
                pendingWithdrawals[userId] = { targetAccount: text };
                userStates[userId] = 'awaiting_withdraw_amount';
                return ctx.reply('✅ تم حفظ الحساب. أدخل المبلغ المراد سحبه:');
            }

            if (state === 'awaiting_withdraw_amount') {
                const amount = parseFloat(text);
                const user = await getUser(userId);
                if (isNaN(amount) || amount <= 0 || user.balance < amount) {
                    delete userStates[userId];
                    await ctx.reply('❌ رصيدك غير كافي.');
                    return sendMainMenu(ctx, user);
                }
                const discount = parseFloat(await getSetting('withdraw_discount_percent', '10'));
                const net = amount - (amount * (discount / 100));
                const acc = pendingWithdrawals[userId].targetAccount;

                await updateBalance(userId, -amount);
                delete userStates[userId];
                delete pendingWithdrawals[userId];

                const res = await db.run(
                    'INSERT INTO transactions (user_id, type, amount, net_amount, target_account, status) VALUES (?, "withdraw", ?, ?, ?, "pending")',
                    [userId, amount, net, acc]
                );

                await ctx.reply(`✅ تم خصم ${amount} وإرسال طلب السحب للإدارة للمراجعة.`);
                await bot.telegram.sendMessage(ADMIN_ID, `📤 **طلب سحب جديد (#${res.lastID})**\n\n👤 ID: \`${userId}\`\n🏦 الحساب: \`${acc}\`\n💵 الصافي: **${net}**`, {
                    parse_mode: 'Markdown',
                    ...Markup.inlineKeyboard([
                        [Markup.button.callback('✅ تأكيد السحب فوراً', `approve_with_${res.lastID}`), Markup.button.callback('❌ رفض وإعادة الرصيد', `reject_with_${res.lastID}`)]
                    ])
                });
                return sendMainMenu(ctx, await getUser(userId));
            }

            if (state === 'awaiting_gift_target_id') {
                pendingGifts[userId] = { targetId: text };
                userStates[userId] = 'awaiting_gift_amount';
                return ctx.reply(`أدخل المبلغ المراد إهداؤه لـ \`${text}\`:`, { parse_mode: 'Markdown' });
            }

            if (state === 'awaiting_gift_amount') {
                const amount = parseFloat(text);
                const user = await getUser(userId);
                const targetId = pendingGifts[userId].targetId;

                if (isNaN(amount) || amount <= 0 || user.balance < amount) {
                    delete userStates[userId];
                    await ctx.reply('❌ رصيدك غير كافي.');
                    return sendMainMenu(ctx, user);
                }

                await updateBalance(userId, -amount);
                await updateBalance(targetId, amount);
                delete userStates[userId];
                delete pendingGifts[userId];

                await ctx.reply(`🎉 تم إرسال الهدية فوراً بنجاح!`);
                await bot.telegram.sendMessage(targetId, `🎁 **وصلتك هدية جديدة!**\nتم تحويل ${amount} إلى حسابك فوراً.`).catch(() => {});
                return sendMainMenu(ctx, await getUser(userId));
            }

            if (state === 'awaiting_support_message') {
                delete userStates[userId];
                await bot.telegram.sendMessage(ADMIN_ID, `💬 **رسالة دعم فورية**\n\n👤 ID: \`${userId}\`\n\n${text}`, { parse_mode: 'Markdown' });
                await ctx.reply('✅ تم إرسال رسالتك للإدارة بنجاح.');
                return sendMainMenu(ctx, await getUser(userId));
            }
        } catch (e) { console.error(e); }
    });

    bot.action(/^approve_dep_(\d+)$/, async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        const txId = ctx.match[1];
        const db = await getDb();
        const tx = await db.get('SELECT * FROM transactions WHERE id = ? AND status = "pending"', [txId]);
        if (tx) {
            await updateBalance(tx.user_id, tx.net_amount);
            await db.run('UPDATE transactions SET status = "approved" WHERE id = ?', [txId]);
            await ctx.editMessageText(`${ctx.callbackQuery.message.text}\n\n✅ **تمت الموافقة وشحن الرصيد فوراً.**`);
            await bot.telegram.sendMessage(tx.user_id, `🎉 تم شحن حسابك بمبلغ ${tx.net_amount} بنجاح!`).catch(() => {});
        }
    });

    bot.action(/^reject_dep_(\d+)$/, async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        const txId = ctx.match[1];
        const db = await getDb();
        const tx = await db.get('SELECT * FROM transactions WHERE id = ? AND status = "pending"', [txId]);
        if (tx) {
            await db.run('UPDATE transactions SET status = "rejected" WHERE id = ?', [txId]);
            await ctx.editMessageText(`${ctx.callbackQuery.message.text}\n\n❌ **تم رفض الشحن.**`);
            await bot.telegram.sendMessage(tx.user_id, `❌ عذراً، تم رفض طلب الشحن الخاص بك.`).catch(() => {});
        }
    });

    bot.action(/^approve_with_(\d+)$/, async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        const txId = ctx.match[1];
        const db = await getDb();
        const tx = await db.get('SELECT * FROM transactions WHERE id = ? AND status = "pending"', [txId]);
        if (tx) {
            await db.run('UPDATE transactions SET status = "approved" WHERE id = ?', [txId]);
            await ctx.editMessageText(`${ctx.callbackQuery.message.text}\n\n✅ **تم تأكيد السحب فوراً.**`);
            await bot.telegram.sendMessage(tx.user_id, `🎉 تم إتمام وتحويل عملية السحب بنجاح!`).catch(() => {});
        }
    });

    bot.action(/^reject_with_(\d+)$/, async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        const txId = ctx.match[1];
        const db = await getDb();
        const tx = await db.get('SELECT * FROM transactions WHERE id = ? AND status = "pending"', [txId]);
        if (tx) {
            await updateBalance(tx.user_id, tx.amount);
            await db.run('UPDATE transactions SET status = "rejected" WHERE id = ?', [txId]);
            await ctx.editMessageText(`${ctx.callbackQuery.message.text}\n\n❌ **تم رفض السحب وإعادة المبلغ للرصيد فوراً.**`);
            await bot.telegram.sendMessage(tx.user_id, `❌ تم رفض السحب وإعادة مبلغ ${tx.amount} إلى رصيدك.`).catch(() => {});
        }
    });

    botInstance = bot;
    return bot;
}

module.exports = async (req, res) => {
    try {
        await getDb();

        let body = req.body;
        if (typeof body === 'string') {
            try { body = JSON.parse(body); } catch (e) { body = {}; }
        }

        if (req.method === 'GET') {
            const s = await getSetting('syriatel', '');
            const s_apk = await getSetting('syriatel_apk', '');
            const s_vid = await getSetting('syriatel_video', '');

            const sh = await getSetting('shamcash', '');
            const sh_apk = await getSetting('shamcash_apk', '');
            const sh_vid = await getSetting('shamcash_video', '');

            const us = await getSetting('usdt', '');
            const us_apk = await getSetting('usdt_apk', '');
            const us_vid = await getSetting('usdt_video', '');

            const bo = await getSetting('deposit_bonus_percent', '10');
            const di = await getSetting('withdraw_discount_percent', '10');

            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.status(200).send(`
                <!DOCTYPE html>
                <html lang="ar" dir="rtl">
                <head>
                    <meta charset="UTF-8">
                    <title>لوحة تحكم بوت سوخوي المالي</title>
                    <style>
                        body { font-family: Tahoma, sans-serif; background: #0f172a; color: #f8fafc; padding: 20px; direction: rtl; }
                        .container { max-width: 700px; margin: 0 auto; background: #1e293b; padding: 30px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); }
                        h2 { text-align: center; color: #38bdf8; margin-bottom: 25px; }
                        fieldset { border: 1px solid #475569; border-radius: 8px; padding: 15px; margin-bottom: 20px; }
                        legend { color: #38bdf8; font-weight: bold; padding: 0 10px; }
                        .form-group { margin-bottom: 12px; }
                        label { display: block; margin-bottom: 4px; color: #cbd5e1; font-size: 14px; }
                        input { width: 100%; padding: 9px; background: #0f172a; border: 1px solid #475569; border-radius: 6px; color: white; box-sizing: border-box; }
                        button { width: 100%; padding: 12px; background: #2563eb; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; margin-top: 10px; font-size: 16px; }
                        button:hover { background: #1d4ed8; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h2>🚀 لوحة إدارة بوت سوخوي (الحسابات والروابط)</h2>
                        <form method="POST">
                            <fieldset>
                                <legend>📱 سيرياتيل كاش</legend>
                                <div class="form-group"><label>رقم الحساب:</label><input type="text" name="syriatel" value="${s}"></div>
                                <div class="form-group"><label>رابط تطبيق APK الخاص:</label><input type="text" name="syriatel_apk" value="${s_apk}"></div>
                                <div class="form-group"><label>رابط فيديو الشرح وسعر الصرف:</label><input type="text" name="syriatel_video" value="${s_vid}"></div>
                            </fieldset>

                            <fieldset>
                                <legend>💳 شام كاش</legend>
                                <div class="form-group"><label>رقم الحساب:</label><input type="text" name="shamcash" value="${sh}"></div>
                                <div class="form-group"><label>رابط تطبيق APK الخاص:</label><input type="text" name="shamcash_apk" value="${sh_apk}"></div>
                                <div class="form-group"><label>رابط فيديو الشرح وسعر الصرف:</label><input type="text" name="shamcash_video" value="${sh_vid}"></div>
                            </fieldset>

                            <fieldset>
                                <legend>🌐 USDT</legend>
                                <div class="form-group"><label>رابط المحفظة:</label><input type="text" name="usdt" value="${us}"></div>
                                <div class="form-group"><label>رابط تطبيق/محفظة APK الخاص:</label><input type="text" name="usdt_apk" value="${us_apk}"></div>
                                <div class="form-group"><label>رابط فيديو الشرح وسعر الصرف:</label><input type="text" name="usdt_video" value="${us_vid}"></div>
                            </fieldset>

                            <fieldset>
                                <legend>⚙️ النِسب العامة</legend>
                                <div class="form-group"><label>🎁 بونص الإيداع (%):</label><input type="text" name="deposit_bonus_percent" value="${bo}"></div>
                                <div class="form-group"><label>🔻 عمولة السحب (%):</label><input type="text" name="withdraw_discount_percent" value="${di}"></div>
                            </fieldset>

                            <button type="submit">💾 حفظ كافة التحديثات فوراً</button>
                        </form>
                    </div>
                </body>
                </html>
            `);
        }

        if (req.method === 'POST' && body && Object.keys(body).length > 0 && !body.update_id) {
            for (const [k, v] of Object.entries(body)) {
                await setSetting(k, v);
            }
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.status(200).send(`
                <body style="background:#0f172a;color:#4ade80;text-align:center;padding-top:50px;font-family:Tahoma;">
                    <h2>✅ تم تحديث الأرقام، تطبيقات APK، وفيديوهات الشرح وسعر الصرف بنجاح تام!</h2>
                    <br><a href="/" style="color:#38bdf8;text-decoration:none;font-size:18px;">⬅️ العودة للوحة التحكم</a>
                </body>
            `);
        }

        const bot = getBot();
        if (body && body.update_id) {
            await bot.handleUpdate(body);
            return res.status(200).json({ status: 'success' });
        }
        
        return res.status(200).send('Sukhoi Bot Vercel Webhook is active and ready!');
    } catch (e) {
        console.error('Vercel Handler Error:', e);
        return res.status(500).json({ error: e.message });
    }
};
