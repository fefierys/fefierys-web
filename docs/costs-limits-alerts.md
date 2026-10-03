# Fefierys Costs, Limits & Alerts

## Document purpose

This document defines the cost monitoring, usage-limit monitoring, alerting strategy, and upgrade criteria for the Fefierys platform.

It is intended to be usable by an engineer who did not participate in the original infrastructure implementation.

The goals are to ensure that someone maintaining Fefierys can:

- understand which infrastructure providers are currently used
- understand which plans are currently active
- know which usage metrics matter
- know the current validated baseline
- know which limits may interrupt service
- recognize unexpected growth
- understand which metrics can generate charges
- know where to check usage
- know which alerts are configured
- know what thresholds require investigation
- know when an upgrade should be considered
- know what must change before PROD

This document covers:

- Neon PostgreSQL
- Neon Auth
- Cloudflare R2
- Cloudflare Workers
- Cloudflare Images
- Vercel
- Resend

---

# 1. Review date

The initial Phase 2 cost and limit review was completed on:

```text
2026-08-29
```

Provider pricing, quotas, and product terms can change.

Therefore:

> The provider dashboard and current official provider documentation are always the final source of truth.

Before:

- purchasing a paid plan
- creating PROD infrastructure
- changing billing configuration
- relying on a quota for capacity planning

re-check the current provider limits.

---

# 2. Current architecture

The current Fefierys infrastructure is:

```text
Browser
   │
   ├── Next.js application
   │      ↓
   │    Vercel
   │
   ├── Application database
   │      ↓
   │    Neon PostgreSQL
   │
   ├── Admin authentication
   │      ↓
   │    Neon Auth
   │
   ├── Portfolio media
   │      ↓
   │    Cloudflare Worker
   │      ↓
   │    Cloudflare Images
   │      ↓
   │    Cloudflare R2
   │
   └── Transactional email
          ↓
        Resend
```

---

# 3. Current environment isolation

## DEV

```text
Neon:
fefierys-dev

R2:
fefierys-assets-dev

Cloudflare Worker:
fefierys-media-dev

Media domain:
media-dev.fefierys.com

Local environment:
.env.local
```

---

## QA

```text
Neon:
fefierys-qa

R2:
fefierys-assets-qa

Cloudflare Worker:
fefierys-media-qa

Media domain:
media-qa.fefierys.com

QA application domain:
qa.fefierys.com

Local environment:
.env.qa.local
```

---

## PROD

PROD database and R2 infrastructure have intentionally NOT been created yet.

Do not reuse:

```text
DEV
QA
```

resources as PROD.

PROD cost decisions must be reviewed separately before launch.

---

# 4. Current expected infrastructure cost

For the providers reviewed during Phase 2, current DEV/QA operation is expected to remain inside free allowances under normal development usage.

Current reviewed state:

```text
Neon DEV             Free
Neon QA              Free

Cloudflare R2        inside free allowance
Cloudflare Workers   Free
Cloudflare Images    Free

Vercel               Hobby

Resend               Free
```

At the time of review:

```text
Cloudflare billable usage:
$0.00
```

This does NOT include unrelated expenses such as:

- domain registration
- external subscriptions
- future paid PROD plans
- optional provider add-ons

---

# 5. Internal Fefierys usage thresholds

Fefierys uses the following internal thresholds for finite quotas.

```text
NORMAL
0% – <70%

WATCH
70% – <80%

WARNING
80% – <90%

CRITICAL
90% – 100%
```

Interpretation:

## NORMAL

No immediate action.

Continue normal periodic monitoring.

---

## WATCH

Investigate why usage is increasing.

Determine whether:

- growth is expected
- a migration caused temporary usage
- a crawler or bot caused traffic
- inefficient code is generating excess requests
- a cache is not behaving correctly
- an upgrade may eventually be required

---

## WARNING

Action should be planned before the quota is exhausted.

Possible actions:

- optimize
- throttle
- improve caching
- remove unnecessary transformations
- reduce background work
- upgrade plan

---

## CRITICAL

Treat as an operational risk.

Determine immediately whether:

- service will stop
- requests will fail
- the application may be paused
- new transformations may fail
- email sending may stop
- billing may occur

---

# 6. Trend-watch exception

A metric may be marked:

```text
TREND WATCH
```

even below 70% when it is disproportionately larger than other metrics or recently changed architecture should cause it to decline.

Current example:

```text
Vercel Image Transformations
2442 / 5000
48.84%
```

This is still technically:

```text
NORMAL
```

but should be monitored during the next usage cycle.

---

# 7. Neon Free limits

At the time of this review, the relevant Neon Free allowances are:

```text
Compute:
100 CU-hours / month / project

Storage:
0.5 GB / project

Public network transfer:
5 GB / month

Restore history:
up to 6 hours

Branches:
10 / project

Compute autoscaling:
up to 2 CU

Scale to zero:
enabled
```

A CU is a Neon Compute Unit.

Compute usage is consumed while database compute is active.

Scale-to-zero is therefore important for DEV and QA because inactive databases should not continuously consume compute hours.

---

# 8. Neon DEV observed baseline

Observed on 2026-08-29:

```text
Project:
fefierys-dev

Compute:
2.26 / 100 CU-hours

Storage:
0.03 / 0.5 GB

Network transfer:
0.03 / 5 GB

History:
0 GB

Branches:
1 / 10

Restore history:
6 hours

PostgreSQL:
18
```

