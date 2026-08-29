# Fefierys Recovery Runbook

## Document purpose

This document contains step-by-step backup and recovery procedures for the Fefierys platform.

It is intended to be usable by an engineer who did not participate in the original implementation.

The procedures explain:

- which environment is being manipulated
- which commands to run
- which values should be checked
- which results are expected
- when it is safe to continue
- how to clean up recovery resources

---

# 1. Critical safety rules

Before performing ANY recovery operation:

## Rule 1 — Identify the environment

Explicitly identify:

```text
DEV
QA
PROD
```

Never assume the current environment.

---

## Rule 2 — Identify the affected system

Determine whether the incident affects:

```text
Neon PostgreSQL

Cloudflare R2

both
```

---

## Rule 3 — Stop continued damage

If a process is still modifying data, stop it before recovery.

Examples:

```text
database migration
bulk script
delete process
storage migration
admin bulk operation
deployment
import
```

---

## Rule 4 — Never expose secrets

Never paste secret values into:

- Git
- documentation
- tickets
- chat
- screenshots
- logs intended for public sharing

Examples of secrets:

```text
DATABASE_URL
DATABASE_URL_UNPOOLED

R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY

NEON_AUTH_COOKIE_SECRET

passwords
access tokens
```

---

## Rule 5 — Recover in isolation first

For Neon:

```text
temporary recovery branch
```

For R2:

```text
temporary recovery prefix
```

Do not immediately overwrite the active environment when an isolated recovery path exists.

---

## Rule 6 — Validate before switching

A recovery is not successful merely because the restore command completed.

The recovered state must be validated before normal operation resumes.

---

# 2. Current environment mapping

## DEV

```text
Neon project:
fefierys-dev

R2 bucket:
fefierys-assets-dev

Local environment file:
.env.local
```

---

## QA

```text
Neon project:
fefierys-qa

R2 bucket:
fefierys-assets-qa

Local environment file:
.env.qa.local
```

---

## PROD

PROD infrastructure has not yet been created.

Do not reuse DEV or QA resources as PROD.

---

# 3. Initial portfolio recovery baseline

The following baseline represents the initial portfolio migration.

These values are historical checkpoints.

## Database

```text
portfolio_sections      3
portfolio_groups        6
portfolio_categories   16
artworks               165
```

## Storage references

```text
total artworks                 165
with storageKey                165
without storageKey               0
```

## Drizzle

```text
migration count = 3
```

## R2

```text
portfolio/artworks/ objects = 165
```

Important:

> These values must not be assumed to remain permanent.

If the portfolio has changed after this baseline, use the expected counts corresponding to the backup or recovery point being restored.

---

# 4. Required local tools

Database recovery requires:

```text
pg_dump
pg_restore
psql
```

The initial setup used PostgreSQL 18.

Validate:

```powershell
pg_dump --version
pg_restore --version
psql --version
```

Expected equivalent output:

```text
pg_dump (PostgreSQL) 18.x
pg_restore (PostgreSQL) 18.x
psql (PostgreSQL) 18.x
```

If these commands are missing on Windows:

```powershell
winget search PostgreSQL --source winget
```

Expected package:

```text
PostgreSQL.PostgreSQL.18
```

Install:

```powershell
winget install --id PostgreSQL.PostgreSQL.18 -e --source winget
```

Open a new PowerShell terminal afterward.

If PostgreSQL is installed but not in PATH:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" --version
```

---

# 5. Node / project requirements

R2 backup/recovery tooling runs from the application repository:

```text
C:\web_fefi\fefierys-web
```

Relevant dependency:

```text
@aws-sdk/client-s3
```

Check:

```powershell
npm ls @aws-sdk/client-s3
```

During initial validation the installed version was:

```text
3.1117.0
```

A later compatible version is acceptable.

---

# 6. Neon incident: recent data error

Use this procedure when:

- data was deleted recently
- data was modified incorrectly recently
- a migration damaged data recently
- the incident is inside Neon restore history

During initial Free-plan validation:

```text
Restore window = 6 hours
```

---

# 7. Neon recent-state restore procedure

Open:

```text
Neon
→ affected project
→ Backup & Restore
```

Identify a recovery point immediately before the incident.

Use:

```text
Preview Data
```

when available.

Prefer:

```text
Restore
→ Multi-step restore
```

Do NOT initially use:

```text
One-step restore
```

unless a real incident specifically requires immediate destructive replacement.

The Multi-step flow should state that the active branch remains unchanged.

Create the recovery branch.

Do NOT migrate application connections yet.

---

# 8. Validate recovered Neon branch

Go to:

```text
Neon
→ SQL Editor
```

Select the newly restored branch.

Confirm you are NOT accidentally running validation against:

```text
production
```

---

## 8.1 List application tables

Run:

```sql
SELECT
  table_schema,
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Initial expected application tables:

```text
artworks
portfolio_categories
portfolio_groups
portfolio_sections
```

---

## 8.2 Validate portfolio row counts

Run:

```sql
SELECT
  'portfolio_sections' AS table_name,
  COUNT(*) AS row_count
FROM public.portfolio_sections

UNION ALL

SELECT
  'portfolio_groups',
  COUNT(*)
FROM public.portfolio_groups

UNION ALL

SELECT
  'portfolio_categories',
  COUNT(*)
FROM public.portfolio_categories

UNION ALL

SELECT
  'artworks',
  COUNT(*)
FROM public.artworks;
```

Initial expected baseline:

```text
portfolio_sections      3
portfolio_groups        6
portfolio_categories   16
artworks               165
```

If the dataset has changed since the initial migration, compare with the expected state at the selected recovery point instead.

---

## 8.3 Validate R2 storage references

Run:

```sql
SELECT
  COUNT(*) AS total_artworks,
  COUNT(storage_key) AS artworks_with_storage_key,
  COUNT(*) - COUNT(storage_key) AS artworks_without_storage_key
FROM public.artworks;
```

Initial expected baseline:

```text
total_artworks               165
artworks_with_storage_key    165
artworks_without_storage_key   0
```

---

## 8.4 Validate Drizzle schema

Run:

```sql
SELECT
  table_schema,
  table_name
FROM information_schema.tables
WHERE table_schema = 'drizzle'
ORDER BY table_name;
```

Expected:

```text
drizzle | __drizzle_migrations
```

---

## 8.5 Validate Drizzle migration count

Run:

```sql
SELECT COUNT(*) AS migration_count
FROM drizzle.__drizzle_migrations;
```

Initial expected baseline:

```text
3
```

This number must increase as new migrations are introduced.

---

# 9. Complete or cancel Neon restore

If this is only a recovery test:

```text
DO NOT migrate application connections.
```

Delete the temporary recovery branch after validation.

If a temporary manual snapshot was created specifically for the test, delete it when no longer needed.

If this is a real recovery:

1. validate schema
2. validate data
3. validate `storageKey`
4. validate Drizzle history
5. smoke-test application behavior
6. only then migrate application connections/settings to the recovered branch

---

# 10. Create a Neon manual snapshot

Use before risky operations.

Open:

```text
Neon
→ affected project
→ Backup & Restore
→ Create snapshot
```

Neon may initially assign an automatic snapshot name.

If desired, rename it using the edit control.

Recommended uses:

```text
before risky migration
before destructive import
before mass update
before significant database refactor
```

Do not permanently occupy the available snapshot slot without a reason.

Delete obsolete manual snapshots after rollback risk has passed.

---

# 11. Create DEV PostgreSQL logical backup

Run from:

```text
C:\web_fefi\fefierys-web
```

Create backup directory:

```powershell
New-Item -ItemType Directory -Force "C:\web_fefi\backups\fefierys-dev" | Out-Null
```

Create timestamped output path:

```powershell
$backupFile = "C:\web_fefi\backups\fefierys-dev\fefierys-dev-$(Get-Date -Format 'yyyyMMdd-HHmmss').dump"
$env:FEFI_BACKUP_FILE = $backupFile
```

Generate backup using DEV `.env.local`:

```powershell
node -e "const {config}=require('dotenv'); const {spawnSync}=require('node:child_process'); config({path:'.env.local'}); const raw=process.env.DATABASE_URL_UNPOOLED; if(!raw) throw new Error('DATABASE_URL_UNPOOLED is not configured'); const u=new URL(raw); const env={...process.env,PGHOST:u.hostname,PGPORT:u.port||'5432',PGUSER:decodeURIComponent(u.username),PGPASSWORD:decodeURIComponent(u.password),PGDATABASE:u.pathname.replace(/^\//,''),PGSSLMODE:u.searchParams.get('sslmode')||'require',PGCHANNELBINDING:u.searchParams.get('channel_binding')||'prefer'}; const r=spawnSync('pg_dump',['--format=custom','--no-owner','--no-privileges','--schema=public','--schema=drizzle','--file',process.env.FEFI_BACKUP_FILE],{env,stdio:'inherit'}); process.exit(r.status ?? 1);"
```

Expected result:

```text
PowerShell returns to the prompt without pg_dump error.
```

Inspect the generated file:

```powershell
Get-Item $backupFile | Select-Object FullName, Length, LastWriteTime
```

Expected:

```text
Length > 0
```

---

# 12. Create QA PostgreSQL logical backup

Run from:

```text
C:\web_fefi\fefierys-web
```

Create directory:

```powershell
New-Item -ItemType Directory -Force "C:\web_fefi\backups\fefierys-qa" | Out-Null
```

Set output:

```powershell
$backupFile = "C:\web_fefi\backups\fefierys-qa\fefierys-qa-$(Get-Date -Format 'yyyyMMdd-HHmmss').dump"
$env:FEFI_BACKUP_FILE = $backupFile
```

Generate QA backup:

```powershell
node -e "const {config}=require('dotenv'); const {spawnSync}=require('node:child_process'); config({path:'.env.qa.local'}); const raw=process.env.DATABASE_URL_UNPOOLED; if(!raw) throw new Error('DATABASE_URL_UNPOOLED is not configured'); const u=new URL(raw); const env={...process.env,PGHOST:u.hostname,PGPORT:u.port||'5432',PGUSER:decodeURIComponent(u.username),PGPASSWORD:decodeURIComponent(u.password),PGDATABASE:u.pathname.replace(/^\//,''),PGSSLMODE:u.searchParams.get('sslmode')||'require',PGCHANNELBINDING:u.searchParams.get('channel_binding')||'prefer'}; const r=spawnSync('pg_dump',['--format=custom','--no-owner','--no-privileges','--schema=public','--schema=drizzle','--file',process.env.FEFI_BACKUP_FILE],{env,stdio:'inherit'}); process.exit(r.status ?? 1);"
```

Expected:

```text
PowerShell returns without pg_dump error.
```

Inspect:

```powershell
Get-Item $backupFile | Select-Object FullName, Length, LastWriteTime
```

Expected:

```text
Length > 0
```

---

# 13. Inspect PostgreSQL backup archive

Run:

```powershell
pg_restore --list $backupFile | Select-Object -First 40
```

Expected content equivalent to:

```text
SCHEMA - drizzle
SCHEMA - public

TYPE public artwork_orientation
TYPE public artwork_status

TABLE drizzle __drizzle_migrations

TABLE public artworks
TABLE public portfolio_categories
TABLE public portfolio_groups
TABLE public portfolio_sections

TABLE DATA drizzle __drizzle_migrations
TABLE DATA public artworks
TABLE DATA public portfolio_categories
TABLE DATA public portfolio_groups
TABLE DATA public portfolio_sections

CONSTRAINT ...
INDEX ...
SEQUENCE ...
```

Example initial validation information:

```text
Dumped from database version: 18.6
Dumped by pg_dump version: 18.6
Format: CUSTOM
```

The backup is not fully validated yet.

A restore test is still required.

---

# 14. PostgreSQL pg_restore recovery drill

Create a temporary branch in the affected Neon project.

Suggested configuration:

```text
Name:
pg-restore-test-YYYY-MM-DD

Parent:
production

Branch mode:
Branch data and schema

Auto-delete:
After 1 day
```

Example used during validation:

```text
pg-restore-test-2026-08-26
```

Create the branch.

---

# 15. Obtain temporary branch connection

From Neon, copy the temporary branch:

```text
Direct / Unpooled connection string
```

Do not paste it into documentation or chat.

Load securely in PowerShell:

```powershell
$secureUrl = Read-Host "Paste recovery branch UNPOOLED connection string" -AsSecureString
```

Paste when prompted and press Enter.

PowerShell will not visually display the pasted secret.

Convert it for temporary process use:

```powershell
$env:RECOVERY_DATABASE_URL = [System.Net.NetworkCredential]::new("", $secureUrl).Password
```

Check only that a value exists:

```powershell
if ($env:RECOVERY_DATABASE_URL) { "Recovery URL loaded ✅" }
```

Expected:

```text
Recovery URL loaded ✅
```

---

# 16. Critical safety check before DROP

Before continuing:

1. open Neon
2. verify the temporary branch exists
3. verify the copied URL belongs to the temporary branch
4. verify the branch is NOT `production`

The next command intentionally deletes application schemas.

Never execute it with a production connection string.

---

# 17. Empty application schemas in temporary branch

Run:

```powershell
node -e "const {spawnSync}=require('node:child_process'); const u=new URL(process.env.RECOVERY_DATABASE_URL); const env={...process.env,PGHOST:u.hostname,PGPORT:u.port||'5432',PGUSER:decodeURIComponent(u.username),PGPASSWORD:decodeURIComponent(u.password),PGDATABASE:u.pathname.replace(/^\//,''),PGSSLMODE:u.searchParams.get('sslmode')||'require',PGCHANNELBINDING:u.searchParams.get('channel_binding')||'prefer'}; const r=spawnSync('psql',['-v','ON_ERROR_STOP=1','-c','DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA IF EXISTS public CASCADE;'],{env,stdio:'inherit'}); process.exit(r.status ?? 1);"
```

This runs:

```sql
DROP SCHEMA IF EXISTS drizzle CASCADE;
DROP SCHEMA IF EXISTS public CASCADE;
```

only against the database referenced by `RECOVERY_DATABASE_URL`.

Expected:

```text
NOTICE messages may appear.
PowerShell returns without fatal psql error.
```

---

# 18. Restore PostgreSQL `.dump`

Confirm the backup path:

```powershell
$backupFile
Test-Path $backupFile
```

Expected:

```text
True
```

Restore:

```powershell
node -e "const {spawnSync}=require('node:child_process'); const u=new URL(process.env.RECOVERY_DATABASE_URL); const env={...process.env,PGHOST:u.hostname,PGPORT:u.port||'5432',PGUSER:decodeURIComponent(u.username),PGPASSWORD:decodeURIComponent(u.password),PGDATABASE:u.pathname.replace(/^\//,''),PGSSLMODE:u.searchParams.get('sslmode')||'require',PGCHANNELBINDING:u.searchParams.get('channel_binding')||'prefer'}; const r=spawnSync('pg_restore',['--exit-on-error','--no-owner','--no-privileges','--dbname',env.PGDATABASE,process.argv[1]],{env,stdio:'inherit'}); process.exit(r.status ?? 1);" "$backupFile"
```

Expected:

```text
pg_restore completes without error.
```

The command may produce little or no output.

Returning to the prompt without error is acceptable.

---

# 19. Validate PostgreSQL logical restore

Go to:

```text
Neon
→ SQL Editor
→ temporary pg-restore-test branch
```

Run portfolio count validation:

```sql
SELECT
  'portfolio_sections' AS table_name,
  COUNT(*) AS row_count
FROM public.portfolio_sections

UNION ALL

SELECT
  'portfolio_groups',
  COUNT(*)
FROM public.portfolio_groups

UNION ALL

SELECT
  'portfolio_categories',
  COUNT(*)
FROM public.portfolio_categories

UNION ALL

SELECT
  'artworks',
  COUNT(*)
FROM public.artworks;
```

Initial baseline:

```text
portfolio_sections      3
portfolio_groups        6
portfolio_categories   16
artworks               165
```

---

## Validate storage keys

```sql
SELECT
  COUNT(*) AS total_artworks,
  COUNT(storage_key) AS with_storage_key,
  COUNT(*) - COUNT(storage_key) AS without_storage_key
FROM public.artworks;
```

Initial baseline:

```text
165 | 165 | 0
```

---

## Validate Drizzle migrations

```sql
SELECT COUNT(*) AS migration_count
FROM drizzle.__drizzle_migrations;
```

Initial baseline:

```text
3
```

If all checks match the expected recovery point:

```text
PostgreSQL logical recovery ✅
```

---

# 20. PostgreSQL recovery cleanup

Delete the temporary Neon branch.

Remove temporary shell values:

```powershell
Remove-Item Env:RECOVERY_DATABASE_URL -ErrorAction SilentlyContinue
Remove-Variable secureUrl -ErrorAction SilentlyContinue
Remove-Item Env:FEFI_BACKUP_FILE -ErrorAction SilentlyContinue
```

Do not immediately delete the `.dump` if it is currently the latest known-good backup.

---

# 21. Failed Drizzle migration procedure

If a Drizzle migration fails:

1. stop further migration execution
2. stop release promotion
3. inspect whether schema changes were committed
4. inspect whether data changed
5. do not blindly rerun the migration

Recovery choices:

```text
Recent incident
→ Neon Restore History

Known explicit checkpoint
→ manual snapshot

External application-data recovery
→ pg_dump + pg_restore
```

Recover into an isolated branch.

Validate the recovered branch.

Fix the migration.

Then validate promotion order:

```text
DEV
↓
QA
↓
PROD
```

Never promote a migration that has not succeeded in DEV and QA.

---

# 22. Neon Auth recovery considerations

The application-level `pg_dump` restores:

```text
public
drizzle
```

