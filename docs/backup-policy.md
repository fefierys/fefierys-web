# Fefierys Backup Policy

## Document purpose

This document defines the backup, retention, validation, and recovery policy for the Fefierys platform.

It exists so that application data and original portfolio assets can be recovered after incidents such as:

- accidental deletion
- accidental overwrite
- failed database migrations
- incorrect bulk operations
- data corruption
- provider incidents
- storage mistakes
- failed deployments involving persistent data
- local development machine failure
- loss of one or more portfolio assets
- loss of a database branch
- loss of an R2 bucket

This document describes the current DEV and QA strategy and the intended direction for future PROD infrastructure.

---

# 1. Core recovery principle

A backup is not considered valid simply because backup creation completed successfully.

A backup is considered validated only after:

1. the backup is generated
2. its contents are inspected
3. it is restored into an isolated environment
4. the restored data is validated
5. the restored data matches the expected application state
6. temporary recovery resources are cleaned up

The main recovery rule is:

> Never overwrite an active environment before validating the recovered state whenever an isolated recovery option exists.

For Neon, recovery should normally happen first in:

```text
a temporary Neon branch
```

For Cloudflare R2, recovery tests should normally happen first in:

```text
a temporary R2 prefix
```

Only after validation should an application switch to recovered infrastructure.

---

# 2. Protected systems

Fefierys currently has four important persistence/recovery layers.

## 2.1 PostgreSQL

Provider:

```text
Neon PostgreSQL
```

Current environment mapping:

```text
DEV
Neon project: fefierys-dev

QA
Neon project: fefierys-qa
```

PROD does not currently exist.

Future PROD must use its own dedicated Neon project.

PostgreSQL currently contains application data such as:

- portfolio structure
- portfolio sections
- portfolio groups
- portfolio categories
- artwork records
- R2 `storageKey` references
- artwork orientation
- featured flags
- sorting information
- publication status
- thumbnail focal points
- future CMS data
- future application data

PostgreSQL also contains Drizzle migration history.

---

## 2.2 Cloudflare R2

Current buckets:

```text
DEV
fefierys-assets-dev

QA
fefierys-assets-qa
```

PROD does not currently exist.

The main portfolio object prefix is:

```text
portfolio/artworks/
```

The R2 buckets contain the original portfolio artwork files.

The PostgreSQL `artworks.storageKey` values reference these R2 objects.

Therefore:

> Database recovery and R2 recovery must remain consistent.

Recovering PostgreSQL without recovering referenced R2 objects is not enough.

Recovering R2 objects under different keys without updating PostgreSQL is also not enough.

Where possible, R2 recovery should preserve the exact original object key.

---

## 2.3 GitHub source code

GitHub contains recovery-critical source code including:

- Next.js application code
- Drizzle database schema
- Drizzle SQL migrations
- Cloudflare media Worker source
- portfolio migration scripts
- R2 backup tooling
- R2 recovery tooling
- infrastructure documentation
- backup documentation
- recovery documentation

Important recovery resources currently include:

```text
drizzle/

scripts/backupR2.ts
scripts/testR2Recovery.ts

workers/portfolioMediaWorker.js

docs/backup-policy.md
docs/recovery-runbook.md
```

At the time the initial recovery procedure was validated, the Drizzle SQL migrations were:

```text
0000_futuristic_brood.sql
0001_chilly_slipstream.sql
0002_aromatic_thor.sql
```

The number of migrations will increase over time.

Git therefore forms part of the disaster recovery strategy because it allows the application schema and recovery tooling to be reconstructed.

---

## 2.4 Environment configuration

Environment configuration contains credentials and runtime configuration.

Relevant variable names include:

```text
DATABASE_URL
DATABASE_URL_UNPOOLED

R2_ENDPOINT
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME

NEON_AUTH_BASE_URL
NEON_AUTH_COOKIE_SECRET
ADMIN_USER_ID

NEXT_PUBLIC_APP_ENV
NEXT_PUBLIC_MEDIA_URL
```

Local configuration currently uses:

```text
DEV
.env.local

QA
.env.qa.local
```

Environment files and secret values must never be committed to Git.

---

# 3. Current initial portfolio baseline

The following values represent the initial validated portfolio migration.

These values are useful when reproducing the original recovery drills.

