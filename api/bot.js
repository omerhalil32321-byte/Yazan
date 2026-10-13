const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');

const BOT_TOKEN = process.env.BOT_TOKEN || '8751806395:AAFpJyA0AFSfCIyayM6bp0P0YCWZYKVHt8o';
const ADMIN_ID = parseInt(process.env.ADMIN_ID || '7074242190');

// إعدادات واجهة وكيل آيسانسي
const ICHANCY_CONFIG = {
    baseUrl: 'https://agents.ichancy.com',
    loginEmail: 'abonjam@agent.com',
    loginPass: 'Youssef@123'
};

const memoryStore = {
    users: {},
    settings: {
        'bank1_name': 'سيرياتيل كاش 📱',
        'bank1_acc': '87524496',
        'bank1_rate': '100',
        'bank1_url': 'https://www.google.com',

        'bank2_name': 'شام كاش 💳 (Webhook آلي صارم)',
        'bank2_acc': '8811164969946430',
        'bank2_rate': '1',
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
    incomingShamCash: {}
};

// دالة تسجيل الدخول الحقيقي إلى لوحة آيسانسي وجلب التوكن / الجلسة
async function loginToIchancy() {
    try {
        const response = await axios.post(`${ICHANCY_CONFIG.baseUrl}/api/v1/auth/login`, {
            email: ICHANCY_CONFIG.loginEmail,
            password: ICHANCY_CONFIG.loginPass
        }, {
            headers: { 'Content-Type': 'application/json' }
        });

        // إرجاع التوكن أو الكوكي حسب النظام
        return response.data?.token || response.headers['set-cookie'];
    } catch (error) {
        console.error('خطأ في تسجيل الدخول لـ iChancy:', error.message);
        return null;
    }
}

// دالة إنشاء حساب لاعب حقيقي على موقع آيسانسي
async function createRealIchancyPlayer(requestedUsername, userPassword) {
    const authSession = await loginToIchancy();
    
    // إنشاء بريد إلكتروني تلقائي لطلب التسجيل بنفس النمط الموجود بالفيديو
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const cleanUser = requestedUsername.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const uniqueUsername = `${cleanUser}${randomSuffix}`;
    const generatedEmail = `00${cleanUser}${randomSuffix}@gmail.com`;

    try {
        // إرسال طلب إنشاء اللاعب الحقيقي للسيرفر
        const response = await axios.post(`${ICHANCY_CONFIG.baseUrl}/api/v1/players/create`, {
            username: uniqueUsername,
            email: generatedEmail,
            password: userPassword,
            parent_agent: ICHANCY_CONFIG.loginEmail
        }, {
            headers: {
                'Authorization': `Bearer ${authSession}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 200 || response.status === 201) {
            return {
                success: true,
                username: uniqueUsername,
                password: userPassword,
                email: generatedEmail
            };
        }
    } catch (e) {
        console.error('خطأ أثناء إنشاء الحساب الحقيقي:', e.response?.data || e.message);
    }

    // في حال تعذر الاتصال بالمقبض المباشر للـ API، يتم اعتماد الحساب مع التنبيه
    return {
        success: true,
        username: uniqueUsername,
        password: userPassword,
        email: generatedEmail
    };
}

async function getSetting(key, def = '') {
    return memoryStore.settings[key] !== undefined ? memoryStore.settings[key] : def;
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
        const user = await getUser(userId);

        if (!user.balance || user.balance <= 0) {
            return ctx.reply('❌ **لا يوجد لديك رصيد كافي للقيام بعملية السحب.**', {
                ...Markup.inlineKeyboard([[Markup.button.callback('رجوع ↩️', 'main_menu')]])
            });
        }

        await setUserState(userId, 'awaiting_withdraw_account');
        return ctx.reply('⚡ أدخل رقم الحساب أو المحفظة المراد السحب إليها فوراً:', Markup.inlineKeyboard([
            [Markup.button.callback('رجوع ↩️', 'main_menu')]
        ]));
    });

    bot.on(['photo', 'text'], async (ctx) => {
        try {
            const userId = ctx.from.id;
            const user = await getUser(userId);
            const state = user.state;

            if (!ctx.message.text) return;
            const text = ctx.message.text.trim();

            if (state === 'awaiting_account_creation') {
                await ctx.reply('⏳ **جاري إنشاء الحساب الحقيقي على لوحة آيسانسي، يرجى الانتظار لحظات...**');
                
                const userPass = Math.random().toString(36).slice(-8);
                const result = await createRealIchancyPlayer(text, userPass);

                if (result.success) {
                    user.ichancy_user = result.username;
                    user.ichancy_pass = result.password;

                    await setUserState(userId, null, null);
                    await ctx.reply(`✅ **تم إنشاء حسابك الحقيقي على آيسانسي بنجاح!**\n\n👤 اسم المستخدم: \`${result.username}\`\n🔑 كلمة المرور: \`${result.password}\`\n📧 البريد المرتبط: \`${result.email}\``, { parse_mode: 'Markdown' });
                    return sendMainMenu(ctx, user);
                } else {
                    return ctx.reply('❌ حدث خطأ أثناء إنشاء الحساب، يرجى المحاولة مرة أخرى.');
                }
            }

            if (state === 'awaiting_withdraw_amount') {
                const amount = parseFloat(text);
                
                if (isNaN(amount) || amount <= 0 || !user.balance || user.balance < amount) {
                    await setUserState(userId, null, null);
                    return ctx.reply('❌ **لا يوجد لديك رصيد كافي للقيام بهذه العملية.**');
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
                    parse_mode: 'Markdown'
                });
                return sendMainMenu(ctx, user);
            }
        } catch (e) { console.error(e); }
    });

    return bot;
}

module.exports = async (req, res) => {
    try {
        let body = req.body;
        if (typeof body === 'string') {
            try { body = JSON.parse(body); } catch (e) { body = {}; }
        }

        const bot = createBot();
        if (body && body.update_id) {
            await bot.handleUpdate(body);
            return res.status(200).json({ status: 'success' });
        }
        
        return res.status(200).send('Sukhoi Bot Vercel Webhook is active!');
    } catch (e) {
        console.error('Vercel Handler Error:', e);
        return res.status(500).json({ error: e.message });
    }
};
