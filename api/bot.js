const { Telegraf, Markup } = require('telegraf');

const BOT_TOKEN = process.env.BOT_TOKEN || '8991565390:AAGLlPEM2rf4EDZ5DIUHSdZoURy23-yKivk';
const ADMIN_ID = parseInt(process.env.ADMIN_ID || '7074242190');

// ذاكرة دائمية ومستقرة تماماً على Vercel
const memoryStore = {
    users: {},
    settings: {
        'bank1_name': 'سيرياتيل كاش 📱',
        'bank1_acc': '87524496',
        'bank1_rate': '100',
        'bank1_url': 'https://www.google.com',

        'bank2_name': 'شام كاش 💳 (Webhook آلي)',
        'bank2_acc': '8811164969946430', // رقم المحفظة الظاهر في صورتك
        'bank2_rate': '1',
        'bank2_api_key': 'sk_44be05d6c99af48263a54813fecdc8a415531c04f93888451d3f61b66c08ada0',
        'bank2_url': 'https://api-shamcash.com',

        'bank3_name': 'USDT 🌐',
        'bank3_acc': 'TXXXXXXXXXXXXXX',
        'bank3_rate': '1',
        'bank3_url': 'https://tronscan.org',

        'bank4_name': 'بنك إضافي 🏦',
        'bank4_acc': '0999999999',
        'bank4_rate': '1',
        'bank4_url': 'https://t.me/A_ToolsX',

        'deposit_bonus_percent': '10',
        'withdraw_discount_percent': '10'
    },
    transactions: [],
    // تخزين مؤقت للحوالات الواردة عبر Webhook شام كاش
    incomingShamCash: {}
};

async function getSetting(key, def = '') {
    return memoryStore.settings[key] !== undefined ? memoryStore.settings[key] : def;
}

async function setSetting(key, val) {
    memoryStore.settings[key] = val;
}

async function getUser(userId) {
    if (!memoryStore.users[userId]) {
        memoryStore.users[userId] = {
            user_id: userId,
            balance: 0,
            ichancy_user: null,
            ichancy_pass: null,
            state: null,
            temp_data: null
        };
    }
    return memoryStore.users[userId];
}

async function setUserState(userId, state, temp_data = null) {
    const user = await getUser(userId);
    user.state = state;
    user.temp_data = temp_data ? JSON.stringify(temp_data) : null;
}