## 3.1 Database baseline

```text
portfolio_sections      3
portfolio_groups        6
portfolio_categories   16
artworks               165
```

---

## 3.2 Storage-key baseline

```text
Total artworks                165
Artworks with storageKey      165
Artworks without storageKey     0
```

---

## 3.3 Drizzle migration baseline

At the time the recovery drill was initially completed:

```text
Drizzle migrations = 3
```

---

## 3.4 R2 object baseline

At the time the initial R2 migration and recovery validation were completed:

```text
portfolio/artworks/ objects = 165
```

One validated DEV R2 backup contained:

```text
Objects: 165
Bytes:   55,525,918
```

The total byte size is informational only.

It can legitimately change when artwork files change.

---

# 4. Important baseline rule

The previous baseline values are historical checkpoints.

They are not permanent invariants.

For example:

```text
artworks = 165
```

is correct for the initial portfolio migration.

After the CMS begins adding or removing artwork, this value will change.

Future recovery procedures must compare restored data against:

1. the expected application state at the backup date
2. the backup manifest
3. known-good database counts
4. operational documentation
5. current application expectations

Therefore:

> Never assume that 165 artworks is permanently correct.

The initial baseline exists so the original Phase 2 recovery drills remain reproducible.

---

# 5. PostgreSQL backup strategy

Fefierys uses multiple PostgreSQL recovery layers.

They solve different problems and should not be considered interchangeable.

Current layers:

```text
Layer 1
Neon Restore History / Instant Restore

Layer 2
Neon Manual Snapshot

Layer 3
External PostgreSQL pg_dump
```

---

# 6. Neon Restore History

During initial validation, the Neon Free plan available to DEV and QA provided:

```text
Restore window: 6 hours
```

Restore history is useful for:

- recent accidental deletion
- recent bad updates
- recent migration mistakes
- recent data corruption
- recent destructive scripts

Preferred recovery flow:

```text
Neon
→ Backup & Restore
→ select recovery point
→ Preview Data
→ Multi-step restore
→ create isolated branch
→ validate
→ migrate connections only if required
```

The preferred option for investigation is:

```text
Multi-step restore
```

because the active branch remains unchanged while recovery is inspected.

A destructive one-step restore should not normally be the first troubleshooting action.

---

# 7. Neon Manual Snapshots

Manual snapshots provide an explicit recovery checkpoint.

Use a manual snapshot before:

- risky schema migrations
- destructive scripts
- large imports
- mass database updates
- significant database refactors
- operations where rollback would otherwise be difficult

Recommended flow:

```text
Create snapshot
↓
perform risky operation
↓
validate operation
↓
keep snapshot while rollback risk exists
↓
delete snapshot when no longer required
```

DEV and QA snapshot recovery were both tested successfully using:

```text
snapshot
→ Multi-step restore
→ isolated branch
→ data validation
→ original production branch unchanged
```

Snapshots are not intended to replace external logical backups.

---

# 8. PostgreSQL logical backups

External PostgreSQL backups use:

```text
pg_dump
pg_restore
psql
```

Recommended client major version:

```text
PostgreSQL 18
```

The initial recovery validation used PostgreSQL 18.6 tools against Neon PostgreSQL 18.6.

A later compatible PostgreSQL 18 client version is acceptable.

Administrative operations use:

```text
DATABASE_URL_UNPOOLED
```

rather than the pooled runtime connection.

Current logical backup scope:

```text
public
drizzle
```

The logical backup includes:

- application schema
- tables
- PostgreSQL enum types
- constraints
- indexes
- table data
- sequences
- Drizzle migration history

---

# 9. Neon Auth limitation of logical backups

The application-level `pg_dump` intentionally backs up:

```text
public
drizzle
```

It does not attempt to back up Neon-managed authentication schemas.

Therefore:

> A `pg_dump` of `public` + `drizzle` is an application-data backup, not a complete backup of every Neon-managed subsystem.

Neon snapshot/restore capabilities are the preferred recovery mechanism when the Neon Auth state itself must be recovered.

If a completely new Neon Auth environment ever has to be recreated manually:

1. enable Neon Auth
2. configure the required domain
3. temporarily enable Email Sign-up
4. create the admin account
5. obtain its new user ID
6. configure `ADMIN_USER_ID`
7. disable public sign-up
8. keep Email Sign-in enabled
9. validate `/admin/login`

A recreated Auth user may have a different ID.

Therefore `ADMIN_USER_ID` may need to be updated.

---

# 10. PostgreSQL backup format

Logical backups use PostgreSQL custom archive format:

```text
--format=custom
```

Backup files use the extension:

```text
.dump
```

Advantages include:

- compressed archive
- compatible with `pg_restore`
- archive content can be inspected
- schema and data can be restored together
- restore behavior can be controlled

Current local backup roots:

```text
C:\web_fefi\backups\fefierys-dev\
C:\web_fefi\backups\fefierys-qa\
```

These directories are deliberately outside:

```text
C:\web_fefi\fefierys-web\
```

so backup files cannot accidentally be committed with the application.

---

# 11. PostgreSQL backup validation

An important PostgreSQL backup must be inspected using:

```powershell
pg_restore --list <backup-file>
```

Expected archive content should include objects equivalent to:

```text
SCHEMA drizzle
SCHEMA public

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

The presence of:

```text
TABLE DATA
```

is important because it confirms that the archive contains table rows rather than only schema definitions.

A successful `pg_dump` alone is not enough to declare a backup validated.

A real recovery drill should be performed for important backup mechanisms.

---

# 12. Cloudflare R2 protection strategy

Fefierys uses several R2 protection layers.

Current layers:

```text
Layer 1
R2 storage durability

Layer 2
Bucket Lock where appropriate

Layer 3
External R2 backup

Layer 4
SHA-256 integrity verification

Layer 5
Recovery drill
```

---

# 13. R2 durability

Cloudflare R2 provides durable object storage.

Provider durability protects against underlying storage failure.

It does not replace application-level protection from:

- accidental deletion
- accidental overwrite
- incorrect scripts
- bad storage migrations
- destructive automation
- incorrect bulk operations

Therefore independent backups are still required for important assets.

---

# 14. Bucket Lock

R2 Bucket Lock can protect matching objects from:

```text
DELETE
OVERWRITE
```

A DEV recovery drill successfully tested Bucket Lock using:

```text
Rule Name:
recovery-test-lock

Prefix:
recovery-test/

Retention:
1 day
```

The test object was:

```text
recovery-test/r2-recovery-test.txt
```

Validation results:

```text
Delete unavailable/rejected       ✅
Overwrite upload rejected         ✅
```

The real portfolio prefix was not affected.

Do not casually apply Bucket Lock to:

```text
portfolio/artworks/
```

in DEV or QA.

Development environments still require controlled deletion and replacement.

PROD may use Bucket Lock after its retention requirements have been finalized.

---

# 15. Immutable storage-key strategy

Where practical, production artwork objects should be treated as immutable.

Preferred replacement model:

```text
existing artwork object
↓
upload replacement as a NEW object
↓
generate new storageKey
↓
validate new object
↓
update database storageKey
↓
retire old object according to retention policy
```

Avoid overwriting an existing original in place when practical.

This reduces the risk of destroying the only good version of an artwork.

---

# 16. External R2 backup tooling

R2 backups are generated by:

```text
scripts/backupR2.ts
```

Supported environment flags:

```text
--dev
--qa
```

The script loads configuration from:

```text
DEV
.env.local

QA
.env.qa.local
```

Safety guards require the expected bucket:

```text
DEV
fefierys-assets-dev

QA
fefierys-assets-qa
```

The script backs up only:

```text
portfolio/artworks/
```

Recovery-test prefixes are deliberately not included.

---

# 17. R2 backup directory structure

Example DEV structure:

```text
C:\web_fefi\backups\fefierys-r2-dev\
└─ <timestamp>\
   ├─ objects\
   │  └─ ...
   └─ manifest.json
```

Example QA structure:

```text
C:\web_fefi\backups\fefierys-r2-qa\
└─ <timestamp>\
   ├─ objects\
   │  └─ ...
   └─ manifest.json
