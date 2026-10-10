# Developer Console

The Developer Console is a hidden, owner-only page for settings that are kept
out of the day-to-day Settings page: website theming, print document wording,
loan-type defaults, message templates, and feature flags.

There is no role or separate login. Access is granted by a **secret key** that
only you know, and the console has **no link anywhere in the UI** — you reach it
by typing its URL.

## 1. Set the secret key

The console is disabled until the `DEVELOPER_KEY` environment variable is set.

On Vercel: **Project → Settings → Environment Variables → Add**

- Name: `DEVELOPER_KEY`
- Value: a long random string (e.g. run `openssl rand -hex 24`)

Then **redeploy** so the new variable takes effect.

For local development, add the same line to `.env`:

```
DEVELOPER_KEY=your-long-random-string
```

> Leave `DEVELOPER_KEY` unset to keep the console completely off. If it is
> missing, `/developer` behaves as if it does not exist.

## 2. Open the console (one time per device)

While logged in to the app, open:

```
https://<your-app-domain>/developer?key=<DEVELOPER_KEY>
```

That verifies the key and stores a signed, httpOnly cookie for 30 days, then
redirects you to the clean `/developer` URL. After that you can bookmark:

```
https://<your-app-domain>/developer
```

To lock a device again use **Lock console** in *Developer Tools*, or clear the
`bs_developer_access` cookie.

If the key is wrong or missing you will see a short notice instead of the
console. The console and its API return "not found" to anyone without access, so
the page is invisible to normal users and to search engines.

## What each tab controls

| Tab | What it changes | Where it takes effect |
| --- | --- | --- |
| **Company & Branding** | Company name, address, GST, phone, email, logo, tagline, website, print logo | Sidebar header, login/forgot/reset pages, printed documents |
| **Receipt & Documents** | Receipt title, header/footer notes, sign-off labels, GST on receipt, logo on print | Payment receipts (receipt page and EMI Pay) |
| **Loan Types & EMI Rules** | Loan type names + default interest type, rate, tenure, EMI day | Loan creation form, customer edit form |
| **Messages** | WhatsApp and SMS templates using `{tokens}` | All reminder / payment / statement composers |
| **Website Theme** | Primary brand colour | Every `emerald-*` accent across the app, and print colours |
| **Developer Tools** | Database check, cache refresh, maintenance banner, WhatsApp/SMS feature flags, lock console, audit log | Whole app |

## Message templates

Templates are plain text with `{tokens}` that are replaced at send time. An
**empty** template means "use the built-in message", so clearing a template
restores the original wording exactly.

Available tokens (only the ones a given message provides are replaced):

| Token | Meaning |
| --- | --- |
| `{name}` | Customer name |
| `{amount}` | Amount (already formatted as ₹) |
| `{loan}` | Loan number |
| `{date}` | Due / payment date |
| `{receipt}` | Receipt number |
| `{brand}` | Company / brand name |
| `{office}` | Office phone number |

## Maintenance banner

When **Maintenance mode** is enabled, a banner with your message is shown at the
top of every page. It is informational — it does not block access — so the owner
can always log in and turn it off. Set the message and toggle it in
**Developer Tools**.

## Feature flags

The **WhatsApp** and **SMS** toggles turn those buttons off across the whole app.
Disabled channels simply stop rendering their buttons; the underlying data and
numbers are untouched so re-enabling them brings them straight back.

## Cache

Developer settings are cached in memory for 10 seconds (and Company Settings
separately). After saving a change, use **Clear server cache** in Developer
Tools if another page still shows the old value.

## Storage

Developer settings live in a single `AppConfig` document. Company identity
(name, address, GST, phone, email, logo) continues to live in `CompanySetting`,
so the normal Settings page and the console stay in sync.