It does NOT intentionally provide a logical backup of Neon-managed Auth schemas.

If Neon Auth itself is intact:

```text
no special Auth action is necessary
```

If Neon Auth must be recreated manually:

1. enable Neon Auth on the correct project
2. configure allowed application domain
3. enable Email Sign-in
4. temporarily enable Email Sign-up
5. create the admin account
6. obtain the new Auth user ID
7. set the environment-specific `ADMIN_USER_ID`
8. disable Email Sign-up
9. keep Email Sign-in enabled
10. validate admin login
11. update Vercel environment variables if necessary
12. redeploy the affected environment

DEV and QA must use independent Auth configuration.

---

# 23. Admin smoke test after Auth recovery

Test:

```text
/admin
```

Without session:

```text
/admin
→ /admin/login
```

Invalid password:

```text
generic invalid credentials error
```

Valid admin:

```text
/admin/login
→ /admin
```

Sign out:

```text
/admin
→ /admin/login
```

After logout, opening:

```text
/admin
```

must redirect again to:

```text
/admin/login
```

Check browser Network/Console for server errors involving:

```text
/api/auth/*
```

---

# 24. R2 Bucket Lock recovery test

Use only an isolated test prefix.

Recommended:

```text
recovery-test/
```

Never test Bucket Lock against:

```text
portfolio/artworks/
```

Create a local test file:

```powershell
"Fefierys R2 recovery test" | Set-Content "C:\web_fefi\r2-recovery-test.txt"
```

In Cloudflare R2 create:

```text
recovery-test/
```

Upload:

```text
r2-recovery-test.txt
```

Resulting key:

```text
recovery-test/r2-recovery-test.txt
```

---

# 25. Configure Bucket Lock test

Go to:

```text
Cloudflare
→ R2
→ fefierys-assets-dev
→ Settings
→ Bucket Lock Rules
→ Add
```

Configure:

```text
Enabled:
Yes

Rule Name:
recovery-test-lock

Prefix:
recovery-test/

Retention:
1 day
```

Save.

---

# 26. Validate Bucket Lock deletion protection

Attempt to delete:

```text
recovery-test/r2-recovery-test.txt
```

Expected:

```text
Delete disabled or rejected
```

Validation:

```text
DELETE protection ✅
```

---

# 27. Validate Bucket Lock overwrite protection

Change the local file:

```powershell
"Fefierys R2 recovery test VERSION 2" | Set-Content "C:\web_fefi\r2-recovery-test.txt"
```

Attempt to upload using exactly the same object key:

```text
recovery-test/r2-recovery-test.txt
```

Expected behavior during initial validation:

```text
1 file could not be uploaded
```

Validation:

```text
OVERWRITE protection ✅
```

After retention expires:

1. delete the test object
2. remove `recovery-test-lock`
3. remove the empty test folder if desired

---

# 28. Create R2 DEV backup

Run from:

```text
C:\web_fefi\fefierys-web
```

Execute:

```powershell
npx tsx scripts/backupR2.ts --dev
```

Expected environment output:

```text
R2 backup environment: dev
Bucket: fefierys-assets-dev
Prefix: portfolio/artworks/
```

Initial portfolio baseline:

```text
Found 165 objects.
```

A changing portfolio may produce a different valid count.

The backup should continue downloading all objects.

Expected final output format:

```text
R2 backup successful ✅
Objects: <expected object count>
Bytes: <total bytes>
Manifest: C:\web_fefi\backups\fefierys-r2-dev\<timestamp>\manifest.json
```

One initial validated DEV backup produced:

```text
Objects: 165
Bytes: 55525918
```

Do not treat the byte count as permanent.

---

# 29. Create R2 QA backup

Run:

```powershell
npx tsx scripts/backupR2.ts --qa
```

Expected:

```text
R2 backup environment: qa
Bucket: fefierys-assets-qa
Prefix: portfolio/artworks/
```

Initial baseline:

```text
Found 165 objects.
```

Expected final output:

```text
R2 backup successful ✅
Objects: <expected object count>
Bytes: <total bytes>
Manifest: C:\web_fefi\backups\fefierys-r2-qa\<timestamp>\manifest.json
```

---

# 30. Inspect R2 backup structure

Each backup directory must contain:

```text
objects/
manifest.json
```

Example:

```text
C:\web_fefi\backups\fefierys-r2-dev\
└─ <timestamp>\
   ├─ objects\
   └─ manifest.json
```

The manifest should contain:

```text
version
environment
bucket
prefix
generatedAt
objectCount
totalBytes
objects
```

