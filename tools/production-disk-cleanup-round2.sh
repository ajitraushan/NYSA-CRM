#!/bin/bash
set -euo pipefail
export LC_ALL=C

if (( $# != 0 )) || [[ $(id -un) != nysareal ]]; then
  printf 'Run without arguments as the nysareal hosting account\n' >&2
  exit 1
fi

home_root=/home/nysareal
if [[ $(realpath -e -- "$home_root") != "$home_root" ]]; then
  printf 'Unexpected account root\n' >&2
  exit 1
fi

check_target() {
  local path=$1 type=$2 expected=$3 output actual
  if [[ -L $path || $(realpath -e -- "$path") != "$path" ]] ||
     [[ $type == directory && ! -d $path ]] ||
     [[ $type == file && ! -f $path ]]; then
    printf 'Missing path, symlink, or type mismatch: %s\n' "$path" >&2
    exit 1
  fi
  output=$(du --summarize --one-file-system --no-dereference --apparent-size --block-size=1 -- "$path")
  actual=${output%%$'	'*}
  if [[ $actual != "$expected" ]]; then
    printf 'Size mismatch: %s expected %s, got %s\n' "$path" "$expected" "$actual" >&2
    exit 1
  fi
}

confirm_removed() {
  if [[ -e $1 || -L $1 ]]; then
    printf 'Target still exists: %s\n' "$1" >&2
    exit 1
  fi
  printf 'Removed %s\n' "$1"
}

# Complete the precheck for every target before reaching any rm.
check_target '/home/nysareal/.dev144s-000' file 98304
check_target '/home/nysareal/.dev144s-001' file 98304
check_target '/home/nysareal/.dev144s-002' file 98304
check_target '/home/nysareal/.dev144s-003' file 98304
check_target '/home/nysareal/.dev144s-004' file 98304
check_target '/home/nysareal/.dev144s-005' file 98304
check_target '/home/nysareal/.dev144s-006' file 98304
check_target '/home/nysareal/.dev144s-007' file 98304
check_target '/home/nysareal/.dev144s-008' file 98304
check_target '/home/nysareal/.dev144s-009' file 98304
check_target '/home/nysareal/.dev144s-010' file 98304
check_target '/home/nysareal/.dev144s-011' file 98304
check_target '/home/nysareal/.dev144s-012' file 98304
check_target '/home/nysareal/.dev144s-013' file 98304
check_target '/home/nysareal/.dev144s-014' file 98304
check_target '/home/nysareal/.dev144s-015' file 98304
check_target '/home/nysareal/.dev144s-016' file 98304
check_target '/home/nysareal/.dev144s-017' file 98304
check_target '/home/nysareal/.dev144s-018' file 98304
check_target '/home/nysareal/.dev144s-019' file 98304
check_target '/home/nysareal/.dev144s-020' file 98304
check_target '/home/nysareal/.dev144s-021' file 98304
check_target '/home/nysareal/.dev144s-022' file 98304
check_target '/home/nysareal/.dev144s-023' file 98304
check_target '/home/nysareal/.dev144s-024' file 98304
check_target '/home/nysareal/.dev144s-025' file 98304
check_target '/home/nysareal/.dev144s-026' file 98304
check_target '/home/nysareal/.dev144s-027' file 98304
check_target '/home/nysareal/.dev144s-028' file 98304
check_target '/home/nysareal/.dev144s-029' file 98304
check_target '/home/nysareal/.dev144s-030' file 98304
check_target '/home/nysareal/.dev144s-031' file 98304
check_target '/home/nysareal/.dev144s-032' file 98304
check_target '/home/nysareal/.dev144s-033' file 98304
check_target '/home/nysareal/.dev144s-034' file 98304
check_target '/home/nysareal/.dev144s-035' file 98304
check_target '/home/nysareal/.dev144s-036' file 98304
check_target '/home/nysareal/.dev144s-037' file 98304
check_target '/home/nysareal/.dev144s-038' file 98304
check_target '/home/nysareal/.dev144s-039' file 98304
check_target '/home/nysareal/.dev144s-040' file 98304
check_target '/home/nysareal/.dev144s-041' file 98304
check_target '/home/nysareal/.dev144s-042' file 98304
check_target '/home/nysareal/.dev144s-043' file 98304
check_target '/home/nysareal/.dev144s-044' file 98304
check_target '/home/nysareal/.dev144s-045' file 98304
check_target '/home/nysareal/.dev144s-046' file 98304
check_target '/home/nysareal/.dev144s-047' file 98304
check_target '/home/nysareal/.dev144s-048' file 98304
check_target '/home/nysareal/.dev144s-049' file 98304
check_target '/home/nysareal/.dev144s-050' file 98304
check_target '/home/nysareal/.dev144s-051' file 98304
check_target '/home/nysareal/.dev144s-052' file 98304
check_target '/home/nysareal/.dev144s-053' file 98304
check_target '/home/nysareal/.dev144s-054' file 98304
check_target '/home/nysareal/.dev144s-055' file 98304
check_target '/home/nysareal/.dev144s-056' file 98304
check_target '/home/nysareal/.dev144s-057' file 98304
check_target '/home/nysareal/.dev144s-058' file 98304
check_target '/home/nysareal/.dev144s-059' file 98304
check_target '/home/nysareal/.dev144s-060' file 98304
check_target '/home/nysareal/.dev144s-061' file 98304
check_target '/home/nysareal/.dev144s-062' file 98304
check_target '/home/nysareal/.dev144s-063' file 98304
check_target '/home/nysareal/.dev144s-064' file 98304
check_target '/home/nysareal/.dev144s-065' file 98304
check_target '/home/nysareal/.dev144s-066' file 98304
check_target '/home/nysareal/.dev144s-067' file 98304
check_target '/home/nysareal/.dev144s-068' file 98304
check_target '/home/nysareal/.dev144s-069' file 98304
check_target '/home/nysareal/.dev144s-070' file 98304
check_target '/home/nysareal/.dev144s-071' file 98304
check_target '/home/nysareal/.dev144s-072' file 98304
check_target '/home/nysareal/.dev144s-073' file 98304
check_target '/home/nysareal/.dev144s-074' file 98304
check_target '/home/nysareal/.dev144s-075' file 98304
check_target '/home/nysareal/.dev144s-076' file 98304
check_target '/home/nysareal/.dev144s-077' file 98304
check_target '/home/nysareal/.dev144s-078' file 98304
check_target '/home/nysareal/.dev144s-079' file 98304
check_target '/home/nysareal/.dev144s-080' file 98304
check_target '/home/nysareal/.dev144s-081' file 98304
check_target '/home/nysareal/.dev144s-082' file 98304
check_target '/home/nysareal/.dev144s-083' file 98304
check_target '/home/nysareal/.dev144s-084' file 98304
check_target '/home/nysareal/.dev144s-085' file 98304
check_target '/home/nysareal/.dev144s-086' file 98304
check_target '/home/nysareal/.dev144s-087' file 98304
check_target '/home/nysareal/.dev144s-088' file 86303
check_target '/home/nysareal/crm-release-preparation/20261101-dev260' directory 662370051
check_target '/home/nysareal/crm-release-preparation/20261101-wa258' directory 1473923517
check_target '/home/nysareal/crm-release-preparation/20261101-wa259a' directory 1513829711
check_target '/home/nysareal/crm-release-preparation/20261102-dev261' directory 461966357
check_target '/home/nysareal/nysa-core-dashboard-dd6262a-stage.dev244-mixed-20261028T055500Z' directory 1970964084
check_target '/home/nysareal/nysa-core-dashboard-dd6262a-stage.failed-1793734674548' directory 926469452
check_target '/home/nysareal/nysa-core-dashboard-dd6262a-stage.pre-recovery-20261103T2340DUBAI' directory 926419624

printf 'Filesystem before cleanup\n'
df -P -B1 -- /home/nysareal

rm -rf -- '/home/nysareal/.dev144s-000'
confirm_removed '/home/nysareal/.dev144s-000'
rm -rf -- '/home/nysareal/.dev144s-001'
confirm_removed '/home/nysareal/.dev144s-001'
rm -rf -- '/home/nysareal/.dev144s-002'
confirm_removed '/home/nysareal/.dev144s-002'
rm -rf -- '/home/nysareal/.dev144s-003'
confirm_removed '/home/nysareal/.dev144s-003'
rm -rf -- '/home/nysareal/.dev144s-004'
confirm_removed '/home/nysareal/.dev144s-004'
rm -rf -- '/home/nysareal/.dev144s-005'
confirm_removed '/home/nysareal/.dev144s-005'
rm -rf -- '/home/nysareal/.dev144s-006'
confirm_removed '/home/nysareal/.dev144s-006'
rm -rf -- '/home/nysareal/.dev144s-007'
confirm_removed '/home/nysareal/.dev144s-007'
rm -rf -- '/home/nysareal/.dev144s-008'
confirm_removed '/home/nysareal/.dev144s-008'
rm -rf -- '/home/nysareal/.dev144s-009'
confirm_removed '/home/nysareal/.dev144s-009'
rm -rf -- '/home/nysareal/.dev144s-010'
confirm_removed '/home/nysareal/.dev144s-010'
rm -rf -- '/home/nysareal/.dev144s-011'
confirm_removed '/home/nysareal/.dev144s-011'
rm -rf -- '/home/nysareal/.dev144s-012'
confirm_removed '/home/nysareal/.dev144s-012'
rm -rf -- '/home/nysareal/.dev144s-013'
confirm_removed '/home/nysareal/.dev144s-013'
rm -rf -- '/home/nysareal/.dev144s-014'
confirm_removed '/home/nysareal/.dev144s-014'
rm -rf -- '/home/nysareal/.dev144s-015'
confirm_removed '/home/nysareal/.dev144s-015'
rm -rf -- '/home/nysareal/.dev144s-016'
confirm_removed '/home/nysareal/.dev144s-016'
rm -rf -- '/home/nysareal/.dev144s-017'
confirm_removed '/home/nysareal/.dev144s-017'
rm -rf -- '/home/nysareal/.dev144s-018'
confirm_removed '/home/nysareal/.dev144s-018'
rm -rf -- '/home/nysareal/.dev144s-019'
confirm_removed '/home/nysareal/.dev144s-019'
rm -rf -- '/home/nysareal/.dev144s-020'
confirm_removed '/home/nysareal/.dev144s-020'
rm -rf -- '/home/nysareal/.dev144s-021'
confirm_removed '/home/nysareal/.dev144s-021'
rm -rf -- '/home/nysareal/.dev144s-022'
confirm_removed '/home/nysareal/.dev144s-022'
rm -rf -- '/home/nysareal/.dev144s-023'
confirm_removed '/home/nysareal/.dev144s-023'
rm -rf -- '/home/nysareal/.dev144s-024'
confirm_removed '/home/nysareal/.dev144s-024'
rm -rf -- '/home/nysareal/.dev144s-025'
confirm_removed '/home/nysareal/.dev144s-025'
rm -rf -- '/home/nysareal/.dev144s-026'
confirm_removed '/home/nysareal/.dev144s-026'
rm -rf -- '/home/nysareal/.dev144s-027'
confirm_removed '/home/nysareal/.dev144s-027'
rm -rf -- '/home/nysareal/.dev144s-028'
confirm_removed '/home/nysareal/.dev144s-028'
rm -rf -- '/home/nysareal/.dev144s-029'
confirm_removed '/home/nysareal/.dev144s-029'
rm -rf -- '/home/nysareal/.dev144s-030'
confirm_removed '/home/nysareal/.dev144s-030'
rm -rf -- '/home/nysareal/.dev144s-031'
confirm_removed '/home/nysareal/.dev144s-031'
rm -rf -- '/home/nysareal/.dev144s-032'
confirm_removed '/home/nysareal/.dev144s-032'
rm -rf -- '/home/nysareal/.dev144s-033'
confirm_removed '/home/nysareal/.dev144s-033'
rm -rf -- '/home/nysareal/.dev144s-034'
confirm_removed '/home/nysareal/.dev144s-034'
rm -rf -- '/home/nysareal/.dev144s-035'
confirm_removed '/home/nysareal/.dev144s-035'
rm -rf -- '/home/nysareal/.dev144s-036'
confirm_removed '/home/nysareal/.dev144s-036'
rm -rf -- '/home/nysareal/.dev144s-037'
confirm_removed '/home/nysareal/.dev144s-037'
rm -rf -- '/home/nysareal/.dev144s-038'
confirm_removed '/home/nysareal/.dev144s-038'
rm -rf -- '/home/nysareal/.dev144s-039'
confirm_removed '/home/nysareal/.dev144s-039'
rm -rf -- '/home/nysareal/.dev144s-040'
confirm_removed '/home/nysareal/.dev144s-040'
rm -rf -- '/home/nysareal/.dev144s-041'
confirm_removed '/home/nysareal/.dev144s-041'
rm -rf -- '/home/nysareal/.dev144s-042'
confirm_removed '/home/nysareal/.dev144s-042'
rm -rf -- '/home/nysareal/.dev144s-043'
confirm_removed '/home/nysareal/.dev144s-043'
rm -rf -- '/home/nysareal/.dev144s-044'
confirm_removed '/home/nysareal/.dev144s-044'
rm -rf -- '/home/nysareal/.dev144s-045'
confirm_removed '/home/nysareal/.dev144s-045'
rm -rf -- '/home/nysareal/.dev144s-046'
confirm_removed '/home/nysareal/.dev144s-046'
rm -rf -- '/home/nysareal/.dev144s-047'
confirm_removed '/home/nysareal/.dev144s-047'
rm -rf -- '/home/nysareal/.dev144s-048'
confirm_removed '/home/nysareal/.dev144s-048'
rm -rf -- '/home/nysareal/.dev144s-049'
confirm_removed '/home/nysareal/.dev144s-049'
rm -rf -- '/home/nysareal/.dev144s-050'
confirm_removed '/home/nysareal/.dev144s-050'
rm -rf -- '/home/nysareal/.dev144s-051'
confirm_removed '/home/nysareal/.dev144s-051'
rm -rf -- '/home/nysareal/.dev144s-052'
confirm_removed '/home/nysareal/.dev144s-052'
rm -rf -- '/home/nysareal/.dev144s-053'
confirm_removed '/home/nysareal/.dev144s-053'
rm -rf -- '/home/nysareal/.dev144s-054'
confirm_removed '/home/nysareal/.dev144s-054'
rm -rf -- '/home/nysareal/.dev144s-055'
confirm_removed '/home/nysareal/.dev144s-055'
rm -rf -- '/home/nysareal/.dev144s-056'
confirm_removed '/home/nysareal/.dev144s-056'
rm -rf -- '/home/nysareal/.dev144s-057'
confirm_removed '/home/nysareal/.dev144s-057'
rm -rf -- '/home/nysareal/.dev144s-058'
confirm_removed '/home/nysareal/.dev144s-058'
rm -rf -- '/home/nysareal/.dev144s-059'
confirm_removed '/home/nysareal/.dev144s-059'
rm -rf -- '/home/nysareal/.dev144s-060'
confirm_removed '/home/nysareal/.dev144s-060'
rm -rf -- '/home/nysareal/.dev144s-061'
confirm_removed '/home/nysareal/.dev144s-061'
rm -rf -- '/home/nysareal/.dev144s-062'
confirm_removed '/home/nysareal/.dev144s-062'
rm -rf -- '/home/nysareal/.dev144s-063'
confirm_removed '/home/nysareal/.dev144s-063'
rm -rf -- '/home/nysareal/.dev144s-064'
confirm_removed '/home/nysareal/.dev144s-064'
rm -rf -- '/home/nysareal/.dev144s-065'
confirm_removed '/home/nysareal/.dev144s-065'
rm -rf -- '/home/nysareal/.dev144s-066'
confirm_removed '/home/nysareal/.dev144s-066'
rm -rf -- '/home/nysareal/.dev144s-067'
confirm_removed '/home/nysareal/.dev144s-067'
rm -rf -- '/home/nysareal/.dev144s-068'
confirm_removed '/home/nysareal/.dev144s-068'
rm -rf -- '/home/nysareal/.dev144s-069'
confirm_removed '/home/nysareal/.dev144s-069'
rm -rf -- '/home/nysareal/.dev144s-070'
confirm_removed '/home/nysareal/.dev144s-070'
rm -rf -- '/home/nysareal/.dev144s-071'
confirm_removed '/home/nysareal/.dev144s-071'
rm -rf -- '/home/nysareal/.dev144s-072'
confirm_removed '/home/nysareal/.dev144s-072'
rm -rf -- '/home/nysareal/.dev144s-073'
confirm_removed '/home/nysareal/.dev144s-073'
rm -rf -- '/home/nysareal/.dev144s-074'
confirm_removed '/home/nysareal/.dev144s-074'
rm -rf -- '/home/nysareal/.dev144s-075'
confirm_removed '/home/nysareal/.dev144s-075'
rm -rf -- '/home/nysareal/.dev144s-076'
confirm_removed '/home/nysareal/.dev144s-076'
rm -rf -- '/home/nysareal/.dev144s-077'
confirm_removed '/home/nysareal/.dev144s-077'
rm -rf -- '/home/nysareal/.dev144s-078'
confirm_removed '/home/nysareal/.dev144s-078'
rm -rf -- '/home/nysareal/.dev144s-079'
confirm_removed '/home/nysareal/.dev144s-079'
rm -rf -- '/home/nysareal/.dev144s-080'
confirm_removed '/home/nysareal/.dev144s-080'
rm -rf -- '/home/nysareal/.dev144s-081'
confirm_removed '/home/nysareal/.dev144s-081'
rm -rf -- '/home/nysareal/.dev144s-082'
confirm_removed '/home/nysareal/.dev144s-082'
rm -rf -- '/home/nysareal/.dev144s-083'
confirm_removed '/home/nysareal/.dev144s-083'
rm -rf -- '/home/nysareal/.dev144s-084'
confirm_removed '/home/nysareal/.dev144s-084'
rm -rf -- '/home/nysareal/.dev144s-085'
confirm_removed '/home/nysareal/.dev144s-085'
rm -rf -- '/home/nysareal/.dev144s-086'
confirm_removed '/home/nysareal/.dev144s-086'
rm -rf -- '/home/nysareal/.dev144s-087'
confirm_removed '/home/nysareal/.dev144s-087'
rm -rf -- '/home/nysareal/.dev144s-088'
confirm_removed '/home/nysareal/.dev144s-088'
rm -rf -- '/home/nysareal/crm-release-preparation/20261101-dev260'
confirm_removed '/home/nysareal/crm-release-preparation/20261101-dev260'
rm -rf -- '/home/nysareal/crm-release-preparation/20261101-wa258'
confirm_removed '/home/nysareal/crm-release-preparation/20261101-wa258'
rm -rf -- '/home/nysareal/crm-release-preparation/20261101-wa259a'
confirm_removed '/home/nysareal/crm-release-preparation/20261101-wa259a'
rm -rf -- '/home/nysareal/crm-release-preparation/20261102-dev261'
confirm_removed '/home/nysareal/crm-release-preparation/20261102-dev261'
rm -rf -- '/home/nysareal/nysa-core-dashboard-dd6262a-stage.dev244-mixed-20261028T055500Z'
confirm_removed '/home/nysareal/nysa-core-dashboard-dd6262a-stage.dev244-mixed-20261028T055500Z'
rm -rf -- '/home/nysareal/nysa-core-dashboard-dd6262a-stage.failed-1793734674548'
confirm_removed '/home/nysareal/nysa-core-dashboard-dd6262a-stage.failed-1793734674548'
rm -rf -- '/home/nysareal/nysa-core-dashboard-dd6262a-stage.pre-recovery-20261103T2340DUBAI'
confirm_removed '/home/nysareal/nysa-core-dashboard-dd6262a-stage.pre-recovery-20261103T2340DUBAI'

printf 'Total apparent bytes removed: %s\n' 7944679851
printf 'Filesystem after cleanup\n'
df -P -B1 -- /home/nysareal
