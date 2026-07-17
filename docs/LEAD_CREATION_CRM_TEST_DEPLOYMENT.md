# Lead Creation Review - CRM Test Deployment

Target: `https://crm-test.nysarealty.com/` only. Do not run this deployment against
production.

## What to upload

Upload the package ZIP and its companion shell script to `/home/nysareal/` in cPanel
File Manager. Do not extract the ZIP manually and do not place either file in a
production application directory.

The final artifact names and SHA-256 value are supplied with the package handoff.

## What “deployment window” means

No maintenance page or cPanel maintenance switch is required. Ask CRM Test users not
to save records for approximately two minutes while the script copies the checked
files and restarts the test application.

## Run from cPanel Terminal

```bash
cd /home/nysareal

chmod 700 deploy-crm-test-lead-creation-<commit>.sh

bash deploy-crm-test-lead-creation-<commit>.sh \
  /home/nysareal/nysa-core-r1-uat-lead-creation-crm-test-<commit>.zip \
  <sha256>
```

The script prompts once for the CRM Test database password without displaying it. It
then:

1. verifies the exact package checksum and CRM Test database identity;
2. creates and validates a custom PostgreSQL backup;
3. creates and validates an application backup;
4. extracts into a temporary staging directory and rejects `.env`, `node_modules` and
   the private defect workbook;
5. syntax-checks staged JavaScript before copying it;
6. updates only the CRM Test application and requests a cPanel/Passenger restart;
7. verifies `/api/health`, migrations `017` and `018`, and the revised lead-creation
   browser marker.

The successful final line is:

```text
CRM Test lead-creation deployment succeeded.
```

If the script stops, do not deploy to production and do not repeatedly restart the
application. Preserve the displayed database/application backup paths and the exact
error. If it specifically reports that the migrations were not recorded, use cPanel
**Setup Node.js App > Restart Application** once and recheck CRM Test health and the
two migration rows.

## Required CRM Test retest

- Create a lead with an existing customer found by typing part of the name.
- Enter K/M budget shorthand and multiple comma-separated preferred areas.
- Confirm no broker can be selected during capture and the lead enters the correct
  unassigned team queue.
- Confirm only the responsible team lead or Director can make the initial assignment.
- Open Structured requirements and verify the preferred areas and budget are prefilled.
- Run the maintained qualification questions and verify the calculated result.
- Confirm the originating-property label is clear and does not limit later matching.

Record the applicable Amendment ID and evidence. No finding is closed until the user
explicitly confirms the CRM Test result.