Approximate utilization:

```text
Compute:
2.26%

Storage:
6%

Network transfer:
0.6%

Branches:
10%
```

Status:

```text
NORMAL ✅
```

No upgrade is currently required.

---

# 9. Neon QA observed baseline

Observed on 2026-08-29:

```text
Project:
fefierys-qa

Compute:
0.62 / 100 CU-hours

Storage:
0.03 / 0.5 GB

Network transfer:
0.01 / 5 GB

History:
0 GB

Branches:
1 / 10

Restore history:
6 hours

PostgreSQL:
18
```

Approximate utilization:

```text
Compute:
0.62%

Storage:
6%

Network transfer:
0.2%

Branches:
10%
```

The compute was observed idle during the review.

Status:

```text
NORMAL ✅
```

No upgrade is currently required.

---

# 10. Neon monitoring location

For each environment:

```text
Neon
→ Project
→ Dashboard / Usage / Monitoring
```

Check:

```text
Compute
Storage
Network transfer
Branches
Restore window
```

---

# 11. Neon warning thresholds

Use the following operational thresholds.

## Compute

```text
< 70 CU-h
NORMAL

70–79 CU-h
WATCH

80–89 CU-h
WARNING

90+ CU-h
CRITICAL
```

---

## Storage

Free limit:

```text
0.5 GB
```

Internal thresholds:

```text
< 0.35 GB
NORMAL

0.35–0.40 GB
WATCH

0.40–0.45 GB
WARNING

> 0.45 GB
CRITICAL
```

---

## Network transfer

Free limit:

```text
5 GB
```

Internal thresholds:

```text
< 3.5 GB
NORMAL

3.5–4 GB
WATCH

4–4.5 GB
WARNING

> 4.5 GB
CRITICAL
```

---

# 12. Neon abnormal usage investigation

If compute usage increases unexpectedly:

Check for:

- excessive database polling
- repeatedly executed server queries
- admin dashboard refresh loops
- scripts left running
- migration scripts
- recovery tests
- database clients keeping compute active
- unexpected traffic
- expensive queries

Verify whether scale-to-zero is still working.

---

# 13. Neon upgrade criteria

DEV and QA should remain on Free while usage remains comfortably below quotas.

Consider a paid Neon plan when:

```text
compute repeatedly approaches Free quota
storage approaches 0.5 GB
longer restore history is required
production reliability requirements increase
production database is created
automated recovery features are required
```

For future PROD, the expected starting candidate is:

```text
Neon Launch
```

At the time of this review, relevant Launch pricing included approximately:

```text
Compute:
$0.106 / CU-hour

Storage:
$0.35 / GB-month

Restore history:
up to 7 days
```

Re-check pricing immediately before creating PROD.

---

# 14. Neon future spending alert

Current DEV and QA projects use Free and therefore do not currently require a paid-usage spending limit.

For future paid Neon infrastructure:

```text
Neon
→ Organization
→ Billing
→ Spending limit
```

Neon currently supports notifications at approximately:

```text
80% of spending limit
100% of spending limit
```

The spending limit should be configured when PROD is moved to a paid plan.

Important:

> Cost alerts are monitoring controls, not a replacement for application-level usage monitoring.

---

# 15. Cloudflare R2 role

Cloudflare R2 stores original portfolio artwork.

Current buckets:

```text
DEV
fefierys-assets-dev

QA
fefierys-assets-qa
```

Main object prefix:

```text
portfolio/artworks/
```

Storage class:

```text
Standard
```

Standard is currently appropriate because portfolio assets are actively served.

---

# 16. Cloudflare R2 Free allowance

Current Standard R2 free allowance:

```text
Storage:
10 GB-month / month

Class A:
1,000,000 operations / month

Class B:
10,000,000 operations / month

Internet egress:
Free
```

The free tier applies to:

```text
Standard storage
```

Do not switch portfolio assets to Infrequent Access solely because its nominal storage price is lower.

Infrequent Access has different billing behavior, including retrieval cost and minimum-duration considerations.

---

# 17. R2 Class A operations

Class A operations generally represent mutation/list-type work such as:

- writes
- multipart operations
- listing operations
- state-changing operations

They are more expensive than Class B after the free allowance.

Free allowance:

```text
1,000,000 / month
```

Current account usage is extremely below this threshold.

---

# 18. R2 Class B operations

Class B operations generally represent object reads and metadata retrieval.

Examples can include:

- GetObject
- HeadObject
- read-oriented access

Free allowance:

```text
10,000,000 / month
```

Current usage is extremely below this threshold.

---

# 19. R2 DEV observed baseline

Last-24-hour bucket metrics observed during Phase 2 review:

```text
Bucket:
fefierys-assets-dev

Average Storage:
55.53 MB

Data Retrieved:
0 B

Class A Operations:
23

Class B Operations:
333

Request Distribution:
330
```

Object listing at the same time showed:

```text
168 objects
```

Important:

The original portfolio baseline contains:

```text
165 portfolio objects
```

DEV had additional temporary recovery-test artifacts from the Bucket Lock / recovery drills.

Therefore:

```text
168
```

must NOT automatically be interpreted as three new portfolio artworks.

After recovery-test cleanup, expected steady-state DEV should be checked again.

---

# 20. R2 QA observed baseline

Last-24-hour metrics:

```text
Bucket:
fefierys-assets-qa

Average Storage:
55.53 MB

Data Retrieved:
0 B

Class A Operations:
4

Class B Operations:
151

Request Distribution:
153

Objects:
165
```

QA matched the original portfolio object baseline:

```text
165
```

Status:

```text
NORMAL ✅
```

---

# 21. R2 account-wide observed baseline

Current billing period observed:

```text
2026-08-24
→
2026-09-24
```

Account usage:

```text
Class A Operations:
466

Class B Operations:
approximately 2.9K

Total Storage:
111.06 MB

Billable Usage:
$0.00
```

Approximate quota utilization:

```text
Storage:
~1.1% of 10 GB

Class A:
~0.047% of 1,000,000

Class B:
~0.029% of 10,000,000
```

Status:

```text
NORMAL ✅
```

---

# 22. R2 monitoring location

Use:

```text
Cloudflare
→ R2 Object Storage
```

For account-level billing usage:

```text
R2 Object Storage
→ Usage
```

For a specific bucket:

```text
R2
→ Bucket
→ Metrics
```

Check:

```text
Average Storage
Object Count
Class A Operations
Class B Operations
Data Retrieved
Requests
```

---

# 23. R2 internal warning thresholds

## Storage

```text
< 7 GB
NORMAL

7–8 GB
WATCH

8–9 GB
WARNING

> 9 GB
CRITICAL
```

---

## Class A

```text
< 700,000
NORMAL

700K–800K
WATCH

800K–900K
WARNING

> 900K
CRITICAL
```

---

## Class B

```text
< 7,000,000
NORMAL

7M–8M
WATCH

8M–9M
WARNING

> 9M
CRITICAL
```

---

# 24. R2 unexpected growth investigation

If R2 Class A operations rise unexpectedly, inspect:

- backup scripts running too frequently
- repeated uploads
- repeated storage migrations
- multipart upload behavior
- repeated object-list operations
- failed upload loops
- admin CMS upload bugs

If Class B rises unexpectedly, inspect:

- unusual public traffic
- crawler traffic
- cache misses
- Worker cache behavior
- backup/recovery scripts repeatedly downloading objects
- application loops requesting media
- direct R2 access bypassing intended caching

If storage rises unexpectedly:

- inspect object count
- detect abandoned objects
- check whether replacement uploads create old unreferenced files
- compare DB `storageKey` values against R2 objects

Do NOT mass-delete suspected orphan objects without creating a recovery backup first.

---

# 25. Cloudflare Workers role

Current media Workers:

```text
DEV
fefierys-media-dev

QA
fefierys-media-qa
```

They provide media routes equivalent to:

```text
/thumb/<storageKey>
/display/<storageKey>
```

They read original assets from R2 and use Cloudflare Images transformations.

---

# 26. Cloudflare Workers Free limits

Relevant Workers Free limits currently include:

```text
Requests:
100,000 / day

CPU:
10 ms / invocation

Memory:
128 MB

Subrequests:
50 / invocation
```

The daily request allowance is an account-plan consideration.

Do not assume each Worker independently receives another full 100K/day allowance.

---

# 27. Workers DEV observed baseline

During the last-24-hour review:

```text
Invocations:
7

Errors:
0

CPU Time:
approximately 628 µs

Wall Time:
approximately 1,094 µs

Request Duration:
approximately 1,032 µs
```

Status:

```text
NORMAL ✅
```

CPU usage is far below the 10 ms Free limit.

---

# 28. Workers QA observed baseline

During the same review:

```text
Invocations:
24

Errors:
0

CPU Time:
approximately 472 µs

Wall Time:
approximately 1,165 µs

Request Duration:
approximately 1,009 µs
```

Status:

```text
NORMAL ✅
```

---

# 29. Workers combined traffic perspective

Observed DEV + QA requests:

```text
7 + 24 = 31
```

Compared with:

```text
100,000 requests/day
```

the current traffic is operationally negligible.

No Workers Paid upgrade is currently justified.

---

# 30. Workers monitoring location

For each Worker:

```text
Cloudflare
→ Workers & Pages
→ Worker
→ Metrics / Observability
```

Monitor:

```text
Invocations
Errors
CPU Time
Wall Time
Request Duration
Subrequests
```

---

# 31. Workers warning criteria

Investigate immediately when:

```text
Errors > 0 consistently
```

or when CPU approaches:

```text
10 ms / invocation
```

Request-count thresholds:

```text
< 70K/day
NORMAL

70K–80K/day
WATCH

80K–90K/day
WARNING

> 90K/day
CRITICAL
```

If traffic is legitimate and sustained near the limit, evaluate Workers Paid.

At the time of this review, Workers Paid started at approximately:

```text
$5 / month minimum account charge
```

Re-check pricing before upgrading.

---

# 32. Cloudflare Images role

The current portfolio image-delivery path is:

```text
R2 original
↓
Cloudflare Worker
↓
Cloudflare Images binding
↓
transformed thumbnail/display image
```

Current thumbnail widths:

```text
400
640
736
800
1200
```

Display rendering can scale down up to approximately:

```text
1800 px
```

The portfolio uses responsive image selection so a visitor generally does not download every width.

---

# 33. Cloudflare Images Free limit

Current Free allowance:

```text
5,000 unique transformations / month
```

A unique transformation is based on the image and transformation parameters.

Repeated requests for an already-known transformation do not necessarily create a new unique transformation count.

