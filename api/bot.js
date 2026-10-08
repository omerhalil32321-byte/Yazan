const { Telegraf, Markup } = require('telegraf');

const BOT_TOKEN = process.env.BOT_TOKEN || '8991565390:AAGLlPEM2rf4EDZ5DIUHSdZoURy23-yKivk';
const ADMIN_ID = parseInt(process.env.ADMIN_ID || '7074242190');

let botInstance = null;

function getBot() {
    if (botInstance) return botInstance;
    const bot = new Telegraf(BOT_TOKEN);

    // دالة القائمة الرئيسية بلون وتصميم مختلف وواضح
    async function showMenu(ctx, text = '🚀 **البوت المالي السريع (الرئيسية)**') {
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('⚡ شحن الرصيد الفوري', 'btn_deposit')],
            [Markup.button.callback('💸 سحب الأرباح', 'btn_withdraw'), Markup.button.callback('📊 رصيدي ومعلوماتي', 'btn_account')],
            [Markup.button.callback('🎁 الهدايا والعروض', 'btn_offers'), Markup.button.callback('📞 الدعم الفني', 'btn_support')]
        ]);

        try {
            if (ctx.callbackQuery) {
                await ctx.editMessageText(text, { parse_mode: 'Markdown', ...keyboard });
            } else {
                await ctx.reply(text, { parse_mode: 'Markdown', ...keyboard });
            }
        } catch (e) {
            await ctx.reply(text, { parse_mode: 'Markdown', ...keyboard });
        }
    }

    bot.start(async (ctx) => {
        await ctx.reply('👋 أهلاً بك في بوت الخدمات المالية السريع.');
        return showMenu(ctx);
    });

    // استجابة فورية لأزرار القائمة مع إرسال رسالة تنبيه لكل كبسة
    bot.action('btn_deposit', async (ctx) => {
        await ctx.answerCbQuery('جاري فتح قائمة الشحن...').catch(() => {});
        return ctx.reply('📥 **اختر طريقة الشحن المتاحة:**', Markup.inlineKeyboard([
            [Markup.button.callback('📱 سيرياتيل كاش', 'pay_syriatel')],
            [Markup.button.callback('💳 شام كاش', 'pay_shamcash')],
            [Markup.button.callback('↩️ رجوع للقائمة', 'btn_home')]
        ]));
    });

    bot.action('btn_withdraw', async (ctx) => {
        await ctx.answerCbQuery('جاري فتح قسم السحب...').catch(() => {});
        return ctx.reply('📤 أرسل رقم الحساب المراد السحب إليه الآن:');
    });

    bot.action('btn_account', async (ctx) => {
        await ctx.answerCbQuery('جاري جلب معلومات الحساب...').catch(() => {});
        return ctx.reply(`👤 **معلومات حسابك:**\n- الأيدي: \`${ctx.from.id}\`\n- الرصيد: 0 SYP`, { parse_mode: 'Markdown' });
    });

    bot.action('btn_offers', async (ctx) => {
        await ctx.answerCbQuery('العروض نشطة!').catch(() => {});
        return ctx.reply('🎁 **العروض النشطة:**\n- بونص إيداع فوري: +10%');
    });

    bot.action('btn_support', async (ctx) => {
        await ctx.answerCbQuery('فتح الدعم الفني...').catch(() => {});
        return ctx.reply('📞 التواصل مع الدعم: يرجى كتابة رسالتك وسنرد عليك فوراً.');
    });

    bot.action('btn_home', async (ctx) => {
        await ctx.answerCbQuery('العودة للرئيسية').catch(() => {});
        return showMenu(ctx);
    });

    bot.action(/^pay_/, async (ctx) => {
        await ctx.answerCbQuery('تم اختيار طريقة الدفع').catch(() => {});
        const method = ctx.match[0] === 'pay_syriatel' ? 'سيرياتيل كاش' : 'شام كاش';
        return ctx.reply(`⚡ تم اختيار **${method}**.\nأرسل رقم العملية الآن:`, { parse_mode: 'Markdown' });
    });

    botInstance = bot;
    return bot;
}

module.exports = async (req, res) => {
    try {
        let body = req.body;
        if (typeof body === 'string') {
            try { body = JSON.parse(body); } catch (e) { body = {}; }
        }

        // لوحة تحكم بسيطة وسريعة عبر المتصفح
        if (req.method === 'GET') {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.status(200).send(`
                <body style="background:#0f172a;color:#fff;font-family:Tahoma;text-align:center;padding-top:50px;">
                    <h2>⚡ البوت المالي السريع يعمل بكفاءة تامة</h2>
                    <p>التصميم والسرعة مفعلة بنجاح.</p>
                </body>
            `);
        }

        const bot = getBot();
        if (body && body.update_id) {
            await bot.handleUpdate(body);
            return res.status(200).json({ status: 'ok' });
        }

        return res.status(200).send('Fast Telegram Bot is active!');
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: e.message });
    }
};
