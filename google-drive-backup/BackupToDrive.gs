/**
 * BS FINCORP → Google Drive automated daily backup via Google Apps Script.
 *
 * This script is standalone: it does NOT touch the BS FINCORP app code. It logs
 * into the app, downloads the same JSON backup the Backup page produces, saves a
 * copy into your Google Drive folder and deletes copies older than RETENTION_DAYS.
 *
 * SETUP (once, ~5 minutes):
 * 1. Open https://script.google.com in the Google account whose Drive should
 *    hold the backups (a dedicated company account is recommended).
 *    New project → replace the default code.gs with the contents of this file.
 * 2. Create a folder in that account's Drive (My Drive) and copy its ID from
 *    the address bar: .../drive/folders/<THIS-IS-THE-ID>.
 * 3. Project Settings → Script properties → add:
 *      APP_BASE_URL    = https://bs-fincorp.vercel.app
 *      ADMIN_EMAIL     = <BS FINCORP app admin login email>
 *      ADMIN_PASSWORD  = <BS FINCORP app admin login password>
 *      DRIVE_FOLDER_ID = <folder ID from step 2>
 *    Optional:
 *      RETENTION_DAYS  = 7   (default 7; copies older than this are trashed)
 *      FILE_PREFIX     = bs-fincorp-backup
 * 4. Select setupDailyTrigger in the toolbar and Run once (authorize UrlFetch
 *    + Drive on the Google consent screen). Then select testNow and Run once —
 *    a file should appear in the folder. From now on the daily trigger runs by
 *    itself at the scheduled time.
 *
 * NOTE: the backup file contains customer records and password hashes. Keep the
 * Drive folder private; never share its link or move copies to a shared drive.
 */

function getProp_(key) {
  const value = PropertiesService.getScriptProperties().getProperty(key);
  if (!value) throw new Error("Missing script property: " + key);
  return value;
}

function propSafe_(key, fallback) {
  return PropertiesService.getScriptProperties().getProperty(key) || fallback;
}

function login_(baseUrl, email, password) {
  const res = UrlFetchApp.fetch(baseUrl + "/api/auth/login", {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ email: email, password: password }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    throw new Error("Login failed (" + res.getResponseCode() + "): " + res.getContentText());
  }
  const headers = res.getAllHeaders();
  for (const key in headers) {
    if (key.toLowerCase() === "set-cookie") {
      const value = Array.isArray(headers[key]) ? headers[key][0] : headers[key];
      return value.split(";")[0];
    }
  }
  throw new Error("Login succeeded but no session cookie was returned.");
}

function fetchBackup_(baseUrl, cookie) {
  const res = UrlFetchApp.fetch(baseUrl + "/api/backup", {
    method: "get",
    headers: { Cookie: cookie },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    throw new Error("Backup download failed (" + res.getResponseCode() + "): " + res.getContentText());
  }
  const disposition = res.getHeaders()["content-disposition"] || "";
  const match = /filename="?([^";]+)"?/.exec(disposition);
  const fileName = match
    ? match[1]
    : propSafe_("FILE_PREFIX", "bs-fincorp-backup") + "-backup-" + Utilities.formatDate(new Date(), "UTC", "yyyy-MM-dd") + ".json";
  return { content: res.getContentText(), fileName: fileName };
}

function saveToDrive_(folder, fileName, content) {
  const existing = folder.getFilesByName(fileName);
  const file = existing.hasNext() ? existing.next() : folder.createFile(fileName, "", MimeType.PLAIN_TEXT);
  file.setContent(content);
  return file.getId();
}

function cleanupOld_(folder, prefix, retentionDays) {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const files = folder.getFiles();
  let removed = 0;
  while (files.hasNext()) {
    const file = files.next();
    const name = file.getName();
    if (!name.startsWith(prefix) || !name.endsWith(".json")) continue;
    const stamp = /(\d{4}-\d{2}-\d{2})\.json$/.exec(name);
    if (!stamp) continue;
    if (new Date(stamp[1]).getTime() < cutoff.getTime()) {
      file.setTrashed(true);
      removed++;
    }
  }
  return removed;
}

function runBackup() {
  const baseUrl = getProp_("APP_BASE_URL");
  const folderId = getProp_("DRIVE_FOLDER_ID");
  const retentionDays = Number(propSafe_("RETENTION_DAYS", 7));
  const prefix = propSafe_("FILE_PREFIX", "bs-fincorp-backup");

  const cookie = login_(baseUrl, getProp_("ADMIN_EMAIL"), getProp_("ADMIN_PASSWORD"));
  const backup = fetchBackup_(baseUrl, cookie);
  const folder = DriveApp.getFolderById(folderId);
  const fileId = saveToDrive_(folder, backup.fileName, backup.content);
  const removed = cleanupOld_(folder, prefix, retentionDays);

  console.log("Backup saved: " + backup.fileName + " (" + fileId + "), trashed " + removed + " old file(s).");
}

function dailyBackup() {
  runBackup();
}

function testNow() {
  runBackup();
}

function setupDailyTrigger() {
  const script = ScriptApp.getProjectTriggers();
  for (const trigger of script) {
    if (trigger.getHandlerFunction() === "dailyBackup") ScriptApp.deleteTrigger(trigger);
  }
  ScriptApp.newTrigger("dailyBackup").timeBased().atHour(2).everyDays(1).create();
  console.log("Daily backup trigger created (02:00 UTC). Run testNow() once to verify.");
}