```

Each timestamped directory represents one backup generation.

---

# 18. R2 manifest format

The generated `manifest.json` records backup-level information including:

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

Each object entry contains recovery-critical information including:

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

This allows recovery to validate both:

```text
file bytes
+
object metadata
```

---

# 19. R2 checksum policy

R2 backups use:

```text
SHA-256
```

for integrity validation.

The checksum allows the recovery process to prove that:

```text
backup file bytes
=
expected original bytes
```

and during recovery:

```text
local backup SHA-256
=
restored R2 object SHA-256
```

A matching filename or object key alone is not sufficient recovery validation.

---

# 20. R2 recovery test tooling

Recovery drills use:

```text
scripts/testR2Recovery.ts
```

The script performs a non-destructive recovery test:

```text
manifest
↓
select backed-up artwork
↓
read local backup
↓
validate local size
↓
validate local SHA-256
↓
upload to temporary R2 prefix
↓
download recovered object
↓
validate recovered size
↓
validate recovered SHA-256
↓
validate HTTP metadata
↓
validate custom metadata
↓
delete temporary object
```

The temporary recovery prefix is:

```text
recovery-restore-test/
```

The recovery script must never perform its test by overwriting:

```text
portfolio/artworks/
```

---

# 21. R2 metadata policy

A complete R2 backup should preserve:

```text
Content-Type
Cache-Control
Content-Disposition
Content-Encoding
custom metadata
```

Recovering only object bytes is not considered a complete metadata-aware recovery.

For example:

```text
Content-Type: image/webp
```

may affect how recovered media is handled.

Recovery tests therefore validate both:

```text
bytes
metadata
```

---

# 22. DEV backup policy

DEV does not currently require continuous scheduled backups.

A recovery point should be created before operations such as:

- destructive migrations
- high-risk schema migrations
- mass deletes
- mass updates
- bulk portfolio imports
- major storage migrations
- scripts changing many R2 objects
- experiments involving persistent data

Recommended database protection before high-risk operations:

```text
Neon manual snapshot
+
pg_dump if the data matters
```

Recommended R2 protection:

```text
R2 external backup
+
manifest generation
```

Keep at least:

```text
one known-good recent backup
```

while risky work is in progress.

---

# 23. QA backup policy

QA should remain recoverable before significant validation or release work.

Create recovery points before:

- important schema migrations
- mass data changes
- destructive testing
- large portfolio imports
- R2 migrations
- release validation involving persistent data
- important synchronization between DEV and QA

Recommended database protection:

```text
Neon snapshot
+
pg_dump for significant operations
```

Recommended object-storage protection:

```text
R2 backup before mass modifications
```

Keep at least the latest known-good backup while the related change is being validated.

---

# 24. Future PROD backup policy

PROD infrastructure does not currently exist.

Production backup policy must be finalized before launch.

Expected strategy:

## Neon PROD

Prefer a paid Neon plan with a longer restore window.

Expected protections:

```text
Point-in-Time / Instant Restore
manual snapshots before risky operations
scheduled/automated protection where available
periodic pg_dump
multiple backup generations
regular recovery drills
```

Logical database backups must be stored independently from the production Neon project.

---

## R2 PROD

Expected protections:

```text
periodic external backup
multiple backup generations
SHA-256 integrity manifests
metadata preservation
independent backup storage
immutable storage keys where practical
regular recovery drills
Bucket Lock where appropriate
```

PROD backups must not rely solely on a developer workstation.

---

# 25. Current local backup storage

Current local backup root:

```text
C:\web_fefi\backups\
```

Recommended layout:

```text
C:\web_fefi\backups\
├─ fefierys-dev\
│  └─ *.dump
│
├─ fefierys-qa\
│  └─ *.dump
│
├─ fefierys-r2-dev\
│  └─ <timestamp>\
│     ├─ objects\
│     └─ manifest.json
│
└─ fefierys-r2-qa\
   └─ <timestamp>\
      ├─ objects\
      └─ manifest.json
```

This storage protects against:

- application mistakes
- provider-side data mistakes
- accidental application changes

It does NOT protect against:

- laptop loss
- SSD failure
- ransomware
- local filesystem corruption
- physical destruction of the machine

Important backups should therefore have an independent second copy.

Production backups must not rely solely on:

```text
C:\web_fefi\backups\
```

---

# 26. Backup retention

Current DEV and QA policy:

```text
Retain at least one known-good backup while risky work is active.
```

Old backups may be removed when:

- the operation has been fully validated
- rollback is no longer required
- a newer known-good backup exists
- no unresolved incident depends on the old backup

Do not accumulate unlimited backups without purpose.

Do not delete the only validated backup before validating its replacement.

PROD retention will later be defined according to:

- database growth
- portfolio growth
- frequency of change
- storage cost
- recovery objectives
- business requirements

---

# 27. Secrets policy

Backup files and documentation must never contain secret values.

Never commit:

```text
.env.local
.env.qa.local

