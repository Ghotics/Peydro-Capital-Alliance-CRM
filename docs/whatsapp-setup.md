# WhatsApp alerts: setup guide

**What it does:** when a lead arrives that nobody is in charge of (Consulta general and the quick contact form),
PCA's WhatsApp Business number sends a message to the team's phone(s):

> Nuevo lead (Formulario rápido): Ana López, +34 600 000 000. Ábrelo en el CRM: https://crm.peydrocapitalalliance.com/#/lead/…

The code is ready and switched off. It turns on by itself once the five secrets below are in Supabase.
Leads with a specialist keep using email only.

## What you need

- A **phone number for the business** that is **not** in use on the normal WhatsApp or WhatsApp Business app
  (Meta's API needs the number for itself; if Meta offers to keep it in the app too, "coexistence", that also works).
  It can be a new SIM or a landline that can receive one SMS or call for the code.
- The **phone number(s) that should receive the alerts**, for example the owner's mobile.
- A Facebook account to log in to Meta for Business.

## Steps

### 1. Meta business account and app
1. Go to **business.facebook.com** and create (or choose) the business portfolio **Peydró Capital Alliance**.
2. Go to **developers.facebook.com → My Apps → Create app**, type **Business**, link it to that portfolio.
3. In the app, add the product **WhatsApp** → **API Setup**.

### 2. Add the business number
1. In **WhatsApp → API Setup**, click **Add phone number**, fill in the display name (**Peydró Capital Alliance**) and
   category, and verify the number with the code Meta sends.
2. Copy the **Phone number ID** shown next to it (a long number). That is `WHATSAPP_PHONE_NUMBER_ID`.

### 3. Create the message template
In **WhatsApp Manager → Message templates → Create template**:

| Field | Value |
| --- | --- |
| Category | **Utility** |
| Name | `nuevo_lead` |
| Language | **Spanish** (`es`) |
| Body | `Nuevo lead ({{1}}): {{2}}, {{3}}. Ábrelo en el CRM: {{4}}` |
| Sample values | {{1}} `Formulario rápido` · {{2}} `Ana López` · {{3}} `+34600000000` · {{4}} `https://crm.peydrocapitalalliance.com/#/lead/123` |

Submit it. Approval usually takes minutes to a day. Meta only lets a business start a conversation with an
approved template, which is why this step is needed.

### 4. Permanent access token
The token on the API Setup page expires after 24 hours, so make a permanent one:
1. **business.facebook.com → Settings → Users → System users → Add**, name `pca-crm`, role **Admin**.
2. **Assign assets**: the app (full control) and the WhatsApp account (full control).
3. **Generate new token** → choose the app → permissions **whatsapp_business_messaging** and
   **whatsapp_business_management** → expiry **Never** → copy it. That is `WHATSAPP_TOKEN`.

### 5. Supabase secrets
Supabase → **Edge Functions → Secrets** (never paste the token anywhere else):

| Name | Value |
| --- | --- |
| `WHATSAPP_TOKEN` | the permanent token from step 4 |
| `WHATSAPP_PHONE_NUMBER_ID` | the Phone number ID from step 2 |
| `WHATSAPP_TO` | number(s) that receive alerts, with country code; several separated by commas: `34600000000,34611111111` |
| `WHATSAPP_TEMPLATE` | `nuevo_lead` |
| `WHATSAPP_TEMPLATE_LANG` | `es` (optional, that's the default) |

Optional: `WHATSAPP_DEPARTMENTS` (default `consulta,quick`) decides which leads alert.

### 6. Website privacy page
In the website repo, set `whatsappAlerts = true` in `src/data/forms.ts`. Meta is then listed on the privacy page
(Spanish and English) as a service that receives the lead's name and phone.

### 7. Test
Send the quick contact form on the website. Within a minute the alert should arrive on the `WHATSAPP_TO` phone(s).
If it doesn't: Supabase → Edge Functions → `website-intake` → Logs, look for `WhatsApp not sent` (it includes Meta's reason).
Common reasons: template not approved yet, the template text or language differs from step 3, or the token is missing the two permissions.
