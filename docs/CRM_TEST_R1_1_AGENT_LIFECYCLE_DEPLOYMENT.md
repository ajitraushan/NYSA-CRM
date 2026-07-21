# CRM Test deployment — Agent lifecycle aggregate

Target: `https://crm-test.nysarealty.com/` only. Production deployment is not authorized.

## Correction record

- Amendment ID: R1.1-AMD-016
- Related UAT finding: R1.1-UAT-030
- Agreed requirement: The Sales Agent dashboard shows Lead/New, Contacted, Qualified,
  Viewing, Negotiation and Won current-stage counts, with Lost separate. Counts preserve
  Agent scope and dashboard filters, include zero-count stages and drill to the exact leads
  with stage-appropriate actions. Customer is contextual and is not a lead stage. A successful
  stage change from drill-down must automatically refresh the filtered dashboard without a
  manual browser refresh.
- Status: Implemented and automatically tested locally. CRM Test deployment, functional
  retest and explicit NYSA owner confirmation remain pending; the finding is open.
- Retest condition: Reconcile every count and distinct-customer context, drill each non-zero
  stage, change a lead stage and confirm the aggregate refreshes immediately, preserve filters,
  prove cross-Agent denial and confirm desktop and narrow-width layouts on CRM Test.

## Package

- Source commit: `eee18a7`
- File: `nysa-core-r1-1-lifecycle-auto-refresh-crm-test-eee18a7.zip`
- SHA-256: `8e4ee8d0bf5326bd242fa990b7f1ed76c35c1047d804f414e2ef283412709837`
- Migration: none
- Dependency change: none
- Environment-variable change: none

Upload the ZIP to `/home/nysareal/` using cPanel File Manager. Run each block separately
in cPanel Terminal. If an expected result is absent, stop and do not copy files.

## 1. Verify and extract

```bash
sha256sum /home/nysareal/nysa-core-r1-1-lifecycle-auto-refresh-crm-test-eee18a7.zip
```

Expected SHA-256:

```text
8e4ee8d0bf5326bd242fa990b7f1ed76c35c1047d804f414e2ef283412709837
```

```bash
mkdir -p /home/nysareal/nysa-r1-1-lifecycle-refresh-eee18a7-stage

unzip -q -o \
  /home/nysareal/nysa-core-r1-1-lifecycle-auto-refresh-crm-test-eee18a7.zip \
  -d /home/nysareal/nysa-r1-1-lifecycle-refresh-eee18a7-stage
```

## 2. Validate the staged source

```bash
STAGE_DIR="/home/nysareal/nysa-r1-1-lifecycle-refresh-eee18a7-stage"
NODE_BIN="/home/nysareal/nodevenv/nysa-core-dashboard-dd6262a-stage/24/bin/node"

"$NODE_BIN" --check "$STAGE_DIR/public/app.js"
"$NODE_BIN" --check "$STAGE_DIR/public/dashboard-ui.js"

printf '%s\n' \
  '7b46818d4d4b6c1c22498dd1e46c35920444713407ea3ce36f2e221af63c681e  /home/nysareal/nysa-r1-1-lifecycle-refresh-eee18a7-stage/public/app.js' \
  'd9f774bdc858f5361b7dac88c61ba0f72f48b10a6fd1b970586b2c0fe41300d0  /home/nysareal/nysa-r1-1-lifecycle-refresh-eee18a7-stage/public/dashboard-ui.js' \
  '4e21f778b134b1a2ed0f0f72005cb79228dbe4060ca6dd5090fc15a091a468af  /home/nysareal/nysa-r1-1-lifecycle-refresh-eee18a7-stage/public/index.html' \
  | sha256sum -c -
```

All three files must report `OK`.

## 3. Back up and deploy only the changed files

```bash
APP_ROOT="/home/nysareal/nysa-core-dashboard-dd6262a-stage"
BACKUP_DIR="/home/nysareal/crm-backups/r1-1-lifecycle-refresh-before-eee18a7"

mkdir -p "$BACKUP_DIR/public" "$BACKUP_DIR/test"

cp -a "$APP_ROOT/public/app.js" "$BACKUP_DIR/public/app.js"
cp -a "$APP_ROOT/public/dashboard-ui.js" "$BACKUP_DIR/public/dashboard-ui.js"
cp -a "$APP_ROOT/public/index.html" "$BACKUP_DIR/public/index.html"
cp -a "$APP_ROOT/test/dashboard-requirements.test.js" "$BACKUP_DIR/test/dashboard-requirements.test.js"
```

```bash
APP_ROOT="/home/nysareal/nysa-core-dashboard-dd6262a-stage"
STAGE_DIR="/home/nysareal/nysa-r1-1-lifecycle-refresh-eee18a7-stage"

cp -a "$STAGE_DIR/public/app.js" "$APP_ROOT/public/app.js"
cp -a "$STAGE_DIR/public/dashboard-ui.js" "$APP_ROOT/public/dashboard-ui.js"
cp -a "$STAGE_DIR/public/index.html" "$APP_ROOT/public/index.html"
cp -a "$STAGE_DIR/test/dashboard-requirements.test.js" "$APP_ROOT/test/dashboard-requirements.test.js"

cmp -s "$STAGE_DIR/public/app.js" "$APP_ROOT/public/app.js" && echo 'app.js MATCH'
cmp -s "$STAGE_DIR/public/dashboard-ui.js" "$APP_ROOT/public/dashboard-ui.js" && echo 'dashboard-ui.js MATCH'
cmp -s "$STAGE_DIR/public/index.html" "$APP_ROOT/public/index.html" && echo 'index.html MATCH'
```

All three `MATCH` messages are required.

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

Expected: 156 tests, 156 pass, 0 fail.

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
8. From a non-zero stage, open a lead and change it to the next permitted stage. Without a
   browser refresh, confirm the old count decreases, the new count increases, the stale
   contributing-record list closes and the updated lead remains open.
9. Close the lead and confirm the original period, source, campaign and stage filters remain.
10. Sign in as Sales Agent B and confirm Agent A's leads are absent.
11. Confirm the lifecycle remains readable at desktop and narrow browser widths.
12. Confirm the browser console and `stderr.log` contain no new error.

Do not close R1.1-UAT-030 until the NYSA owner explicitly confirms these CRM Test results.
