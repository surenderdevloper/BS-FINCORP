# Backup & Restore (Production)

## How backups work

The Backup page (`/backup`) downloads a single JSON file containing every record in the
database:

- Customers
- Loans
- EMIs
- Payments
- Users (including password hashes — treat the file as a secret)
- Company settings (brand name, logo, loan/receipt number counters)
- Penalty rules
- Uploaded customer documents (data is embedded base64; heavy files are expected)

The download is a plain JSON export (`exportedAt`, `app`, `counts`, `collections`). It is
intended as a file-based safety net. For databases hosted on MongoDB Atlas, Atlas also
offers automated nightly snapshots which are the recommended first line of defence.

## Recommended schedule

| What | How often |
| --- | --- |
| Download a backup | Every week, or every day during high-activity periods |
| Verify a restore | Once a month against a scratch database |
| Atlas automated snapshots | Enable for the production cluster if possible |

Keep at least the last two downloads (one week / one month old) somewhere off-device
(cloud drive, secure storage). Do **not** mail the file or commit it to git — it contains
passwords and customer records (DPDP / GDPR consideration).

## How to restore

The restore tooling is a dev-time script, not a UI. It is deliberately kept out of the
app so a breached admin account cannot be used to import arbitrary data.

1. Create a fresh database or use an empty one in the same MongoDB cluster.
2. Point a throwaway environment at it and run the restore script (dev-time tool, not in the UI):
   ```bash
   MONGODB_URI="mongodb+srv://<user>:<pass>@<cluster>/<new-db>" \
   npx tsx scripts/restore.ts /path/to/backup.json
   ```
3. Confirm the counts printed by the script match the `counts` object in the backup file.
4. Deploy (or run) the app with `MONGODB_URI` pointing at the restored database.

> `npm run seed` wipes the current database (`db.dropDatabase()`). Do not run it on a
> database you want to keep — the restore script does **not** drop anything.

### What restoring does

- Drops no data on its own — run against an **empty** database.
- Writes back every collection from the file, preserving `_id` values and unique fields
  (duplicate insert failures are reported so you can scan for problems).
- Restores the loan/receipt counters from `companySettings`, so new documents keep
  numbering correctly.

## Configuring the backup file name (client branding)

The backup response sets `app` and the download file name from the `CLIENT_NAME`
environment variable (defaults to `bs-fincorp` when unset):

```
CLIENT_NAME=myfirm
```

Every client installation should set this so files from different clients are never
confused.