When Free exceeds 5,000 unique transformations:

```text
existing cached transformations can continue to work

new transformations can fail with error:
9422

Free does not automatically charge overage
```

An upgrade is required to intentionally exceed the Free transformation allowance.

---

# 34. Cloudflare Images observed baseline

Observed:

```text
189 / 5000
```

Approximate utilization:

```text
3.78%
```

Remaining:

```text
4811
```

Status:

```text
NORMAL ✅
```

No optimization or plan change is currently required.

---

# 35. Cloudflare Images transformation-growth risks

Transformation count can increase when combinations change.

Examples:

```text
same image
+
new width
```

or:

```text
same image
+
new focal point
```

or:

```text
same image
+
new transformation version
```

can create new transformation combinations.

The media system currently contains cache/transformation parameters including:

```text
width
focus X
focus Y
version
```

Therefore unnecessary parameter cardinality should be avoided.

Do not add dozens of arbitrary thumbnail widths without a reason.

---

# 36. Cloudflare Images warning thresholds

```text
< 3500
NORMAL

3500–3999
WATCH

4000–4499
WARNING

4500+
CRITICAL
```

If usage approaches the limit:

1. identify which transformations are being created
2. inspect width variants
3. inspect focal-point variations
4. inspect version/cache-buster changes
5. verify repeated requests are cached
6. determine whether additional variants are actually needed
7. evaluate Images Paid only when justified

---

# 37. Cloudflare Budget Alert

A Cloudflare account-level budget alert was configured during Phase 2.

Initial intended threshold:

```text
USD $1
```

Reason:

```text
Current expected billable Cloudflare usage ≈ $0
```

Therefore even a small non-zero usage-based bill is worth investigating.

The alert monitors usage-based Cloudflare spend across eligible products at the account level.

It is not limited to one R2 bucket.

---

# 38. Important Cloudflare Budget Alert behavior

The Cloudflare budget alert is:

```text
INFORMATIONAL
```

It is NOT:

```text
a spending cap
a service shutdown rule
a hard billing limit
```

Crossing the threshold does not automatically stop Workers, R2, or Images.

When an alert arrives:

1. open Cloudflare Billing
2. inspect Billable Usage
3. identify the product generating the charge
4. determine whether the charge is expected
5. investigate unusual traffic or configuration
6. adjust infrastructure or alert threshold if appropriate

---

# 39. Cloudflare budget monitoring location

Use:

```text
Cloudflare
→ Manage Account
→ Billing
→ Billable Usage
```

Check:

```text
current billing period
usage by product
billable usage
cumulative cost
configured budget alerts
```

The provider billing dashboard/invoice remains the authoritative billing record.

---

# 40. Vercel role

Vercel hosts the Next.js full-stack application.

Current plan:

```text
Hobby
```

Observed project:

```text
fefierys-web
```

The application uses:

- Next.js pages
- server-side application code
- Vercel Functions
- CDN
- analytics
- some Vercel image optimization

Portfolio R2 images now primarily use:

```text
native <img>
+
Cloudflare media URLs
```

rather than routing portfolio thumbnails through Vercel Image Optimization.

---

# 41. Important Vercel Hobby commercial-use check

Vercel currently describes Hobby as intended for:

```text
personal / non-commercial use
```

Fefierys is intended to support a professional artist portfolio and commission workflow.

Therefore:

> Before commercial PROD launch, Vercel plan eligibility must be explicitly re-evaluated even if resource usage remains below Hobby technical limits.

This is independent from capacity.

A site can be technically below Hobby quotas but still require another plan because of intended use.

Current Vercel Pro pricing at the time of review was approximately:

```text
$20 / month
```

with:

```text
$20 included usage credit
advanced spend management
```

Re-check current terms and pricing before PROD launch.

---

# 42. Vercel observed baseline

Observed usage:

```text
Fast Data Transfer:
852.92 MB / 100 GB

Fast Origin Transfer:
208.35 MB / 10 GB

Private Data Transfer:
0 B

Edge Requests:
46,918 / 1,000,000

Edge Request CPU Duration:
12 s / 1 h

Microfrontends Routing:
0 / 50K

ISR Reads:
approximately 12K / 1M

ISR Writes:
0 / 200K

Function Invocations:
approximately 2.8K / 1M

Function Duration:
0 GB-Hrs / 100 GB-Hrs

Fluid Provisioned Memory:
0.21 GB-Hrs / 360 GB-Hrs

Fluid Active CPU:
3m 58s / 4h

Edge Function Execution Units:
0 / 500K

Edge Middleware Invocations:
0 / 1M

Web Analytics Events:
712 / 50K

Speed Insights Events:
0 / 10K

Image Optimization Source Images:
0 / 1,000

Image Transformations:
2,442 / 5,000

Image Cache Reads:
17,237 / 300,000

Image Cache Writes:
17,689 / 100,000

Blob Storage:
0 B / 1 GB

Blob Simple Operations:
0 / 10K

Blob Advanced Operations:
0 / 2K

Blob Data Transfer:
0 B / 10 GB
```

Additional observed values:

```text
Build CPU:
approximately 1h 48m

Deployment Storage:
approximately 3.86 GB
```

These should be tracked for trend even when the dashboard does not present a directly comparable Hobby quota in the same view.

---

# 43. Vercel utilization percentages

Approximate values:

```text
Fast Data Transfer:
0.85%

Fast Origin Transfer:
2.08%

Edge Requests:
4.69%

Edge Request CPU:
0.33%

ISR Reads:
~1.2%

Function Invocations:
~0.28%

Fluid Provisioned Memory:
~0.06%

Fluid Active CPU:
~1.65%

Web Analytics:
~1.42%

Image Transformations:
48.84%

Image Cache Reads:
~5.75%

Image Cache Writes:
~17.69%
```

All are currently:

```text
NORMAL ✅
```

---

# 44. Vercel special trend watch

The most significant Vercel metric is:

```text
Image Transformations

2442 / 5000

48.84%
```

This does not currently cross the Fefierys 70% WATCH threshold.

However it is marked:

```text
TREND WATCH
```

because it is substantially higher than every other quota percentage.

---

# 45. Why Vercel Image Transformations may decrease

Much of the portfolio image architecture has moved away from:

```text
Next/Image
→ Vercel Image Optimization
```

toward:

```text
native <img>
↓
Cloudflare Worker
↓
Cloudflare Images
↓
R2
```

Therefore future usage cycles should show lower portfolio-related Vercel Image Transformation growth.

The next complete Vercel usage cycle should be reviewed to confirm this assumption.

---

# 46. Investigating Vercel Image Transformations

If Image Transformations continue increasing rapidly:

## Dashboard

Check:

```text
Vercel
→ Usage
→ Image Transformations
→ Projects
```

Determine which project causes the usage.

---

## Browser

Open DevTools:

```text
Network
```

filter:

```text
_next/image
```

Requests using that path are normally using Vercel/Next image optimization.

---

## Code

Search the project for:

```text
next/image
```

For example:

```powershell
Get-ChildItem -Recurse -Include *.tsx,*.ts |
  Select-String 'next/image'
```

or, if ripgrep is installed:

```powershell
rg 'next/image'
```

Do not automatically replace every `next/image`.

Only investigate images responsible for unnecessary transformations.

---

# 47. Vercel Image Transformation thresholds

```text
< 3500
NORMAL

3500–3999
WATCH

4000–4499
WARNING

4500+
CRITICAL
```

If the metric exceeds:

```text
3500
```

during a future cycle, investigate immediately rather than waiting for 5000.

---

# 48. Vercel Image Cache Writes

Observed:

```text
17,689 / 100,000
≈ 17.69%
```

Currently:

```text
NORMAL ✅
```

If cache writes rise much faster than reads or traffic, inspect:

- unstable image URLs
- changing query parameters
- unnecessary image dimensions
- cache-busting versions changing frequently
- dynamically generated images

---

# 49. Vercel network usage

Observed:

```text
Fast Data Transfer:
852.92 MB / 100 GB

Fast Origin Transfer:
208.35 MB / 10 GB
```

Both are currently far below quota.

The use of Cloudflare/R2 for portfolio media helps avoid unnecessarily routing large original artwork files through Vercel.

Avoid architectures such as:

```text
Browser
↓
Vercel API proxy
↓
R2
```

for large media downloads when direct Cloudflare delivery is available.

Doing so could unnecessarily consume Vercel transfer quotas.

---

# 50. Vercel compute monitoring

Current values:

```text
Function Invocations:
~2.8K / 1M

Fluid Active CPU:
3m58s / 4h

Provisioned Memory:
0.21 / 360 GB-Hrs
```

No current concern exists.

If Fluid CPU increases unexpectedly, inspect:

- expensive server routes
- accidental polling
- loops
- uncached server rendering
- crawlers hitting expensive dynamic pages
- repeated internal HTTP calls
- expensive OG-image generation
- background jobs

---

# 51. Vercel Deployment Storage

Observed:

```text
3.86 GB
```

This is not currently treated as an incident.

During Phase 2 many deployments were created while testing:

- DEV
- QA
- R2
- Auth
- media architecture
- migration changes

Track deployment storage trend.

Do not aggressively delete deployment history solely to reduce the number without understanding Vercel retention behavior.

---

# 52. Vercel monitoring location

Use:

```text
Vercel
→ Usage
```

Check:

```text
Fast Data Transfer
Fast Origin Transfer
Edge Requests
Edge CPU
Function Invocations
Fluid Active CPU
Fluid Provisioned Memory
Image Transformations
Image Cache Reads
Image Cache Writes
Web Analytics
Deployment Storage
```

Use:

```text
Open in Observability
```

when investigating unusual spikes.

---

# 53. Vercel upgrade criteria

Consider upgrading from Hobby when any of the following is true:

```text
commercial-use requirements require it
usage repeatedly approaches Hobby limits
application availability depends on avoiding quota interruption
team collaboration features are required
advanced spend management is required
traffic becomes production-scale
```

Do not upgrade only because one temporary migration/test cycle created a short-lived usage spike.

---

# 54. Resend role

Resend is used for transactional email.

Current use includes application-generated contact notifications.

Current plan:

```text
Free
```

---

# 55. Resend Free limits

Current observed account allowances:

```text
Monthly transactional:
3000

Daily:
100

Domains:
3
```

Observed account rate limit from:

```text
Settings
→ Usage
```

was:

```text
10 requests / second
```

Important:

Resend's general documentation may describe a different default rate limit.

The effective limit displayed in the account dashboard should be treated as the current account-specific source of truth.

Re-check:

```text
Settings
→ Usage
```

before designing any high-volume workflow.

---