Each backed-up object should contain metadata equivalent to:

```text
key
size
sha256
contentType
cacheControl
contentDisposition
contentEncoding
metadata
```

---

# 31. R2 DEV recovery drill

Use the DEV manifest generated by `backupR2.ts`.

Run:

```powershell
npx tsx scripts/testR2Recovery.ts --dev --manifest "<DEV_MANIFEST_PATH>"
```

Example:

```powershell
npx tsx scripts/testR2Recovery.ts --dev --manifest "C:\web_fefi\backups\fefierys-r2-dev\<timestamp>\manifest.json"
```

Expected output pattern:

```text
Environment: dev

Source key:
portfolio/artworks/.../master.webp

Local backup:
C:\web_fefi\backups\fefierys-r2-dev\...\objects\...\master.webp

Local backup integrity ✅

Temporary recovery key:
recovery-restore-test/...

Temporary object uploaded ✅

Restored object integrity ✅
Restored object metadata ✅

R2 recovery drill successful ✅

Temporary recovery object deleted ✅
```

---

# 32. R2 QA recovery drill

Run:

```powershell
npx tsx scripts/testR2Recovery.ts --qa --manifest "<QA_MANIFEST_PATH>"
```

Example:

```powershell
npx tsx scripts/testR2Recovery.ts --qa --manifest "C:\web_fefi\backups\fefierys-r2-qa\<timestamp>\manifest.json"
```

Expected:

```text
Environment: qa

Local backup integrity ✅
Temporary object uploaded ✅
Restored object integrity ✅
Restored object metadata ✅

R2 recovery drill successful ✅
Temporary recovery object deleted ✅
```

---

# 33. What a successful R2 recovery drill proves

Successful output proves:

```text
backup file exists                  ✅
backup size matches manifest        ✅
backup SHA-256 matches manifest     ✅
object can be uploaded to R2        ✅
downloaded bytes remain identical   ✅
restored SHA-256 is correct         ✅
Content-Type is preserved           ✅
Cache-Control is preserved          ✅
Content-Disposition is preserved    ✅
Content-Encoding is preserved       ✅
custom metadata is preserved        ✅
temporary cleanup succeeds          ✅
```

---

# 34. Important R2 recovery-test rule

`scripts/testR2Recovery.ts` intentionally uploads to:

```text
recovery-restore-test/
```

It must NOT use:

```text
portfolio/artworks/
```

during a recovery drill.

The test is designed to prove recovery ability without overwriting real artwork.

---

# 35. Recover one real lost R2 artwork

If a single real portfolio object is lost:

1. identify the affected artwork
2. determine its exact `storageKey` from PostgreSQL
3. locate the most recent appropriate R2 backup
4. open its `manifest.json`
5. find the exact matching object key
6. locate the backed-up local file
7. verify the local file size
8. verify its SHA-256 against the manifest
9. restore to the exact original key
10. restore object metadata
11. download/read the restored object
12. verify SHA-256 again
13. validate media delivery
14. validate portfolio rendering

Required metadata to preserve:

```text
Content-Type
Cache-Control
Content-Disposition
Content-Encoding
custom metadata
```

If the object is restored to the original key:

```text
do not change PostgreSQL storageKey
```

---

# 36. Validate recovered artwork through media Worker

After restoring a real object, test:

```text
/thumb/<storageKey>?w=<supported-width>&x=<focus>&y=<focus>&v=2

/display/<storageKey>
```

Expected:

```text
HTTP 200
```

Thumbnail delivery may return:

```text
AVIF
WebP
JPEG
```

depending on media negotiation.

Also validate the artwork visually in the application.

---

# 37. Recover multiple missing R2 objects

If many objects are lost:

1. immediately stop the operation causing loss
2. do not mass-update PostgreSQL `storageKey`
3. identify the latest known-good R2 backup
4. validate `manifest.json`
5. verify the manifest environment
6. verify the manifest bucket
7. verify expected object count
8. compare PostgreSQL storage keys against manifest keys
9. identify missing objects
10. restore missing objects
11. preserve exact original keys
12. preserve metadata
13. validate SHA-256 after restore
14. validate media Worker delivery
15. smoke-test representative portfolio pages

---

# 38. Recover complete R2 bucket

If the complete R2 bucket must be reconstructed:

1. freeze portfolio write operations
2. do not modify PostgreSQL artwork records
3. create/recover the correct environment bucket
4. use the latest known-good external R2 backup
5. restore all required objects
6. preserve exact object keys
7. preserve metadata
8. verify object count against manifest
9. verify SHA-256
10. configure the Worker R2 binding
11. verify media domain routing
12. validate thumbnails
13. validate display images
14. compare PostgreSQL storage keys against restored R2 objects
15. smoke-test representative artworks
16. resume application writes only after validation

