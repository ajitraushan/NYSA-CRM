# CRM Test deployment — Agent lifecycle aggregate

Target: `https://crm-test.nysarealty.com/` only. Production deployment is not authorized.

## Correction record

- Amendment ID: R1.1-AMD-016
- Related UAT finding: R1.1-UAT-030
- Agreed requirement: The Sales Agent dashboard shows Lead/New, Contacted, Qualified,
  Viewing, Negotiation and Won current-stage counts, with Lost separate. Counts preserve
  Agent scope and dashboard filters, include zero-count stages and drill to the exact leads
  with stage-appropriate actions. Customer is contextual and is not a lead stage.
- Status: Implemented and automatically tested locally. CRM Test deployment, functional
  retest and explicit NYSA owner confirmation remain pending; the finding is open.
- Retest condition: Reconcile every count and distinct-customer context, drill each non-zero
  stage, open each action, preserve filters, prove cross-Agent denial and confirm desktop and
  narrow-width layouts on CRM Test.

## Package

- Source commit: `4c8266b`
- File: `nysa-core-r1-1-enh-dash-001-crm-test-4c8266b.zip`
- SHA-256: `39cf70b695ebde22ff3d0801c46fcfe44e6fbadc4c15542fee6ef4fb3f73dfaf`
- Migration: none
- Dependency change: none
- Environment-variable change: none

Upload the ZIP to `/home/nysareal/` using cPanel File Manager. Run each block separately
in cPanel Terminal. If an expected result is absent, stop and do not copy files.

## 1. Verify and extract

```bash
sha256sum /home/nysareal/nysa-core-r1-1-enh-dash-001-crm-test-4c8266b.zip
```

Expected SHA-256:

```text
39cf70b695ebde22ff3d0801c46fcfe44e6fbadc4c15542fee6ef4fb3f73dfaf
```

```bash
mkdir -p /home/nysareal/nysa-r1-1-enh-dash-4c8266b-stage

unzip -q -o \
  /home/nysareal/nysa-core-r1-1-enh-dash-001-crm-test-4c8266b.zip \
  -d /home/nysareal/nysa-r1-1-enh-dash-4c8266b-stage
```

## 2. Validate the staged source

```bash
STAGE_DIR="/home/nysareal/nysa-r1-1-enh-dash-4c8266b-stage"
NODE_BIN="/home/nysareal/nodevenv/nysa-core-dashboard-dd6262a-stage/24/bin/node"

"$NODE_BIN" --check "$STAGE_DIR/public/dashboard-ui.js"
"$NODE_BIN" --check "$STAGE_DIR/src/dashboard-domain.js"
"$NODE_BIN" --check "$STAGE_DIR/src/routes/dashboards.js"

printf '%s\n' \
  '68fceca7e590f98c565fef0e0ba97eb29de0a631914a7e5591c08251432e727a  /home/nysareal/nysa-r1-1-enh-dash-4c8266b-stage/public/dashboard-ui.js' \
  '6d269394c911a6beb5bcd3a704eb3ea980aa1aa41eae9b27697b69e4f7ffef60  /home/nysareal/nysa-r1-1-enh-dash-4c8266b-stage/public/index.html' \
  'a1fbb735364f599c6d2bf0413198baf94b33a729428c453cb09f97e8b3cc9ae5  /home/nysareal/nysa-r1-1-enh-dash-4c8266b-stage/src/dashboard-domain.js' \
  '2b97b8721c96a7c88adf8942a9dddf53590615a59e61ae45e97b240f22951f47  /home/nysareal/nysa-r1-1-enh-dash-4c8266b-stage/src/routes/dashboards.js' \
  | sha256sum -c -
```

All four files must report `OK`.

## 3. Back up and deploy only the changed files