# 56. Resend observed baseline

Observed:

```text
Monthly transactional:
37 / 3000

Daily:
0 / 100

Domains:
1 / 3

Marketing contacts:
0 / 1000

Marketing segments:
1 / 3

Automations:
0 / 10,000

AI credits:
0 / 5
```

Transactional monthly utilization:

```text
37 / 3000
≈ 1.23%
```

Status:

```text
NORMAL ✅
```

---

# 57. Resend Pay-as-you-go

During Phase 2:

```text
Pay-as-you-go:
not enabled
```

Do not enable automatic paid overage merely as a precaution.

When email volume genuinely approaches the Free quota:

1. review actual sending volume
2. investigate abnormal requests
3. estimate expected future volume
4. compare plan options
5. decide deliberately whether to upgrade

---

# 58. Resend email quota thresholds

## Monthly

```text
< 2100
NORMAL

2100–2399
WATCH

2400–2699
WARNING

2700+
CRITICAL
```

Free limit:

```text
3000 / month
```

---

## Daily

```text
< 70
NORMAL

70–79
WATCH

80–89
WARNING

90+
CRITICAL
```

Free limit:

```text
100 / day
```

---

# 59. Resend domain thresholds

Current:

```text
1 / 3 domains
```

No concern.

Before adding more domains, confirm why each sending domain is necessary.

Do not consume domains for temporary environments unless required.

---

# 60. Resend rate-limit handling

If API request rate exceeds the account limit, Resend may return:

```text
HTTP 429
```

When this occurs:

1. stop retry loops
2. inspect response rate-limit headers
3. reduce concurrent requests
4. implement backoff if required
5. consider batching for high-volume workflows
6. request a higher limit only if sustained legitimate usage requires it

Do not solve a rate-limit issue by immediately increasing concurrency.

---

# 61. Resend deliverability limits

Operational email health matters independently from volume quota.

Maintain:

```text
Bounce rate:
< 4%

Spam / complaint rate:
< 0.08%
```

If these values rise:

1. stop unnecessary sends
2. inspect failed/bounced recipients
3. validate addresses
4. investigate possible abuse
5. verify emails are expected by recipients
6. monitor domain reputation

High bounce or complaint rates may result in sending being paused.

---

# 62. Resend monitoring location

Use:

```text
Resend
→ Settings
→ Usage
```

for quota information.

Also inspect:

```text
Emails
Metrics
Logs
Domains
```

Monitor:

```text
sent
delivered
failed
bounced
complaints
429 responses
daily usage
monthly usage
```

---

# 63. Current alert configuration

## Cloudflare

Configured:

```text
Budget alert:
$1
```

Purpose:

```text
Detect unexpected non-zero usage-based Cloudflare spend.
```

Status:

```text
CONFIGURED ✅
```

---

## Neon

Current environments:

```text
Free
```

No paid spending alert required.

Future paid PROD:

```text
configure Spending Limit
```

---

## Vercel

Current:

```text
Hobby
```

Use:

- Vercel built-in usage notifications
- manual quota review

Future Pro:

```text
configure Spend Management
```

---

## Resend

Current:

```text
Free
Pay-as-you-go OFF
```

No spending alert required.

Use quota and deliverability monitoring.

---

# 64. Alert response procedure

Whenever a provider sends a usage/cost alert:

## Step 1

Do not immediately upgrade.

---

## Step 2

Identify:

```text
provider
metric
environment
period
current value
limit
```

---

## Step 3

Determine whether growth is:

```text
expected
temporary
unexpected
```

---

## Step 4

Inspect recent activity:

```text
deployments
migrations
backups
recovery drills
traffic spikes
crawler activity
code changes
bulk operations
```

---

## Step 5

Estimate whether usage will continue.

A one-time migration spike should not be treated the same as sustained production traffic.

---

## Step 6

Choose:

```text
no action
optimize
fix bug
block abusive traffic
improve caching
reduce polling
change architecture
upgrade plan
```

---

# 65. Current risk summary

Current classification:

```text
Neon DEV Compute                NORMAL
Neon DEV Storage                NORMAL
Neon DEV Transfer               NORMAL

Neon QA Compute                 NORMAL
Neon QA Storage                 NORMAL
Neon QA Transfer                NORMAL

R2 Storage                      NORMAL
R2 Class A                      NORMAL
R2 Class B                      NORMAL

Workers Requests                NORMAL
Workers CPU                     NORMAL
Workers Errors                  NORMAL

Cloudflare Images               NORMAL

Vercel Data Transfer            NORMAL
Vercel Origin Transfer          NORMAL
Vercel Edge Requests            NORMAL
Vercel Functions                NORMAL
Vercel Fluid CPU                NORMAL
Vercel Image Cache              NORMAL

Vercel Image Transformations    NORMAL / TREND WATCH

Resend Monthly                  NORMAL
Resend Daily                    NORMAL
Resend Domains                  NORMAL
```

No provider currently requires an upgrade because of technical usage.

---

# 66. Current metrics summary

## Neon DEV

```text
Compute:
2.26 / 100 CU-h

Storage:
0.03 / 0.5 GB

Transfer:
0.03 / 5 GB
```

---

## Neon QA

```text
Compute:
0.62 / 100 CU-h

Storage:
0.03 / 0.5 GB

Transfer:
0.01 / 5 GB
```

---

## R2 account