Current bucket names:

```text
DEV
fefierys-assets-dev

QA
fefierys-assets-qa
```

---

# 39. Cloudflare media Worker recovery checks

Current Worker source:

```text
workers/portfolioMediaWorker.js
```

Current DEV media domain:

```text
media-dev.fefierys.com
```

Current QA media domain:

```text
media-qa.fefierys.com
```

Worker binding:

```text
PORTFOLIO_BUCKET
```

must point to the correct environment bucket.

Image transformation binding:

```text
IMAGES
```

must also exist.

After infrastructure recovery validate:

```text
/thumb/<storageKey>
/display/<storageKey>
```

---

# 40. Full PostgreSQL + R2 recovery

If both persistence systems are affected:

## Stage 1 — Database

1. stop writes
2. recover Neon into an isolated branch
3. validate schema
4. validate row counts
5. validate Drizzle history
6. collect required `storageKey` values

## Stage 2 — R2

7. locate known-good R2 backup
8. validate manifest
9. restore required objects
10. preserve exact keys
11. preserve metadata
12. validate SHA-256

## Stage 3 — Integration

13. compare PostgreSQL `storageKey` values against R2
14. validate Worker bindings
15. validate media domain
16. validate `/thumb`
17. validate `/display`
18. smoke-test portfolio
19. smoke-test admin
20. only then switch normal application operation to recovered infrastructure

---

# 41. Portfolio UI recovery smoke test

After significant recovery test:

```text
Portfolio page loads                ✅
Navigation works                    ✅
Pagination works                    ✅
Portrait thumbnails load            ✅
Landscape thumbnails load           ✅
Thumbnail focal points work          ✅
Responsive thumbnails work           ✅
Lightbox opens                       ✅
Original/display images load         ✅
No broken storageKey references      ✅
```

---

# 42. Database recovery checklist

After PostgreSQL recovery verify:

```text
portfolio_sections exists       ✅
portfolio_groups exists         ✅
portfolio_categories exists     ✅
artworks exists                 ✅

expected row counts             ✅
storageKey references           ✅
orientation values              ✅
featured values                 ✅
sort order                      ✅
status                          ✅
focal point fields              ✅

Drizzle migrations              ✅
```

---

# 43. R2 recovery checklist

After R2 recovery verify:

```text
expected objects exist          ✅
exact storage keys preserved    ✅
size matches                    ✅
SHA-256 matches                 ✅
Content-Type matches            ✅
other metadata matches          ✅
Worker can read object          ✅
thumbnail endpoint works        ✅
display endpoint works          ✅
portfolio renders               ✅
```

---

# 44. Admin recovery checklist

After a full application/infrastructure recovery:

```text
/admin without session
→ /admin/login
```

Incorrect credentials:

```text
generic invalid login error
```

Correct credentials:

```text
/admin
```

Sign out:

```text
/admin/login
```

Direct `/admin` after logout:

```text
/admin/login
```

Check browser Network and server logs for errors under:

```text
/api/auth/*
```

---

# 45. Recovery cleanup — Neon

After a recovery drill:

Delete:

```text
temporary recovery branches
temporary pg-restore branches
unused recovery snapshots
```

Do not delete:

```text
a snapshot still required for incident rollback
```

---

# 46. Recovery cleanup — PowerShell

Remove temporary recovery connection values:

```powershell
Remove-Item Env:RECOVERY_DATABASE_URL -ErrorAction SilentlyContinue
Remove-Variable secureUrl -ErrorAction SilentlyContinue
Remove-Item Env:FEFI_BACKUP_FILE -ErrorAction SilentlyContinue
```

---

# 47. Recovery cleanup — R2

The automated `testR2Recovery.ts` should delete objects under:

```text
recovery-restore-test/
```

after successful execution.

Verify that no temporary recovery object remains.

For Bucket Lock testing:

```text
recovery-test/
```

may remain until its retention period expires.

After expiration:

1. delete the test object
2. remove the Bucket Lock rule
3. delete the folder marker if desired

---

# 48. Local backup cleanup

Current backup root:

```text
C:\web_fefi\backups\
```

Keep:

```text
latest known-good backup
backup required for current risky work
backup related to unresolved incident
```

Remove obsolete backups when:

```text
newer backup validated
+
old rollback no longer required
```