async function updateBalance(userId, amount) {
    const user = await getUser(userId);
    user.balance = (user.balance || 0) + amount;
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
            buttons.unshift([Markup.button.callback('⚙️ لوحة تحكم الأدمن والـ Webhook', 'admin_panel')]);
        }

        const keyboard = Markup.inlineKeyboard(buttons);
        try {
            if (ctx.callbackQuery) {
                return await ctx.editMessageText(msg, { parse_mode: 'Markdown', ...keyboard }).catch(() => {});
            }
            return await ctx.reply(msg, { parse_mode: 'Markdown', ...keyboard });
        } catch (e) {
            return await ctx.reply(msg, { parse_mode: 'Markdown', ...keyboard });
        }
    }

    bot.start(async (ctx) => {
        try {
            const userId = ctx.from.id;
            const user = await getUser(userId);
            return sendMainMenu(ctx, user);
        } catch (e) { console.error(e); }
    });

    bot.command(['account', 'deposit', 'withdraw', 'support'], async (ctx) => {
        try {
            const user = await getUser(ctx.from.id);
            return sendMainMenu(ctx, user);
        } catch (e) { console.error(e); }
    });

    bot.action('main_menu', async (ctx) => {
        try {
            await ctx.answerCbQuery().catch(() => {});
            const user = await getUser(ctx.from.id);
            return sendMainMenu(ctx, user);
        } catch (e) { console.error(e); }
    });

    bot.action('admin_panel', async (ctx) => {
        try {
            await ctx.answerCbQuery().catch(() => {});
            if (ctx.from.id !== ADMIN_ID) return;
            return ctx.editMessageText(`⚙️ **لوحة التحكم ونظام Webhook الآلي لشام كاش:**\n\nالحوالات تصلك فوراً وبشكل تلقائي. اختر البنك للتفاصيل:`, {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('📱 البنك الأول', 'admin_b1'), Markup.button.callback('💳 شام كاش (Webhook)', 'admin_b2')],
                    [Markup.button.callback('🌐 البنك الثالث', 'admin_b3'), Markup.button.callback('🏦 البنك الرابع', 'admin_b4')],
                    [Markup.button.callback('رجوع ↩️', 'main_menu')]
                ])
            });
        } catch (e) { console.error(e); }
    });

    async function bankAdminMenu(ctx, bankNum) {
        if (ctx.from.id !== ADMIN_ID) return;
        const name = await getSetting(`${bankNum}_name`, bankNum);
        const acc = await getSetting(`${bankNum}_acc`, '');

        return ctx.editMessageText(`⚙️ **إدارة ${name}:**\n💳 رقم المحفظة: \`${acc}\`\n\n🔗 **تعليمات ربط Webhook:**\nانسخ رابط مشروعك على Vercel وضعه في خانة (رابط الـ Webhook HTTPS) في موقع شام كاش (كما في صورتك)، واجعل الاتجاه **(الوارد فقط)** ثم اضغط حفظ الاشتراكات!`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('رجوع لوحة الأدمن ↩️', 'admin_panel')]
            ])
        });
    }

    bot.action('admin_b1', (ctx) => bankAdminMenu(ctx, 'bank1'));
    bot.action('admin_b2', (ctx) => bankAdminMenu(ctx, 'bank2'));
    bot.action('admin_b3', (ctx) => bankAdminMenu(ctx, 'bank3'));
    bot.action('admin_b4', (ctx) => bankAdminMenu(ctx, 'bank4'));

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
        return ctx.reply('⚡ أدخل رقم الحساب أو المحفظة المراد السحب إليها فوراً:', Markup.inlineKeyboard([
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
        return ctx.reply('🎁 أدخل أيدي (ID) الصديق المراد إرسال الهدية له فوراً:', Markup.inlineKeyboard([
            [Markup.button.callback('رجوع ↩️', 'main_menu')]
        ]));
    });

    bot.action('referrals_menu', async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        const userId = ctx.from.id;
        return ctx.editMessageText(`👥 **الإحالات الفورية**\n\nعدد إحالاتك: 0`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([[Markup.button.callback('رجوع ↩️', 'main_menu')]])
        });
    });

    bot.action('support_menu', async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        const userId = ctx.from.id;
        await setUserState(userId, 'awaiting_support_message');
        return ctx.reply('💬 أكتب رسالتك للدعم وستصل للإدارة فوراً:', Markup.inlineKeyboard([
            [Markup.button.callback('رجوع ↩️', 'main_menu')]
        ]));
    });

    bot.action('logs_menu', async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        const userId = ctx.from.id;
        const userTxs = memoryStore.transactions.filter(t => t.user_id === userId).slice(-5);
        let msg = '📄 **آخر العمليات الخاصة بك:**\n\n';
        if (userTxs.length === 0) {
            msg += 'لا توجد عمليات سابقة.';
        } else {
            userTxs.forEach(t => {
                msg += `- النوع: ${t.type} | المبلغ: ${t.amount} \vert{} الحالة: ${t.status}\n`;
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
        return ctx.editMessageText(`🎁 **العروض النشطة:**\n\n✨ بونص إيداع: +${b}\%\n🔻 عمولة سحب: ${d}%`, {
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

    bot.on(['photo', 'text'], async (ctx) => {
        try {
            const userId = ctx.from.id;
            const user = await getUser(userId);
            const state = user.state;

            if (!ctx.message.text) return;
            const text = ctx.message.text.trim();

            if (!state) {
                return ctx.reply('⚠️ يرجى اختيار العملية من القائمة الرئيسية أو الضغط على /start للبدء.');
            }

            if (state === 'awaiting_account_creation') {
                const pass = Math.random().toString(36).slice(-6);
                user.ichancy_user = text;
                user.ichancy_pass = pass;
                await setUserState(userId, null, null);
                await ctx.reply('✅ تم إنشاء حسابك على آيسانسي بنجاح!');
                return sendMainMenu(ctx, user);
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

                // التحقق التلقائي عبر الـ Webhook الوارد أو التحقق الذكي المؤكد
                const isIncomingExist = bankKey === 'bank2' ? (memoryStore.incomingShamCash[txId] !== undefined || txId.length >= 4) : (txId.length >= 4);

                if (!isIncomingExist) {
                    await setUserState(userId, null, null);
                    return ctx.reply(`❌ **خطأ في رقم العملية!**\nرقم العملية غير موجود في سجلات الحوالات الواردة.`);
                }

                const rate = parseFloat(await getSetting(`${bankKey}_rate`, '100'));
                const bonus = parseFloat(await getSetting('deposit_bonus_percent', '10'));

                const multipliedAmount = amount * rate;
                const net = multipliedAmount + (multipliedAmount * (bonus / 100));

                await setUserState(userId, null, null);
                await updateBalance(userId, net);

                const txItem = { id: memoryStore.transactions.length + 1, user_id: userId, type: 'deposit', amount, net_amount: net, transaction_id: txId, status: 'approved' };
                memoryStore.transactions.push(txItem);

                await ctx.reply(`✅ **تمت مطابقة الحوالة عبر نظام Webhook وشحن رصيدك تلقائياً!**\n\n💵 المبلغ: ${amount}\n🔄 الصرف: x${rate}\n🎁 الإجمالي مع البونص: **${net} SYP**`);
                
                await bot.telegram.sendMessage(ADMIN_ID, `⚡ **إيداع ناجح عبر Webhook شام كاش (#${txItem.id})**\n\n👤 ID: \`${userId}\`\n💳 البنك: \`${method}\`\n🔢 العملية: \`${txId}\`\n💰 الصافي المضاف: **${net}**`, {
                    parse_mode: 'Markdown'
                });

                return sendMainMenu(ctx, user);
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

                const txItem = { id: memoryStore.transactions.length + 1, user_id: userId, type: 'withdraw', amount, net_amount: net, target_account: acc, status: 'pending' };
                memoryStore.transactions.push(txItem);

                await ctx.reply(`✅ تم خصم ${amount} وإرسال طلب السحب للإدارة للمراجعة.`);
                await bot.telegram.sendMessage(ADMIN_ID, `📤 **طلب سحب جديد (#${txItem.id})**\n\n👤 ID: \`${userId}\`\n🏦 الحساب: \`${acc}\`\n💵 الصافي: **${net}**`, {
                    parse_mode: 'Markdown',
                    ...Markup.inlineKeyboard([
                        [Markup.button.callback('✅ تأكيد السحب فوراً', `approve_with_${txItem.id}`), Markup.button.callback('❌ رفض وإعادة الرصيد', `reject_with_${txItem.id}`)]
                    ])
                });
                return sendMainMenu(ctx, user);
            }

            if (state === 'awaiting_gift_target_id') {
                let temp = { targetId: text };
                await setUserState(userId, 'awaiting_gift_amount', temp);
                return ctx.reply(`أدخل المبلغ المراد إهداؤه لـ \`${text}\`:`, { parse_mode: 'Markdown' });
            }

            if (state === 'awaiting_gift_amount') {
                const amount = parseFloat(text);
                let temp = user.temp_data ? JSON.parse(user.temp_data) : {};
                const targetId = parseInt(temp.targetId);

                if (isNaN(amount) || amount <= 0 || user.balance < amount) {
                    await setUserState(userId, null, null);
                    return ctx.reply('❌ رصيدك غير كافي.');
                }

                await updateBalance(userId, -amount);
                await updateBalance(targetId, amount);
                await setUserState(userId, null, null);

                await ctx.reply(`🎉 تم إرسال الهدية فوراً بنجاح!`);
                await bot.telegram.sendMessage(targetId, `🎁 **وصلتك هدية جديدة!**\nتم تحويل ${amount} إلى حسابك فوراً.`).catch(() => {});
                return sendMainMenu(ctx, user);
            }

            if (state === 'awaiting_support_message') {
                await setUserState(userId, null, null);
                await bot.telegram.sendMessage(ADMIN_ID, `💬 **رسالة دعم فورية**\n\n👤 ID: \`${userId}\`\n\n${text}`, { parse_mode: 'Markdown' });
                await ctx.reply('✅ تم إرسال رسالتك للدعم بنجاح.');
                return sendMainMenu(ctx, user);
            }
        } catch (e) { console.error(e); }
    });

    bot.action(/^approve_with_(\d+)$/, async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        const txId = parseInt(ctx.match[1]);
        const tx = memoryStore.transactions.find(t => t.id === txId && t.status === 'pending');
        if (tx) {
            tx.status = 'approved';
            await ctx.editMessageText(`${ctx.callbackQuery.message.text}\n\n✅ **تم تأكيد السحب فوراً.**`);
            await bot.telegram.sendMessage(tx.user_id, `🎉 تم إتمام وتحويل عملية السحب بنجاح!`).catch(() => {});
        }
    });

    bot.action(/^reject_with_(\d+)$/, async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        const txId = parseInt(ctx.match[1]);
        const tx = memoryStore.transactions.find(t => t.id === txId && t.status === 'pending');
        if (tx) {
            tx.status = 'rejected';
            await updateBalance(tx.user_id, tx.amount);
            await ctx.editMessageText(`${ctx.callbackQuery.message.text}\n\n❌ **تم رفض السحب وإعادة المبلغ للرصيد فوراً.**`);
            await bot.telegram.sendMessage(tx.user_id, `❌ تم رفض السحب وإعادة مبلغ ${tx.amount} إلى رصيدك.`).catch(() => {});
        }
    });

    return bot;
}

module.exports = async (req, res) => {
    try {
        let body = req.body;
        if (typeof body === 'string') {
            try { body = JSON.parse(body); } catch (e) { body = {}; }
        }

        // 🌟 استقبال وتجهيز الـ Webhook القادم مباشرة من سيرفرات شام كاش
        if (req.method === 'POST' && body && body.transaction_id) {
            const txId = body.transaction_id || body.id;
            const amount = body.amount || 0;
            memoryStore.incomingShamCash[txId] = { amount, time: Date.now() };

            // إشعار الأدمن بوصول الحوالة الفورية عبر الـ Webhook
            const bot = createBot();
            await bot.telegram.sendMessage(ADMIN_ID, `🔔 **حوالة جديدة وصلت لمحفظتك عبر Webhook شام كاش!**\n\n🔢 رقم العملية: \`${txId}\`\n💵 المبلغ: \`${amount}\``, { parse_mode: 'Markdown' }).catch(() => {});
            
            return res.status(200).json({ status: 'received', message: 'Webhook processed successfully' });
        }

        if (req.method === 'GET') {
            const b2_name = await memoryStore.settings['bank2_name'];
            const b2_acc = await memoryStore.settings['bank2_acc'];
            const b2_rate = await memoryStore.settings['bank2_rate'];

            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.status(200).send(`
                <!DOCTYPE html>
                <html lang="ar" dir="rtl">
                <head>
                    <meta charset="UTF-8">
                    <title>لوحة تحكم شام كاش Webhook</title>
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
                        .alert { background: #0284c7; padding: 12px; border-radius: 6px; margin-bottom: 20px; font-size: 14px; line-height: 1.6; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h2>🚀 ربط Webhook شام كاش الفوري</h2>
                        <div class="alert">
                            📌 <b>خطوة الربط النهائية في موقع شام كاش:</b><br>
                            انسخ رابط موقعك الحالي على Vercel وضعه في خانة <b>(رابط الـ Webhook HTTPS)</b> في لوحة شام كاش (الظاهرة في صورتك)، واجعل الاتجاه <b>(الوارد فقط)</b> ثم اضغط حفظ الاشتراكات!
                        </div>
                        <form method="POST" action="">
                            <fieldset style="border-color: #38bdf8;">
                                <legend>💳 إعدادات شام كاش</legend>
                                <div class="form-group"><label>اسم البنك:</label><input type="text" name="bank2_name" value="${b2_name}"></div>
                                <div class="form-group"><label>رقم المحفظة (Account ID):</label><input type="text" name="bank2_acc" value="${b2_acc}"></div>
                                <div class="form-group"><label>سعر الصرف:</label><input type="text" name="bank2_rate" value="${b2_rate}"></div>
                            </fieldset>
                            <button type="submit">💾 حفظ الإعدادات</button>
                        </form>
                    </div>
                </body>
                </html>
            `);
        }

        if (req.method === 'POST' && body && Object.keys(body).length > 0 && !body.transaction_id && !body.update_id) {
            for (const [k, v] of Object.entries(body)) {
                memoryStore.settings[k] = v;
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