```text
Storage:
111.06 MB / 10 GB

Class A:
466 / 1,000,000

Class B:
~2,900 / 10,000,000

Billable:
$0.00
```

---

## Workers DEV

```text
Invocations / 24h:
7

Errors:
0
```

---

## Workers QA

```text
Invocations / 24h:
24

Errors:
0
```

---

## Cloudflare Images

```text
189 / 5000
```

---

## Vercel

```text
Fast Data Transfer:
852.92 MB / 100 GB

Fast Origin Transfer:
208.35 MB / 10 GB

Edge Requests:
46,918 / 1M

Edge CPU:
12s / 1h

Function Invocations:
~2.8K / 1M

Fluid CPU:
3m58s / 4h

Image Transformations:
2442 / 5000

Image Cache Reads:
17,237 / 300K

Image Cache Writes:
17,689 / 100K

Analytics:
712 / 50K

Deployment Storage:
3.86 GB
```

---

## Resend

```text
Monthly:
37 / 3000

Daily:
0 / 100

Domains:
1 / 3

Observed account rate limit:
10 req/s
```

---

# 67. Monthly infrastructure review

During active development, review infrastructure approximately once per month or before a major release.

Checklist:

```text
[ ] Neon DEV usage reviewed
[ ] Neon QA usage reviewed

[ ] R2 account usage reviewed
[ ] R2 billable usage reviewed

[ ] Workers requests reviewed
[ ] Workers errors reviewed
[ ] Workers CPU reviewed

[ ] Cloudflare Images transformations reviewed

[ ] Vercel usage reviewed
[ ] Vercel Image Transformations trend reviewed

[ ] Resend monthly quota reviewed
[ ] Resend daily quota reviewed
[ ] Resend bounce/complaint metrics reviewed

[ ] Cloudflare budget alert still configured
[ ] Unexpected costs = $0 or explained
```

---

# 68. Review after major infrastructure work

Run an additional usage review after:

- portfolio migration
- mass R2 upload
- large database migration
- recovery drill
- new image pipeline
- new Worker
- new API endpoint with substantial traffic
- new polling behavior
- major SEO crawl/indexing event
- production launch

This prevents temporary development assumptions from becoming permanent capacity assumptions.

---

# 69. Vercel Image Transformations next-cycle checkpoint

Because:

```text
2442 / 5000
```

was the largest proportional quota observed, the next complete usage cycle should explicitly compare:

```text
previous:
2442
```

with:

```text
new cycle:
<record value>
```

Expected direction after the R2/Cloudflare portfolio migration:

```text
lower growth
```

If the next cycle again approaches:

```text
3500+
```

investigate Vercel image optimization usage.

---

# 70. R2 post-recovery-test cleanup checkpoint

DEV temporarily showed:

```text
168 objects
```

while the portfolio baseline was:

```text
165
```

because recovery/Bucket Lock testing created temporary objects.

After the 1-day Bucket Lock retention expires:

```text
[ ] Delete recovery-test/r2-recovery-test.txt
[ ] Remove recovery-test-lock
[ ] Remove empty recovery-test prefix if applicable
[ ] Re-check DEV object count
```

Do not delete real objects under:

```text
portfolio/artworks/
```

during cleanup.

---

# 71. Cost anomaly examples

Examples that should trigger investigation:

```text
Cloudflare billable usage changes from $0 to non-zero
```

```text
R2 Class B jumps from thousands to millions unexpectedly
```

```text
Workers requests jump from tens/day to tens of thousands/day
```

```text
Neon compute stops scaling to zero
```

```text
Vercel Image Transformations rapidly approach 5000
```

```text
Vercel Fast Origin Transfer grows rapidly
```

```text
Resend email usage increases without matching contact-form activity
```

---

# 72. Possible traffic-abuse indicators

Investigate if usage rises without corresponding legitimate site activity.

Possible causes:

- bots
- crawlers
- hotlinking
- repeated refresh loops
- API abuse
- malformed clients
- automated form spam
- repeated image transformation URLs
- brute-force login attempts

Do not assume legitimate growth before checking request patterns.

---

# 73. Caching cost principle

The media architecture should favor:

```text
stable URL
+
stable transformation parameters
+
cache reuse
```

Avoid generating unnecessary unique query strings.

For example, repeatedly changing:

```text
?v=
```

or transformation parameters may reduce cache reuse and increase unique transformation counts.

Only change cache-version identifiers when invalidation is intentionally required.

---

# 74. DEV and QA cost philosophy

DEV and QA should prioritize:

```text
safety
isolation
realistic testing
low cost
```

They do NOT need production-scale paid capacity while current free tiers comfortably support development.

Upgrade DEV/QA only when a concrete limitation blocks required work.

---

# 75. PROD cost philosophy

PROD should NOT simply copy the cheapest possible DEV configuration.

Before PROD launch evaluate:

```text
availability
commercial plan eligibility
restore requirements
backup automation
traffic expectations
email volume
monitoring
spending controls
recovery objectives
```

Expected likely differences:

```text
Neon
Free → Launch candidate

Vercel
Hobby → re-evaluate commercial eligibility / likely Pro

Cloudflare
Free may remain sufficient initially,
but billing/alerts must stay active

Resend
Free may remain sufficient until email volume grows
```

---

# 76. PROD pre-launch cost checklist

Before PROD:

