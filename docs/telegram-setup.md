# Telegram alerts: setup guide

**What it does:** every new lead from the Business Office forms posts a short message in the team's Telegram group,
with a button that opens the lead in the CRM:

> 🆕 **Nuevo lead · Business Office**
> Telecomunicaciones y Energía
>
> 👤 **Ana López**
> 📞 +34600000000
> 📍 Renta 92 · 14
> ➡️ Responsable: Suministros
>
> [ Abrir en el CRM ]

It comes on top of the emails (nothing else changes). The email address and the lead's message are left out on
purpose: they stay in the CRM, behind the button.

The code is ready and switched off. It turns on by itself once the two secrets below are in Supabase.
It is free: Telegram doesn't charge for bots.

## Steps

### 1. Create the bot
1. In Telegram, open a chat with **@BotFather** (the official one, with the blue tick).
2. Send `/newbot`. Give it a name (e.g. **PCA Leads**) and a username that ends in `bot` (e.g. `pca_leads_bot`).
3. BotFather answers with a **token** like `123456789:AAH…`. That is `TELEGRAM_BOT_TOKEN`.
   Treat it like a password: anyone with it can post as the bot. Don't send it by chat or email.

### 2. Create the group
1. Create a new group, e.g. **PCA · Leads**, and add the team.
2. Add the bot: *Add members* → search its username (`@pca_leads_bot`).

The bot only needs to post. It doesn't have to be an admin. With Telegram's default "privacy mode" it only sees
messages addressed to it (like `/start@…`), not the team's conversation.

### 3. Find the group's ID
1. In the group, send `/start@pca_leads_bot` (with your bot's username).
2. In a browser, open `https://api.telegram.org/bot<TOKEN>/getUpdates`, replacing `<TOKEN>` with the token.
3. Find `"chat":{"id":-100…` (or `"id":-…`). That negative number, **with the minus sign**, is `TELEGRAM_CHAT_ID`.

If the page shows `"result":[]`, send `/start@…` in the group again and reload.

### 4. Supabase secrets
Supabase → **Edge Functions → Secrets** (never paste the token anywhere else):

| Name | Value |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | the token from step 1 |
| `TELEGRAM_CHAT_ID` | the group ID from step 3, e.g. `-1001234567890` |
| `TELEGRAM_FORMS` | optional. Which forms post to the group, comma-separated. Default `business_office`. Every form: `business_office,giza,quick` |

### 5. Website privacy page
In the website repo, set `telegramAlerts = true` in `src/data/forms.ts`. Telegram is then listed on the privacy page
(Spanish and English) as a service that receives the lead's name and phone. Fill in the safeguard placeholder there
with your data-protection adviser first.

### 6. Test
Send a Business Office form on the website. Within a few seconds the message should appear in the group.
If it doesn't: Supabase → Edge Functions → `website-intake` → Logs, look for `Telegram not sent` (it includes Telegram's reason).

| Telegram's reason | Fix |
| --- | --- |
| `chat not found` | `TELEGRAM_CHAT_ID` is wrong (check the minus sign), or the bot isn't in the group |
| `Unauthorized` | `TELEGRAM_BOT_TOKEN` is wrong or was revoked in BotFather |
| `group chat was upgraded to a supergroup chat` | the group got a new ID when its settings changed. The new one is in the message (`migrate_to_chat_id`): put it in `TELEGRAM_CHAT_ID` |
| `bot was kicked` | add the bot to the group again |

## Turning it off or changing it

- **Off:** delete `TELEGRAM_BOT_TOKEN` (or `TELEGRAM_CHAT_ID`) in Supabase. The rest keeps working.
- **New token** (e.g. if it leaked): BotFather → `/revoke` → pick the bot, then replace `TELEGRAM_BOT_TOKEN`.
- **More forms:** set `TELEGRAM_FORMS`, see step 4.