Never delete the only validated backup before validating a replacement.

---

# 49. Never commit backup files

Repository:

```text
C:\web_fefi\fefierys-web\
```

Backups:

```text
C:\web_fefi\backups\
```

These locations must remain separate.

Do not commit:

```text
*.dump
R2 downloaded object backups
backup manifests containing operational backup data
.env.local
.env.qa.local
secret values
```

---

# 50. Git-versioned recovery resources

The following resources SHOULD remain versioned:

```text
docs/backup-policy.md
docs/recovery-runbook.md

scripts/backupR2.ts
scripts/testR2Recovery.ts

drizzle/

workers/portfolioMediaWorker.js
```

Any future recovery script should also be versioned unless it contains credentials.

---

# 51. Pre-risky-operation checklist — database

Before a risky database operation confirm:

```text
[ ] Correct environment confirmed
[ ] Correct Neon project confirmed
[ ] Git state understood
[ ] Deployment state understood
[ ] Neon snapshot created if appropriate
[ ] pg_dump created if data matters
[ ] pg_restore --list inspected
[ ] Backup location known
[ ] Rollback plan understood
```

---

# 52. Pre-risky-operation checklist — R2

Before a risky R2 operation confirm:

```text
[ ] Correct environment confirmed
[ ] Correct R2 bucket confirmed
[ ] R2 backup generated
[ ] Expected object count checked
[ ] manifest.json generated
[ ] Backup stored outside repository
[ ] Recovery script available
[ ] No incorrect Bucket Lock affects operation
[ ] Rollback/recovery plan understood
```

---

# 53. Database recovery success criteria

A database recovery is complete only when:

```text
schema valid                 ✅
expected data present        ✅
Drizzle history valid        ✅
storageKey references valid  ✅
application queries work     ✅
```

---

# 54. R2 recovery success criteria

An R2 recovery is complete only when:

```text
objects restored             ✅
exact keys preserved         ✅
SHA-256 validated            ✅
metadata preserved           ✅
Worker delivery works        ✅
portfolio renders correctly  ✅
```

---

# 55. Full Fefierys recovery success criteria

A full recovery is complete only when:

```text
PostgreSQL recovery valid      ✅
R2 recovery valid              ✅
DB ↔ R2 references valid       ✅
media Worker valid             ✅
portfolio UI valid             ✅
admin authentication valid     ✅
normal application operation   ✅
```

---

# 56. Initial validated recovery matrix

| Environment | System | Backup | Restore | Integrity | Metadata |
|---|---|---:|---:|---:|---:|
| DEV | Neon Snapshot | ✅ | ✅ | ✅ | N/A |
| DEV | PostgreSQL pg_dump | ✅ | ✅ | ✅ | N/A |
| DEV | Cloudflare R2 | ✅ | ✅ | ✅ SHA-256 | ✅ |
| QA | Neon Snapshot | ✅ | ✅ | ✅ | N/A |
| QA | PostgreSQL pg_dump | ✅ | ✅ | ✅ | N/A |
| QA | Cloudflare R2 | ✅ | ✅ | ✅ SHA-256 | ✅ |

Additional DEV R2 protection validated:

```text
Bucket Lock DELETE protection      ✅
Bucket Lock OVERWRITE protection   ✅
```

---

# 57. Original Phase 2 recovery drills completed

The original Phase 2 infrastructure work successfully demonstrated:

```text
Neon DEV snapshot recovery       ✅
Neon DEV pg_dump recovery        ✅

Neon QA snapshot recovery        ✅
Neon QA pg_dump recovery         ✅

R2 DEV external backup           ✅
R2 DEV SHA-256 recovery          ✅
R2 DEV metadata recovery         ✅
R2 DEV Bucket Lock               ✅

R2 QA external backup            ✅
R2 QA SHA-256 recovery           ✅
R2 QA metadata recovery          ✅
```

These procedures form the current baseline recovery capability for Fefierys before production infrastructure is introduced.

---

# 58. If something does not match expected results

Do NOT continue automatically.

Examples:

```text
expected 165 objects
but backup contains 162

expected all storageKey populated
but some are null

pg_restore reports errors

SHA-256 mismatch

metadata mismatch

Worker returns 404/500

Drizzle migration count unexpected
```

Stop and investigate before replacing active infrastructure.

Possible causes include:

- wrong environment
- wrong backup
- stale backup
- incomplete migration
- incomplete R2 upload
- corrupted backup
- wrong branch
- wrong bucket
- schema changes since documentation baseline

Recovery documentation should be updated whenever architecture or expected baseline changes.