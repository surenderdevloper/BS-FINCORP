# Adding a New Client

The product is a **single codebase, one database per client**. Each client's data lives in
its own MongoDB database (or a dedicated cluster). No code changes are required to onboard
someone new — only an environment.

## 1. Create the database

- MongoDB Atlas: create a new cluster or a new database inside an existing cluster, e.g.
  `bs_fincorp_client2`.
- Copy the connection string; the app itself contains no database name (it reads
  `MONGODB_URI` only), so the database is chosen purely by this variable.

## 2. Set the client environment variables

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | Connection string for the client's database (mandatory). |
| `AUTH_SECRET` | Strong random value. **Required in production** — the app refuses to start/authenticate without it when deployed. Generate with `openssl rand -hex 32`. |
| `CLIENT_NAME` | Shown in backup files / file names (e.g. `myfirm-backup-2026-10-06.json`). Defaults to `bs-fincorp`. |
| `NEXT_PUBLIC_APP_NAME` | Optional public app/title name if you don't want the login/browser title to read "BS FINCORP". |
| `CLIENT_LOGO_URL` | Optional URL used as the login screen logo when the client has a brand asset. |
| `SEED_ADMIN_EMAIL` | Used only by the seed script to create the first admin. |
| `SEED_ADMIN_PASSWORD` | First-run temporary password (seed script only). |
| `SMTP_*` | Mail settings for the forgot-password flow — set or the feature stays disabled. |
| `APP_PUBLIC_URL` | Public base URL used in password-reset emails. |

## 3. First run (one time, dev only)

```bash
MONGODB_URI="<client-db-uri>" SEED_ADMIN_EMAIL="admin@client.com" \
SEED_ADMIN_PASSWORD="temp-password" npx tsx scripts/seed.ts
```

This creates the admin user, company settings and penalty rules in the client's database.
On your MVP/QA environment you can log in with these credentials, then change the company
name/logo on the Settings page — nothing is hardcoded in the app for branding.

> Never run `npm run seed` against a database that already holds real data — it drops the
> whole database first.

## 4. Branding

- On the **Settings** page set the company name, address, GST, phone, email and logo for
  the client. The sidebar, top bar, printed statements, receipts, NOC and login branding
  all read from these settings automatically.

## 5. Deploy

Make sure the deploy environment has the client's `MONGODB_URI` and a unique `AUTH_SECRET`.
One deployment can serve multiple clients by configuring the environment per instance;
each instance only ever touches its own database.

## 6. Verify

- Log in and create a test customer + loan, then confirm the dashboard reflects the data.
- Run a backup from the Backup page and file it away.
- Confirm the backup file name includes the `CLIENT_NAME` you set (helps distinguish
  client backups).