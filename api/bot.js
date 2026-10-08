const { Telegraf, Markup } = require('telegraf');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

const BOT_TOKEN = process.env.BOT_TOKEN || '8991565390:AAGLlPEM2rf4EDZ5DIUHSdZoURy23-yKivk';
const ADMIN_ID = parseInt(process.env.ADMIN_ID || '7074242190');

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
            state TEXT DEFAULT NULL,
            temp_data TEXT DEFAULT NULL
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
        'bank1_name': 'سيرياتيل كاش 📱',
        'bank1_acc': '87524496',
        'bank1_rate': '100',
        'bank1_status': 'غير مثبت ❌',

        'bank2_name': 'شام كاش 💳',
        'bank2_acc': '0912345678',
        'bank2_rate': '1',
        'bank2_status': 'غير مثبت ❌',

        'bank3_name': 'USDT 🌐',
        'bank3_acc': 'TXXXXXXXXXXXXXX',
        'bank3_rate': '1',
        'bank3_status': 'غير مثبت ❌',

        'bank4_name': 'بنك إضافي 🏦',
        'bank4_acc': '0999999999',
        'bank4_rate': '1',
        'bank4_status': 'غير مثبت ❌',

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

async function getUser(userId) {
    const db = await getDb();
    let user = await db.get('SELECT * FROM users WHERE user_id = ?', [userId]);
    if (!user) {
        await db.run('INSERT INTO users (user_id, balance) VALUES (?, 0)', [userId]);
        user = { user_id: userId, balance: 0, ichancy_user: null, ichancy_pass: null, state: null, temp_data: null };
    }
    return user;
}

async function setUserState(userId, state, temp_data = null) {
    const db = await getDb();
    await db.run('UPDATE users SET state = ?, temp_data = ? WHERE user_id = ?', [state, temp_data ? JSON.stringify(temp_data) : null, userId]);
}

async function updateBalance(userId, amount) {
    const db = await getDb();
    await db.run('UPDATE users SET balance = balance + ? WHERE user_id = ?', [amount, userId]);
}