```text
[ ] Create dedicated Neon PROD
[ ] Re-check current Neon pricing
[ ] Decide Free vs Launch based on production requirements
[ ] Configure Neon Spending Limit if paid

[ ] Create dedicated R2 PROD
[ ] Verify Standard storage class
[ ] Keep Cloudflare Budget Alert active
[ ] Decide PROD Bucket Lock policy

[ ] Create/deploy PROD media Worker
[ ] Verify Workers plan capacity

[ ] Estimate Cloudflare Images transformation volume

[ ] Re-check Vercel plan commercial eligibility
[ ] Re-check Vercel pricing
[ ] Configure Spend Management if using Pro

[ ] Configure PROD Resend sender
[ ] Verify domain
[ ] Estimate transactional email volume
[ ] Decide whether Free remains sufficient

[ ] Update this document with PROD baseline
```

---

# 77. What NOT to do

Do NOT:

```text
upgrade every provider preemptively
```

Do NOT:

```text
enable paid overages everywhere without monitoring
```

Do NOT:

```text
interpret a single test spike as sustained production load
```

Do NOT:

```text
ignore quota growth because current cost is $0
```

Do NOT:

```text
assume provider limits never change
```

Do NOT:

```text
route R2 media through Vercel unnecessarily
```

Do NOT:

```text
create arbitrary image transformation sizes
```

Do NOT:

```text
disable caching without understanding cost impact
```

Do NOT:

```text
enable Resend PAYG merely as a precaution
```

---

# 78. When a plan upgrade is justified

An upgrade is justified when at least one of the following is true:

```text
A required workload cannot fit inside the current limit.

A production reliability requirement needs a paid feature.

Sustained legitimate traffic repeatedly approaches quota.

Commercial terms require another plan.

Recovery requirements require longer retention.

Operational cost of optimization exceeds upgrade cost.

A paid plan materially reduces production risk.
```

---

# 79. When an upgrade is NOT justified

An upgrade is usually not justified only because:

```text
a recovery drill caused temporary usage

a migration caused one-time writes

development created many deployments

one day had unusual manual testing

a metric is non-zero

a quota is less than 70% used and stable
```

---

# 80. Current Phase 2 conclusion

As of the initial Phase 2 review:

```text
Neon DEV
Healthy ✅

Neon QA
Healthy ✅

Cloudflare R2
Healthy ✅

Cloudflare Workers
Healthy ✅

Cloudflare Images
Healthy ✅

Vercel
Healthy ✅

Resend
Healthy ✅
```

No service currently requires an upgrade because of resource usage.

The only metric requiring explicit trend monitoring is:

```text
Vercel Image Transformations
2442 / 5000
```

Current Cloudflare usage-based billing:

```text
$0.00
```

Cloudflare budget monitoring:

```text
$1 alert configured ✅
```

---

# 81. Phase 2 Costs / Limits / Alerts completion criteria

This block is considered complete when:

```text
Neon DEV usage reviewed             ✅
Neon QA usage reviewed              ✅

R2 usage reviewed                   ✅
R2 billing reviewed                 ✅

Workers DEV reviewed                ✅
Workers QA reviewed                 ✅

Cloudflare Images reviewed          ✅

Vercel usage reviewed               ✅
Vercel transformation trend noted   ✅

Resend usage reviewed               ✅

Cloudflare Budget Alert configured  ✅

Internal thresholds documented      ✅
Upgrade criteria documented         ✅
PROD considerations documented      ✅
Monthly review procedure documented ✅
```

---

# 82. Phase 2 infrastructure status

After completing this document, the Phase 2 infrastructure roadmap status is:

```text
FASE 2 — Architecture: DB + Storage + Auth

Database / Neon                 ✅
Drizzle ORM / migrations        ✅

Cloudflare R2                   ✅
Cloudflare Worker               ✅
Cloudflare Images               ✅

Next.js / Vercel integration    ✅

DEV / QA isolation              ✅

Portfolio migration DEV         ✅
Portfolio migration QA          ✅

Authentication DEV              ✅
Authentication QA               ✅

Backups & Recovery              ✅

Costs / Limits / Alerts         ✅
```

PROD infrastructure remains intentionally deferred.

---

# 83. Required documentation set

The Phase 2 operational documentation should now contain:

```text
docs/
├─ backup-policy.md
├─ recovery-runbook.md
└─ costs-limits-alerts.md
```

Together:

```text
backup-policy.md
→ what must be protected and when

recovery-runbook.md
→ how to perform and validate recovery

costs-limits-alerts.md
→ how to monitor capacity, billing and provider limits
```

---

# 84. Source-of-truth rule

When this document and a provider dashboard disagree:

```text
1. Stop.
2. Check the current provider dashboard.
3. Check current official provider documentation.
4. Determine whether the plan changed.
5. Update this document.
```

Do not blindly execute decisions based on an obsolete quota.

---

# 85. Documentation maintenance rule

Update this document whenever any of the following changes:

```text
provider
plan
quota
pricing
environment
bucket
database project
Worker architecture
image transformation strategy
email provider
alert threshold
production infrastructure
```

Add a new review date when major changes are made.

---

# 86. Final operational principle

Cost management for Fefierys should follow:

```text
Measure
↓
Compare
↓
Understand
↓
Optimize if necessary
↓
Upgrade only when justified
```

The goal is not to keep every provider free forever.

The goal is:

```text
predictable costs
+
no surprise bills
+
no preventable quota outages
+
infrastructure appropriate for actual usage
```