```bash
APP_ROOT="/home/nysareal/nysa-core-dashboard-dd6262a-stage"
BACKUP_DIR="/home/nysareal/crm-backups/r1-1-enh-dash-before-4c8266b"

mkdir -p "$BACKUP_DIR/public" "$BACKUP_DIR/src/routes" "$BACKUP_DIR/test"

cp -a "$APP_ROOT/public/dashboard-ui.js" "$BACKUP_DIR/public/dashboard-ui.js"
cp -a "$APP_ROOT/public/index.html" "$BACKUP_DIR/public/index.html"
cp -a "$APP_ROOT/src/dashboard-domain.js" "$BACKUP_DIR/src/dashboard-domain.js"
cp -a "$APP_ROOT/src/routes/dashboards.js" "$BACKUP_DIR/src/routes/dashboards.js"
cp -a "$APP_ROOT/test/dashboard-domain.test.js" "$BACKUP_DIR/test/dashboard-domain.test.js"
cp -a "$APP_ROOT/test/dashboard-requirements.test.js" "$BACKUP_DIR/test/dashboard-requirements.test.js"
```

```bash
APP_ROOT="/home/nysareal/nysa-core-dashboard-dd6262a-stage"
STAGE_DIR="/home/nysareal/nysa-r1-1-enh-dash-4c8266b-stage"

cp -a "$STAGE_DIR/public/dashboard-ui.js" "$APP_ROOT/public/dashboard-ui.js"
cp -a "$STAGE_DIR/public/index.html" "$APP_ROOT/public/index.html"
cp -a "$STAGE_DIR/src/dashboard-domain.js" "$APP_ROOT/src/dashboard-domain.js"
cp -a "$STAGE_DIR/src/routes/dashboards.js" "$APP_ROOT/src/routes/dashboards.js"
cp -a "$STAGE_DIR/test/dashboard-domain.test.js" "$APP_ROOT/test/dashboard-domain.test.js"
cp -a "$STAGE_DIR/test/dashboard-requirements.test.js" "$APP_ROOT/test/dashboard-requirements.test.js"

cmp -s "$STAGE_DIR/public/dashboard-ui.js" "$APP_ROOT/public/dashboard-ui.js" && echo 'dashboard-ui.js MATCH'
cmp -s "$STAGE_DIR/public/index.html" "$APP_ROOT/public/index.html" && echo 'index.html MATCH'
cmp -s "$STAGE_DIR/src/dashboard-domain.js" "$APP_ROOT/src/dashboard-domain.js" && echo 'dashboard-domain.js MATCH'
cmp -s "$STAGE_DIR/src/routes/dashboards.js" "$APP_ROOT/src/routes/dashboards.js" && echo 'dashboards.js MATCH'
```

All four `MATCH` messages are required.

## 4. Restart and verify CRM Test

```bash
APP_ROOT="/home/nysareal/nysa-core-dashboard-dd6262a-stage"

mkdir -p "$APP_ROOT/tmp"
touch "$APP_ROOT/tmp/restart.txt"
sleep 5

curl -sS https://crm-test.nysarealty.com/api/health
echo
```

Expected: `{"ok":true,"database":"ready"}`.

Run the deployed automated suite from the application root, where cPanel dependencies are
installed:

```bash
APP_ROOT="/home/nysareal/nysa-core-dashboard-dd6262a-stage"
NODE_BIN="/home/nysareal/nodevenv/nysa-core-dashboard-dd6262a-stage/24/bin/node"

cd "$APP_ROOT"
"$NODE_BIN" --test --test-isolation=none
```

Expected: 155 tests, 155 pass, 0 fail.

## 5. Functional acceptance

1. Sign in as Sales Agent A and select a period containing controlled leads at every stage.
2. Confirm the lifecycle is the first operational component below the My dashboard tabs,
   before filters and KPI cards. Confirm it is absent from My Tasks.
3. Confirm the visual sequence is Lead, Contacted, Qualified, Viewing, Negotiation, Won,
   with Lost separate and every zero-count stage still visible.
4. Confirm the customer context is a distinct-customer count; two leads for one customer
   increase lead counts by two but customer count by one.
5. Reconcile every displayed stage count against the exact Lead pipeline records.
6. Select each non-zero count and confirm the modal lists only those exact leads.
7. Use every displayed next-action button and confirm it opens the correct lead record.
8. Apply period, source, campaign and stage filters and confirm counts and drill-down agree.
9. Sign in as Sales Agent B and confirm Agent A's leads are absent.
10. Confirm the lifecycle remains readable at desktop and narrow browser widths.
11. Confirm the browser console and `stderr.log` contain no new error.

Do not close R1.1-UAT-030 until the NYSA owner explicitly confirms these CRM Test results.