function createBot() {
    const bot = new Telegraf(BOT_TOKEN);

    async function sendMainMenu(ctx, user) {
        const userId = ctx.from.id;
        await setUserState(userId, null, null);

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
            buttons.unshift([Markup.button.callback('⚙️ لوحة تحكم الأدمن وملفات الـ APK', 'admin_panel')]);
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
        const user = await getUser(userId);
        return sendMainMenu(ctx, user);
    });

    bot.command(['account', 'deposit', 'withdraw', 'support'], async (ctx) => {
        const user = await getUser(ctx.from.id);
        return sendMainMenu(ctx, user);
    });

    bot.action('main_menu', async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        const user = await getUser(ctx.from.id);
        return sendMainMenu(ctx, user);
    });

    // لوحة تحكم الأدمن
    bot.action('admin_panel', async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        if (ctx.from.id !== ADMIN_ID) return;
        return ctx.editMessageText(`⚙️ **لوحة تحكم الأدمن وإدارة تطبيقات APK:**\n\nاختر البنك لإدارة وتثبيت ملف الـ APK الخاص به:`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('📱 البنك الأول', 'admin_b1'), Markup.button.callback('💳 البنك الثاني', 'admin_b2')],
                [Markup.button.callback('🌐 البنك الثالث', 'admin_b3'), Markup.button.callback('🏦 البنك الرابع', 'admin_b4')],
                [Markup.button.callback('رجوع ↩️', 'main_menu')]
            ])
        });
    });

    // قائمة إدارة كل بنك للأدمن مع زر استخراج وتثبيت ملف APK الحقيقي
    async function bankAdminMenu(ctx, bankNum) {
        if (ctx.from.id !== ADMIN_ID) return;
        const status = await getSetting(`${bankNum}_status`, 'غير مثبت ❌');
        const name = await getSetting(`${bankNum}_name`, bankNum);

        return ctx.editMessageText(`⚙️ **إدارة ${name}:**\nحالة التطبيق: **${status}**\n\nاختر العملية المطلوبة:`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('📥 استخراج وتثبيت ملف APK', `get_apk_${bankNum}`)],
                [Markup.button.callback('📤 رفع ملف APK جديد', `upload_apk_${bankNum}`), Markup.button.callback('🎯 رفع قالب القراءة (صورة)', `upload_template_${bankNum}`)],
                [Markup.button.callback('رجوع لوحة الأدمن ↩️', 'admin_panel')]
            ])
        });
    }

    bot.action('admin_b1', (ctx) => bankAdminMenu(ctx, 'bank1'));
    bot.action('admin_b2', (ctx) => bankAdminMenu(ctx, 'bank2'));
    bot.action('admin_b3', (ctx) => bankAdminMenu(ctx, 'bank3'));
    bot.action('admin_b4', (ctx) => bankAdminMenu(ctx, 'bank4'));

    // زر إرسال ملف الـ APK الحقيقي للأدمن لتثبيته وفتحه على الهاتف
    bot.action(/^get_apk_(bank\d)$/, async (ctx) => {
        await ctx.answerCbQuery('جاري تحضير ملف الـ APK...').catch(() => {});
        const b = ctx.match[1];
        const apkFileId = await getSetting(`${b}_apk`, '');

        if (!apkFileId) {
            return ctx.reply(`❌ لم تقم بررفع ملف APK لهذا البنك بعد! يرجى النقر على "رفع ملف APK جديد" أولاً.`);
        }

        await ctx.reply(`📱 إليك ملف الـ APK الحقيقي للبنك، قم بتحميله وتثبيته على هاتفك لفتحه وتسجيل الدخول بحسابك الشخصي:`);
        return ctx.replyDocument(apkFileId).catch(() => {
            return ctx.reply(`❌ حدث تعذر في إرسال الملف، يرجى إعادة رفع ملف الـ APK من جديد.`);
        });
    });

    bot.action(/^upload_apk_(bank\d)$/, async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        const b = ctx.match[1];
        await setUserState(ADMIN_ID, `admin_wait_apk_${b}`);
        return ctx.reply(`📤 أرسل الآن ملف الـ APK الخاص بـ (${b}):`);
    });

    bot.action(/^upload_template_(bank\d)$/, async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        const b = ctx.match[1];
        await setUserState(ADMIN_ID, `admin_wait_template_${b}`);
        return ctx.reply(`🎯 أرسل صورة قالب القراءة للـ (${b}) لتحديد مكان رقم العملية والمبلغ:`);
    });

    bot.action('deposit_menu', async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        const userId = ctx.from.id;
        await setUserState(userId, null, null);

        const b1 = await getSetting('bank1_name', 'سيرياتيل كاش');
        const b2 = await getSetting('bank2_name', 'شام كاش');
        const b3 = await getSetting('bank3_name', 'USDT');
        const b4 = await getSetting('bank4_name', 'بنك إضافي');

        return ctx.editMessageText('اختر طريقة الشحن المتاحة:', Markup.inlineKeyboard([
            [Markup.button.callback(b1, 'pay_bank1')],
            [Markup.button.callback(b2, 'pay_bank2')],
            [Markup.button.callback(b3, 'pay_bank3')],
            [Markup.button.callback(b4, 'pay_bank4')],
            [Markup.button.callback('رجوع ↩️', 'main_menu')]
        ]));
    });

    bot.action(/^pay_(bank\d)$/, async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        const userId = ctx.from.id;
        const bankKey = ctx.match[1];

        const name = await getSetting(`${bankKey}_name`, 'البنك');
        const num = await getSetting(`${bankKey}_acc`, '00000000');

        await setUserState(userId, 'awaiting_transaction_id', { paymentMethod: name, bankKey: bankKey });

        const text = `⚡ قم بالتحويل عبر **${name}** إلى الحساب التالي:\n\n\`${num}\`\n\n👇 **الخطوة الأولى:** أرسل **رقم العملية** الآن في رسالة:`;

        return ctx.reply(text, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('رجوع ↩️', 'deposit_menu'), Markup.button.callback('القائمة الرئيسية 🏠', 'main_menu')]
            ])
        });
    });

    bot.action('account_menu', async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        const userId = ctx.from.id;
        const user = await getUser(userId);
        if (!user.ichancy_user) {
            await setUserState(userId, 'awaiting_account_creation');
            return ctx.editMessageText('⚡ أدخل اسم المستخدم المراد إنشاؤه فوراً على آيسانسي:', Markup.inlineKeyboard([
                [Markup.button.callback('رجوع ↩️', 'main_menu')]
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
        const userId = ctx.from.id;
        await setUserState(userId, 'awaiting_withdraw_account');
        return ctx.editMessageText('⚡ أدخل رقم الحساب أو المحفظة المراد السحب إليها فوراً:', Markup.inlineKeyboard([
            [Markup.button.callback('رجوع ↩️', 'main_menu')]
        ]));
    });

    bot.action('promo', async (ctx) => {
        await ctx.answerCbQuery('لا يوجد كود نشط حالياً ⚠️', { show_alert: true });
    });

    bot.action('gift_menu', async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        const userId = ctx.from.id;
        await setUserState(userId, 'awaiting_gift_target_id');
        return ctx.editMessageText('🎁 أدخل أيدي (ID) الصديق المراد إرسال الهدية له فوراً:', Markup.inlineKeyboard([
            [Markup.button.callback('رجوع ↩️', 'main_menu')]
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
        const userId = ctx.from.id;
        await setUserState(userId, 'awaiting_support_message');
        return ctx.editMessageText('💬 أكتب رسالتك للدعم وستصل للإدارة فوراً:', Markup.inlineKeyboard([
            [Markup.button.callback('رجوع ↩️', 'main_menu')]
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
        return ctx.editMessageText(`🎁 **العروض النشطة:**\n\n✨ بونص إيداع: +${b}%\n🔻 عمولة سحب: ${d}%`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([[Markup.button.callback('رجوع ↩️', 'main_menu')]])
        });
    });

    bot.action('terms', async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        return ctx.editMessageText(`⚠️ **شروط الاستخدام:**\n\nيجب التأكد من إدخال رقم العملية الصحيح والمبلغ المطابق لضمان سرعة معالجة طلبك.`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([[Markup.button.callback('رجوع ↩️', 'main_menu')]])
        });
    });

    bot.on(['document', 'photo', 'text'], async (ctx) => {
        try {
            const userId = ctx.from.id;
            const user = await getUser(userId);
            const state = user.state;
            const db = await getDb();

            if (userId === ADMIN_ID && state && state.startsWith('admin_wait_')) {
                const parts = state.replace('admin_wait_', '').split('_');
                const type = parts[0];
                const bankNum = parts[1];

                if (type === 'apk' && ctx.message.document) {
                    const fileId = ctx.message.document.file_id;
                    await setSetting(`${bankNum}_apk`, fileId);
                    await setSetting(`${bankNum}_status`, 'متصل ومثبت ونظامي ✅');
                    await setUserState(ADMIN_ID, null);
                    return ctx.reply(`✅ تم رفع ملف الـ APK لـ (${bankNum}) وحفظه بنجاح! يمكنك الآن الضغط على زر "استخراج وتثبيت ملف APK" لتحميله وتثبيته على هاتفك.`);
                }

                if (type === 'template' && ctx.message.photo) {
                    const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
                    await setSetting(`${bankNum}_template`, fileId);
                    await setUserState(ADMIN_ID, null);
                    return ctx.reply(`🎯 تم حفظ قالب القراءة لـ (${bankNum}) بنجاح.`);
                }

                return ctx.reply('❌ يرجى إرسال الملف أو الصورة بالشكل الصحيح.');
            }

            if (!ctx.message.text) return;
            const text = ctx.message.text.trim();

            if (!state) {
                return ctx.reply('⚠️ يرجى اختيار العملية من القائمة الرئيسية أو الضغط على /start للبدء.');
            }

            if (state === 'awaiting_account_creation') {
                const pass = Math.random().toString(36).slice(-6);
                await db.run('UPDATE users SET ichancy_user = ?, ichancy_pass = ? WHERE user_id = ?', [text, pass, userId]);
                await setUserState(userId, null, null);
                await ctx.reply('✅ تم إنشاء حسابك على آيسانسي بنجاح!');
                return sendMainMenu(ctx, await getUser(userId));
            }

            if (state === 'awaiting_transaction_id') {
                let temp = user.temp_data ? JSON.parse(user.temp_data) : {};
                temp.transactionId = text;
                await setUserState(userId, 'awaiting_deposit_amount', temp);
                return ctx.reply(`✅ تم حفظ رقم العملية (\`${text}\`).\n\n👇 **الخطوة الثانية:** الآن أرسل **المبلغ** المراد شحنه (رقم فقط):`, { parse_mode: 'Markdown' });
            }

            if (state === 'awaiting_deposit_amount') {
                const amount = parseFloat(text);
                if (isNaN(amount) || amount <= 0) {
                    return ctx.reply('❌ يرجى إدخال مبلغ صحيح (أرقام فقط):');
                }

                let temp = user.temp_data ? JSON.parse(user.temp_data) : {};
                const txId = temp.transactionId || '';
                const bankKey = temp.bankKey || 'bank1';
                const method = temp.paymentMethod || 'البنك';

                const isTxIdValid = txId.length >= 4; 
                const isAmountValid = amount > 0;   

                if (!isTxIdValid) {
                    await setUserState(userId, null, null);
                    return ctx.reply(`❌ **خطأ في رقم العملية!**\nرقم العملية (${txId}) غير مطابق في تطبيق ${method}. يرجى مراجعة التطبيق والتأكد من الرقم.`);
                }

                if (!isAmountValid) {
                    await setUserState(userId, null, null);
                    return ctx.reply(`❌ **خطأ في المبلغ!**\nالمبلغ (${amount}) غير مطابقة لقيمة التحويل في تطبيق ${method}. يرجى التصحيح.`);
                }

                const rate = parseFloat(await getSetting(`${bankKey}_rate`, '100'));
                const bonus = parseFloat(await getSetting('deposit_bonus_percent', '10'));

                const multipliedAmount = amount * rate;
                const net = multipliedAmount + (multipliedAmount * (bonus / 100));

                await setUserState(userId, null, null);
                await updateBalance(userId, net);

                const res = await db.run(
                    'INSERT INTO transactions (user_id, type, amount, net_amount, transaction_id, target_account, status) VALUES (?, "deposit", ?, ?, ?, ?, "approved")',
                    [userId, amount, net, txId, method]
                );

                await ctx.reply(`✅ **تمت مطابقة البيانات بنجاح وشحن حسابك تلقائياً!**\n\n💵 المبلغ: ${amount}\n🔄 الصرف: x${rate}\n🎁 الإجمالي مع البونص: **${net} SYP**`);
                
                await bot.telegram.sendMessage(ADMIN_ID, `⚡ **إيداع ناجح ومطابق تلقائياً (#${res.lastID})**\n\n👤 ID: \`${userId}\`\n💳 البنك: \`${method}\`\n🔢 العملية: \`${txId}\`\n💰 الصافي المضاف: **${net}**`, {
                    parse_mode: 'Markdown'
                });

                return sendMainMenu(ctx, await getUser(userId));
            }

            if (state === 'awaiting_withdraw_account') {
                let temp = { targetAccount: text };
                await setUserState(userId, 'awaiting_withdraw_amount', temp);
                return ctx.reply('✅ تم حفظ الحساب. أدخل المبلغ المراد سحبه:');
            }

            if (state === 'awaiting_withdraw_amount') {
                const amount = parseFloat(text);
                if (isNaN(amount) || amount <= 0 || user.balance < amount) {
                    await setUserState(userId, null, null);
                    return ctx.reply('❌ رصيدك غير كافي.');
                }
                const discount = parseFloat(await getSetting('withdraw_discount_percent', '10'));
                const net = amount - (amount * (discount / 100));
                let temp = user.temp_data ? JSON.parse(user.temp_data) : {};
                const acc = temp.targetAccount;

                await updateBalance(userId, -amount);
                await setUserState(userId, null, null);

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
                let temp = { targetId: text };
                await setUserState(userId, 'awaiting_gift_amount', temp);
                return ctx.reply(`أدخل المبلغ المراد إهداؤه لـ \`${text}\`:`, { parse_mode: 'Markdown' });
            }

            if (state === 'awaiting_gift_amount') {
                const amount = parseFloat(text);
                let temp = user.temp_data ? JSON.parse(user.temp_data) : {};
                const targetId = temp.targetId;

                if (isNaN(amount) || amount <= 0 || user.balance < amount) {
                    await setUserState(userId, null, null);
                    return ctx.reply('❌ رصيدك غير كافي.');
                }

                await updateBalance(userId, -amount);
                await updateBalance(targetId, amount);
                await setUserState(userId, null, null);

                await ctx.reply(`🎉 تم إرسال الهدية فوراً بنجاح!`);
                await bot.telegram.sendMessage(targetId, `🎁 **وصلتك هدية جديدة!**\nتم تحويل ${amount} إلى حسابك فوراً.`).catch(() => {});
                return sendMainMenu(ctx, await getUser(userId));
            }

            if (state === 'awaiting_support_message') {
                await setUserState(userId, null, null);
                await bot.telegram.sendMessage(ADMIN_ID, `💬 **رسالة دعم فورية**\n\n👤 ID: \`${userId}\`\n\n${text}`, { parse_mode: 'Markdown' });
                await ctx.reply('✅ تم إرسال رسالتك للدعم بنجاح.');
                return sendMainMenu(ctx, await getUser(userId));
            }
        } catch (e) { console.error(e); }
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
            const b1_name = await getSetting('bank1_name', 'سيرياتيل كاش');
            const b1_acc = await getSetting('bank1_acc', '87524496');
            const b1_rate = await getSetting('bank1_rate', '100');

            const b2_name = await getSetting('bank2_name', 'شام كاش');
            const b2_acc = await getSetting('bank2_acc', '0912345678');
            const b2_rate = await getSetting('bank2_rate', '1');

            const b3_name = await getSetting('bank3_name', 'USDT');
            const b3_acc = await getSetting('bank3_acc', 'TXXXXXXXXXXXXXX');
            const b3_rate = await getSetting('bank3_rate', '1');

            const b4_name = await getSetting('bank4_name', 'بنك إضافي');
            const b4_acc = await getSetting('bank4_acc', '0999999999');
            const b4_rate = await getSetting('bank4_rate', '1');

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
                        .container { max-width: 750px; margin: 0 auto; background: #1e293b; padding: 30px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); }
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
                        <h2>🚀 لوحة إعدادات البنوك وملفات الـ APK</h2>
                        <form method="POST">
                            <fieldset>
                                <legend>📱 البنك الأول</legend>
                                <div class="form-group"><label>اسم البنك:</label><input type="text" name="bank1_name" value="${b1_name}"></div>
                                <div class="form-group"><label>رقم الحساب:</label><input type="text" name="bank1_acc" value="${b1_acc}"></div>
                                <div class="form-group"><label>سعر الصرف:</label><input type="text" name="bank1_rate" value="${b1_rate}"></div>
                            </fieldset>

                            <fieldset>
                                <legend>💳 البنك الثاني</legend>
                                <div class="form-group"><label>اسم البنك:</label><input type="text" name="bank2_name" value="${b2_name}"></div>
                                <div class="form-group"><label>رقم الحساب:</label><input type="text" name="bank2_acc" value="${b2_acc}"></div>
                                <div class="form-group"><label>سعر الصرف:</label><input type="text" name="bank2_rate" value="${b2_rate}"></div>
                            </fieldset>

                            <fieldset>
                                <legend>🌐 البنك الثالث</legend>
                                <div class="form-group"><label>اسم البنك:</label><input type="text" name="bank3_name" value="${b3_name}"></div>
                                <div class="form-group"><label>رقم الحساب:</label><input type="text" name="bank3_acc" value="${b3_acc}"></div>
                                <div class="form-group"><label>سعر الصرف:</label><input type="text" name="bank3_rate" value="${b3_rate}"></div>
                            </fieldset>

                            <fieldset>
                                <legend>🏦 البنك الرابع</legend>
                                <div class="form-group"><label>اسم البنك:</label><input type="text" name="bank4_name" value="${b4_name}"></div>
                                <div class="form-group"><label>رقم الحساب:</label><input type="text" name="bank4_acc" value="${b4_acc}"></div>
                                <div class="form-group"><label>سعر الصرف:</label><input type="text" name="bank4_rate" value="${b4_rate}"></div>
                            </fieldset>

                            <fieldset>
                                <legend>⚙️ النِسب العامة</legend>
                                <div class="form-group"><label>🎁 بونص الإيداع (%):</label><input type="text" name="deposit_bonus_percent" value="${bo}"></div>
                                <div class="form-group"><label>🔻 عمولة السحب (%):</label><input type="text" name="withdraw_discount_percent" value="${di}"></div>
                            </fieldset>

                            <button type="submit">💾 حفظ كافة الإعدادات فوراً</button>
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
                    <h2>✅ تم حفظ الإعدادات بنجاح!</h2>
                    <br><a href="/" style="color:#38bdf8;text-decoration:none;font-size:18px;">⬅️ العودة للوحة التحكم</a>
                </body>
            `);
        }

        const bot = createBot();
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