DATABASE_URL values
DATABASE_URL_UNPOOLED values

R2_ENDPOINT values if considered sensitive
R2_ACCESS_KEY_ID values
R2_SECRET_ACCESS_KEY values

NEON_AUTH_COOKIE_SECRET values

Resend API keys

passwords
access tokens
session tokens
```

Variable names may appear in documentation.

Secret values may not.

---

# 28. Git policy

The following SHOULD be versioned:

```text
docs/backup-policy.md
docs/recovery-runbook.md

scripts/backupR2.ts
scripts/testR2Recovery.ts

drizzle/

workers/portfolioMediaWorker.js
```

The following MUST NOT be versioned:

```text
*.dump

C:\web_fefi\backups\...

R2 downloaded objects

.env.local
.env.qa.local

secret values
```

---

# 29. Backup validation requirement

A database backup is considered validated when:

```text
backup created                  ✅
archive readable                ✅
schema present                  ✅
table data present              ✅
restore completed               ✅
expected rows present           ✅
Drizzle history present         ✅
storageKey references present   ✅
```

An R2 backup is considered validated when:

```text
backup created                 ✅
expected object count          ✅
manifest generated             ✅
local SHA-256 valid            ✅
temporary restore succeeds     ✅
post-restore SHA-256 matches   ✅
metadata matches               ✅
cleanup succeeds               ✅
```

---

# 30. Recovery-test frequency

Recovery should be tested:

- when a new backup mechanism is introduced
- when a backup format changes
- after significant infrastructure changes
- after changing database architecture
- after changing object-storage architecture
- after changing recovery tooling
- periodically once PROD exists

A backup mechanism that has never been successfully restored must be considered unproven.

---

# 31. Initial validated recovery status

## Neon DEV

Validated:

```text
Manual snapshot                  ✅
Multi-step restore               ✅
Original branch unchanged        ✅
Portfolio counts                 ✅
storageKey validation            ✅
Drizzle history                  ✅
pg_dump                          ✅
pg_restore                       ✅
```

---

## Neon QA

Validated:

```text
Manual snapshot                  ✅
Multi-step restore               ✅
Original branch unchanged        ✅
Portfolio counts                 ✅
storageKey validation            ✅
Drizzle history                  ✅
pg_dump                          ✅
pg_restore                       ✅
```

---

## R2 DEV

Validated:

```text
165-object external backup        ✅
manifest                         ✅
SHA-256                          ✅
HTTP metadata backup             ✅
custom metadata backup           ✅
temporary restore                ✅
post-restore SHA-256             ✅
post-restore metadata            ✅
temporary cleanup                ✅
Bucket Lock delete protection    ✅
Bucket Lock overwrite protection ✅
```

---

## R2 QA

Validated:

```text
165-object external backup       ✅
manifest                        ✅
SHA-256                         ✅
HTTP metadata backup            ✅
custom metadata backup          ✅
temporary restore               ✅
post-restore SHA-256            ✅
post-restore metadata           ✅
temporary cleanup               ✅
```

---

# 32. Phase 2 backup/recovery completion criteria

Backup & Recovery can be considered implemented for DEV and QA when:

```text
Neon DEV snapshot recovery       ✅
Neon DEV pg_dump recovery        ✅

Neon QA snapshot recovery        ✅
Neon QA pg_dump recovery         ✅

R2 DEV backup                    ✅
R2 DEV SHA-256 recovery          ✅
R2 DEV metadata recovery         ✅
R2 DEV Bucket Lock validation    ✅

R2 QA backup                     ✅
R2 QA SHA-256 recovery           ✅
R2 QA metadata recovery          ✅

Backup policy documented         ✅
Recovery runbook documented      ✅
```

PROD backup infrastructure remains intentionally deferred until PROD infrastructure is created.