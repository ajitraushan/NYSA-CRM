# DEV273 revised CRM Test Phase A command

Prepared only. Nothing in this file authorizes a hosted command. Ajit's separate written go is required for Phase A.

## Exact pins

- Candidate: `aab0ea5d0a8496940e05179f9f3bb753b92d0521`
- Package: `359245bfec120d3c0e1c3743851fd6daa7ac439168f1989f4792f9388d3b51ba`
- Manifest: `35f1a8eee5a7490ec055da26be8490065d9603012ecb023237b955b7edc8125f`
- Install config: `6b1be76a05647fb82189d4921cef8cc6e5f72d0b3b9e0c08050835fc8cacb353`
- Operator commit: `12d924f8564bf38b91b90fcd186336b213f742a2`
- Operator: `0d66f2617c5ff5fc8fb01cd808dc3df46999d19d6432979685f1bc772515d34e`
- Worker helper: `9fc1fb65580c0c71ae0335f4dd8e3a3d6e4ac005fb6de916af6bc51851242e88`
- Backup-verification helper: `b682d446d3a422d1c325eb5a6e2bcfd749f3b396ffd58e0df77fef2f862bf215`
- Trigger-contract helper: `b95c369e7f8ba2a199aaa5de3b2fe7e1592ca7b52b6d4fc9dddfd02caebd2fcd`

Before connecting, run `ssh-add -l`. If no identity is available, stop and ask Ajit to load it. Use the agent only; never pass `-i`.

The three candidate inputs belong at `/home/nysareal/crm-release-preparation/20261114-dev273-r2-install/`. The four tools belong in a new directory `/home/nysareal/crm-release-preparation/20261114-dev273-r2-tools-12d924f8/`, downloaded from the exact operator commit. Before the run, the package, manifest, config and four tools must pass `sha256sum -c`; the candidate directory, evidence directory, scoped-backup directory and all four result paths must be absent.

## Exact hosted Phase A invocation

```sh
/opt/alt/alt-nodejs24/root/usr/bin/node /home/nysareal/crm-release-preparation/20261114-dev273-r2-tools-12d924f8/crm-test-direct-node-release-operator.mjs --config /home/nysareal/crm-release-preparation/20261114-dev273-r2-install/DEV273_CRM_TEST_INSTALL.json --backup-path /home/nysareal/crm-release-preparation/20261114-dev273-r2-install/scoped-backup --phase stage --approved aab0ea5d0a8496940e05179f9f3bb753b92d0521:stage
```

## Agent-only SSH with full local receipt

The receipt directory and file must be new before the run.

```powershell
$receipt = 'C:\Users\ajitr\.codex\worktrees\dev273-customer-lead-visibility\canonical-worktree\release-artifacts\dev273\hosted-phase-a-r2\STAGE_FULL.txt'
ssh nysareal@jutee.tasjeel.ae -- '/opt/alt/alt-nodejs24/root/usr/bin/node /home/nysareal/crm-release-preparation/20261114-dev273-r2-tools-12d924f8/crm-test-direct-node-release-operator.mjs --config /home/nysareal/crm-release-preparation/20261114-dev273-r2-install/DEV273_CRM_TEST_INSTALL.json --backup-path /home/nysareal/crm-release-preparation/20261114-dev273-r2-install/scoped-backup --phase stage --approved aab0ea5d0a8496940e05179f9f3bb753b92d0521:stage' 2>&1 | Tee-Object -LiteralPath $receipt
$phaseExit = $LASTEXITCODE
if ($phaseExit -ne 0) { throw "DEV273 Phase A stopped with exit code $phaseExit; no retry" }
```

Stop after `STAGE_RESULT.json`. Do not run backup without a new written go.
