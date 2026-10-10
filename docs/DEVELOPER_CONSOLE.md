# Developer Console

The Developer Console is an owner-only area that exposes settings which are
deliberately kept out of the day-to-day Settings page: website theming, print
document wording, loan-type defaults, message templates, and feature flags.

It is protected by a **role**, not a password. Only accounts with the
`developer` role can see it; for everyone else the page and its API behave as if
they do not exist.

## Creating the developer account

Roles are changed with a script (never through the UI) so a compromised admin
account cannot grant itself developer access:

```bash
# Promote an existing account
npm run set-role -- --email owner@example.com --role developer

# Or create a brand-new developer account
npm run set-role -- --email owner@example.com --role developer \
  --name "Owner" --password "a-strong-password"
```

The script only updates the matching user (or creates one) — it never drops or
reseeds the database, so it is safe to run against production. To demote an
account back, run the same command with `--role admin`.

After the role is set, the person must **log out and back in** (the role is read
from the database on every request, so a fresh login reflects it immediately).
Once they are a developer:

- A **Developer** section appears in the sidebar linking to `/developer`.
- The API at `/api/developer` responds; for non-developers it returns `404`.

## What each tab controls

| Tab | What it changes | Where it takes effect |
| --- | --- | --- |
| **Company & Branding** | Company name, address, GST, phone, email, logo, tagline, website, print logo | Sidebar header, login/forgot/reset pages, printed documents |
| **Receipt & Documents** | Receipt title, header/footer notes, sign-off labels, GST on receipt, logo on print | Payment receipts (receipt page and EMI Pay) |
| **Loan Types & EMI Rules** | Loan type names + default interest type, rate, tenure, EMI day | Loan creation form, customer edit form |
| **Messages** | WhatsApp and SMS templates using `{tokens}` | All reminder / payment / statement composers |
| **Website Theme** | Primary brand colour | Every `emerald-*` accent across the app, and print colours |
| **Developer Tools** | Database check, cache refresh, maintenance banner, WhatsApp/SMS feature flags, audit log | Whole app |

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
separately). After saving a change, use **Refresh cache** in Developer Tools if
another page still shows the old value.

## Storage

Developer settings live in a single `AppConfig` document. Company identity
(name, address, GST, phone, email, logo) continues to live in `CompanySetting`,
so the normal Settings page and the console stay in sync.
