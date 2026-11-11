set -euo pipefail
BASE=/home/nysareal/crm-release-preparation/20261111-wn15
TOOLS="$BASE/tools"
EVID="$BASE/preflight/APPROVAL1_RETRY2_PLACEMENT_RESULT.txt"
ETMP="$EVID.tmp"
COMMIT=5703868caedfe6d1f2a6d00cca6c1f61b6a4105d
mkdir -p "$TOOLS"
test ! -e "$EVID"
test ! -e "$ETMP"
for f in whatsapp-simulation-load.mjs whatsapp-simulation-cleanup.mjs wn15-team-state-readonly.sql wn15-load-and-cleanup-tools.test.js; do test ! -e "$TOOLS/$f"; test ! -e "$TOOLS/.$f.retry2.tmp"; done
umask 077
{
 echo "PLACEMENT_RETRY2_STARTED=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
 curl -fsSL "https://raw.githubusercontent.com/ajitraushan/NYSA-CRM/$COMMIT/tools/whatsapp-simulation-load.mjs" -o "$TOOLS/.whatsapp-simulation-load.mjs.retry2.tmp"
 curl -fsSL "https://raw.githubusercontent.com/ajitraushan/NYSA-CRM/$COMMIT/tools/whatsapp-simulation-cleanup.mjs" -o "$TOOLS/.whatsapp-simulation-cleanup.mjs.retry2.tmp"
 curl -fsSL "https://raw.githubusercontent.com/ajitraushan/NYSA-CRM/$COMMIT/tools/wn15-team-state-readonly.sql" -o "$TOOLS/.wn15-team-state-readonly.sql.retry2.tmp"
 curl -fsSL "https://raw.githubusercontent.com/ajitraushan/NYSA-CRM/$COMMIT/test/wn15-load-and-cleanup-tools.test.js" -o "$TOOLS/.wn15-load-and-cleanup-tools.test.js.retry2.tmp"
 printf '%s  %s
' 8c3fce6520a61b75bfdc0dfdeac1796dd05fa550cdd176324883063a166dd8d6 "$TOOLS/.whatsapp-simulation-load.mjs.retry2.tmp" a61e544a22d1d43a8757cd788815b5f1b9ec2dd42ae137922be629237d29b72c "$TOOLS/.whatsapp-simulation-cleanup.mjs.retry2.tmp" a8f1f8dcf38a353590c257810449ff50e49e7bff73baf3c0e8d785ac871fe09b "$TOOLS/.wn15-team-state-readonly.sql.retry2.tmp" 9827e7adbe3be90077818b82689d6eaaea23eeeb41ad578000b8106f67b7871f "$TOOLS/.wn15-load-and-cleanup-tools.test.js.retry2.tmp" | sha256sum -c -
 mv "$TOOLS/.whatsapp-simulation-load.mjs.retry2.tmp" "$TOOLS/whatsapp-simulation-load.mjs"
 mv "$TOOLS/.whatsapp-simulation-cleanup.mjs.retry2.tmp" "$TOOLS/whatsapp-simulation-cleanup.mjs"
 mv "$TOOLS/.wn15-team-state-readonly.sql.retry2.tmp" "$TOOLS/wn15-team-state-readonly.sql"
 mv "$TOOLS/.wn15-load-and-cleanup-tools.test.js.retry2.tmp" "$TOOLS/wn15-load-and-cleanup-tools.test.js"
 echo "PLACEMENT_RETRY2_COMPLETED=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
 sha256sum "$TOOLS/whatsapp-simulation-load.mjs" "$TOOLS/whatsapp-simulation-cleanup.mjs" "$TOOLS/wn15-team-state-readonly.sql" "$TOOLS/wn15-load-and-cleanup-tools.test.js"
} > "$ETMP" 2>&1
mv "$ETMP" "$EVID"
cat "$EVID"