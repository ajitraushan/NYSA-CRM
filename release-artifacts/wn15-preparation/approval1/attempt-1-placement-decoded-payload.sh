set -euo pipefail
ROOT=/home/nysareal/crm-release-preparation/20261111-wn15
TOOLS="$ROOT/tools"
EVID="$ROOT/preflight/APPROVAL1_PLACEMENT_RESULT.txt"
[ ! -e "$EVID" ] || { echo 'FAIL evidence path exists'; exit 20; }
mkdir -p "$TOOLS"
exec > >(tee "$EVID") 2>&1
echo "PLACEMENT_STARTED $(date -u +%Y-%m-%dT%H:%M:%SZ)"
for f in whatsapp-simulation-load.mjs whatsapp-simulation-cleanup.mjs wn15-team-state-readonly.sql wn15-load-and-cleanup-tools.test.js; do
  [ ! -e "$TOOLS/$f" ] || { echo "FAIL destination exists $TOOLS/$f"; exit 21; }
  [ ! -e "$TOOLS/.$f.5703868c.tmp" ] || { echo "FAIL temporary path exists $TOOLS/.$f.5703868c.tmp"; exit 22; }
done
curl --fail --silent --show-error --location --retry 0 'https://raw.githubusercontent.com/ajitraushan/NYSA-CRM/5703868caedfe6d1f2a6d00cca6c1f61b6a4105d/tools/whatsapp-simulation-load.mjs' --output "$TOOLS/.whatsapp-simulation-load.mjs.5703868c.tmp"
curl --fail --silent --show-error --location --retry 0 'https://raw.githubusercontent.com/ajitraushan/NYSA-CRM/5703868caedfe6d1f2a6d00cca6c1f61b6a4105d/tools/whatsapp-simulation-cleanup.mjs' --output "$TOOLS/.whatsapp-simulation-cleanup.mjs.5703868c.tmp"
curl --fail --silent --show-error --location --retry 0 'https://raw.githubusercontent.com/ajitraushan/NYSA-CRM/5703868caedfe6d1f2a6d00cca6c1f61b6a4105d/tools/wn15-team-state-readonly.sql' --output "$TOOLS/.wn15-team-state-readonly.sql.5703868c.tmp"
curl --fail --silent --show-error --location --retry 0 'https://raw.githubusercontent.com/ajitraushan/NYSA-CRM/5703868caedfe6d1f2a6d00cca6c1f61b6a4105d/test/wn15-load-and-cleanup-tools.test.js' --output "$TOOLS/.wn15-load-and-cleanup-tools.test.js.5703868c.tmp"
sha256sum "$TOOLS"/.*.5703868c.tmp
[ "$(sha256sum "$TOOLS/.whatsapp-simulation-load.mjs.5703868c.tmp" | awk '{print $1}')" = '8c3fce6520a61b75bfdc0dfdeac1796dd05fa550cdd176324883063a166dd8d6' ]
[ "$(sha256sum "$TOOLS/.whatsapp-simulation-cleanup.mjs.5703868c.tmp" | awk '{print $1}')" = 'a61e544a22d1d43a8757cd788815b5f1b9ec2dd42ae137922be629237d29b72c' ]
[ "$(sha256sum "$TOOLS/.wn15-team-state-readonly.sql.5703868c.tmp" | awk '{print $1}')" = 'a8f1f8dcf38a353590c257810449ff50e49e7bff73baf3c0e8d785ac871fe09b' ]
[ "$(sha256sum "$TOOLS/.wn15-load-and-cleanup-tools.test.js.5703868c.tmp" | awk '{print $1}')" = '9827e7adbe3be90077818b82689d6eaaea23eeeb41ad578000b8106f67b7871f' ]
mv "$TOOLS/.whatsapp-simulation-load.mjs.5703868c.tmp" "$TOOLS/whatsapp-simulation-load.mjs"
mv "$TOOLS/.whatsapp-simulation-cleanup.mjs.5703868c.tmp" "$TOOLS/whatsapp-simulation-cleanup.mjs"
mv "$TOOLS/.wn15-team-state-readonly.sql.5703868c.tmp" "$TOOLS/wn15-team-state-readonly.sql"
mv "$TOOLS/.wn15-load-and-cleanup-tools.test.js.5703868c.tmp" "$TOOLS/wn15-load-and-cleanup-tools.test.js"
echo 'PLACEMENT_FINAL_HASHES'
sha256sum "$TOOLS/whatsapp-simulation-load.mjs" "$TOOLS/whatsapp-simulation-cleanup.mjs" "$TOOLS/wn15-team-state-readonly.sql" "$TOOLS/wn15-load-and-cleanup-tools.test.js"
echo "PLACEMENT_COMPLETE $(date -u +%Y-%m-%dT%H:%M:%SZ)"
