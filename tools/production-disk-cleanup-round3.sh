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


check_removal_permissions() {
  local path=$1 blocked
  if [[ ! -w ${path%/*} || ! -x ${path%/*} ]]; then
    printf 'Parent is not writable and searchable: %s\n' "$path" >&2
    exit 1
  fi
  if [[ -d $path ]]; then
    blocked=$(find "$path" -type d \( ! -writable -o ! -executable \) -print -quit)
    if [[ -n $blocked ]]; then
      printf 'Directory is not writable and searchable: %s\n' "$blocked" >&2
      exit 1
    fi
  fi
}

# Complete every precheck before the first deletion.
check_target '/home/nysareal/crm-release-preparation/20261031-dev248' directory 612063999
check_removal_permissions '/home/nysareal/crm-release-preparation/20261031-dev248'
check_target '/home/nysareal/crm-release-preparation/20261031-ui001' directory 988773629
check_removal_permissions '/home/nysareal/crm-release-preparation/20261031-ui001'
check_target '/home/nysareal/crm-release-preparation/20261031-ui252' directory 609637170
check_removal_permissions '/home/nysareal/crm-release-preparation/20261031-ui252'
check_target '/home/nysareal/crm-release-preparation/20261031-ui253' directory 1935573189
check_removal_permissions '/home/nysareal/crm-release-preparation/20261031-ui253'
check_target '/home/nysareal/crm-release-preparation/20261101-wa255' directory 1472760811
check_removal_permissions '/home/nysareal/crm-release-preparation/20261101-wa255'
check_target '/home/nysareal/crm-release-preparation/20261101-wa256' directory 1714838729
check_removal_permissions '/home/nysareal/crm-release-preparation/20261101-wa256'
check_target '/home/nysareal/crm-release-preparation/20261101-wa257' directory 1472871328
check_removal_permissions '/home/nysareal/crm-release-preparation/20261101-wa257'
check_target '/home/nysareal/crm-release-preparation/20261103-dev262' directory 1320524776
check_removal_permissions '/home/nysareal/crm-release-preparation/20261103-dev262'
check_target '/home/nysareal/crm-release-preparation/20261104-dev263' directory 446455985
check_removal_permissions '/home/nysareal/crm-release-preparation/20261104-dev263'
check_target '/home/nysareal/crm-release-preparation/20261104-dev264' directory 447854277
check_removal_permissions '/home/nysareal/crm-release-preparation/20261104-dev264'
check_target '/home/nysareal/crm-release-preparation/20261106-dev265-run2' directory 463367420
check_removal_permissions '/home/nysareal/crm-release-preparation/20261106-dev265-run2'
check_target '/home/nysareal/crm-release-preparation/20261110-dev266' directory 465580942
check_removal_permissions '/home/nysareal/crm-release-preparation/20261110-dev266'
check_target '/home/nysareal/crm-release-preparation/20261110-dev267-run2' directory 465823543
check_removal_permissions '/home/nysareal/crm-release-preparation/20261110-dev267-run2'
check_target '/home/nysareal/crm-release-preparation/20261111-dev268' directory 465963415
check_removal_permissions '/home/nysareal/crm-release-preparation/20261111-dev268'
check_target '/home/nysareal/crm-release-preparation/20261112-dev270-r2' directory 466256144
check_removal_permissions '/home/nysareal/crm-release-preparation/20261112-dev270-r2'
check_target '/home/nysareal/crm-release-preparation/20261112-dev271-r1' directory 466263170
check_removal_permissions '/home/nysareal/crm-release-preparation/20261112-dev271-r1'
check_target '/home/nysareal/crm-release-preparation/20261112-dev271-r2' directory 466280810
check_removal_permissions '/home/nysareal/crm-release-preparation/20261112-dev271-r2'
check_target '/home/nysareal/crm-backups/crm-test-dev241-20261027T071210Z' directory 52257921
check_removal_permissions '/home/nysareal/crm-backups/crm-test-dev241-20261027T071210Z'
check_target '/home/nysareal/crm-backups/crm-test-dev241-20261027T072707Z' directory 52252630
check_removal_permissions '/home/nysareal/crm-backups/crm-test-dev241-20261027T072707Z'
check_target '/home/nysareal/crm-backups/crm-test-dev242-pre-20261027T085524Z' directory 57841544
check_removal_permissions '/home/nysareal/crm-backups/crm-test-dev242-pre-20261027T085524Z'
check_target '/home/nysareal/crm-backups/crm-test-dev242-pre-20261027T085524Z.tar.gz' file 40891293
check_removal_permissions '/home/nysareal/crm-backups/crm-test-dev242-pre-20261027T085524Z.tar.gz'
check_target '/home/nysareal/crm-backups/crm-test-dev242-pre-20261027T085524Z.tar.gz.sha256' file 110
check_removal_permissions '/home/nysareal/crm-backups/crm-test-dev242-pre-20261027T085524Z.tar.gz.sha256'
check_target '/home/nysareal/crm-backups/crm-test-dev243-pre-20261027T193434Z' directory 57813851
check_removal_permissions '/home/nysareal/crm-backups/crm-test-dev243-pre-20261027T193434Z'
check_target '/home/nysareal/crm-backups/crm-test-dev243-pre-20261027T193434Z.tar.gz' file 40908271
check_removal_permissions '/home/nysareal/crm-backups/crm-test-dev243-pre-20261027T193434Z.tar.gz'
check_target '/home/nysareal/crm-backups/crm-test-dev243-pre-20261027T193434Z.tar.gz.sha256' file 110
check_removal_permissions '/home/nysareal/crm-backups/crm-test-dev243-pre-20261027T193434Z.tar.gz.sha256'
check_target '/home/nysareal/crm-backups/crm-test-dev243-pre-20261027T210340Z' directory 43595448
check_removal_permissions '/home/nysareal/crm-backups/crm-test-dev243-pre-20261027T210340Z'
check_target '/home/nysareal/crm-backups/crm-test-dev243-pre-20261027T210340Z.tar.gz' file 40849628
check_removal_permissions '/home/nysareal/crm-backups/crm-test-dev243-pre-20261027T210340Z.tar.gz'
check_target '/home/nysareal/crm-backups/crm-test-dev243-pre-20261027T210340Z.tar.gz.sha256' file 110
check_removal_permissions '/home/nysareal/crm-backups/crm-test-dev243-pre-20261027T210340Z.tar.gz.sha256'
check_target '/home/nysareal/crm-backups/crm-test-dev243-pre-20261028T053234Z' directory 43602355
check_removal_permissions '/home/nysareal/crm-backups/crm-test-dev243-pre-20261028T053234Z'
check_target '/home/nysareal/crm-backups/crm-test-dev243-pre-20261028T053234Z.tar.gz' file 40870864
check_removal_permissions '/home/nysareal/crm-backups/crm-test-dev243-pre-20261028T053234Z.tar.gz'
check_target '/home/nysareal/crm-backups/crm-test-dev243-pre-20261028T053234Z.tar.gz.sha256' file 110
check_removal_permissions '/home/nysareal/crm-backups/crm-test-dev243-pre-20261028T053234Z.tar.gz.sha256'
check_target '/home/nysareal/crm-backups/crm-test-dev243-pre-20261028T053940Z' directory 43596363
check_removal_permissions '/home/nysareal/crm-backups/crm-test-dev243-pre-20261028T053940Z'
check_target '/home/nysareal/crm-backups/crm-test-dev243-pre-20261028T053940Z.tar.gz' file 40864024
check_removal_permissions '/home/nysareal/crm-backups/crm-test-dev243-pre-20261028T053940Z.tar.gz'
check_target '/home/nysareal/crm-backups/crm-test-dev243-pre-20261028T053940Z.tar.gz.sha256' file 110
check_removal_permissions '/home/nysareal/crm-backups/crm-test-dev243-pre-20261028T053940Z.tar.gz.sha256'
check_target '/home/nysareal/crm-backups/crm-test-dev243-pre-20261028T054325Z' directory 72139133
check_removal_permissions '/home/nysareal/crm-backups/crm-test-dev243-pre-20261028T054325Z'
check_target '/home/nysareal/crm-backups/crm-test-dev243-pre-20261028T054325Z.tar.gz' file 40864259
check_removal_permissions '/home/nysareal/crm-backups/crm-test-dev243-pre-20261028T054325Z.tar.gz'
check_target '/home/nysareal/crm-backups/crm-test-dev243-pre-20261028T054325Z.tar.gz.sha256' file 110
check_removal_permissions '/home/nysareal/crm-backups/crm-test-dev243-pre-20261028T054325Z.tar.gz.sha256'
check_target '/home/nysareal/crm-backups/crm-test-dev244-pre-20261027T204429Z-app.tar.gz' file 1445633216
check_removal_permissions '/home/nysareal/crm-backups/crm-test-dev244-pre-20261027T204429Z-app.tar.gz'
check_target '/home/nysareal/crm-backups/crm-test-dev244-pre-20261027T204429Z-runtime.tar.gz' file 14364255
check_removal_permissions '/home/nysareal/crm-backups/crm-test-dev244-pre-20261027T204429Z-runtime.tar.gz'
check_target '/home/nysareal/crm-backups/crm-test-dev245-pre-20261028T062501Z' directory 57906947
check_removal_permissions '/home/nysareal/crm-backups/crm-test-dev245-pre-20261028T062501Z'
check_target '/home/nysareal/crm-backups/crm-test-dev245-pre-20261028T062501Z.tar.gz' file 40880628
check_removal_permissions '/home/nysareal/crm-backups/crm-test-dev245-pre-20261028T062501Z.tar.gz'
check_target '/home/nysareal/crm-backups/crm-test-dev245-pre-20261028T062501Z.tar.gz.sha256' file 110
check_removal_permissions '/home/nysareal/crm-backups/crm-test-dev245-pre-20261028T062501Z.tar.gz.sha256'
check_target '/home/nysareal/crm-backups/crm-test-dev246-pre-20261029T171009Z' directory 58070015
check_removal_permissions '/home/nysareal/crm-backups/crm-test-dev246-pre-20261029T171009Z'
check_target '/home/nysareal/crm-backups/crm-test-dev246-pre-20261029T171009Z.tar.gz' file 40981780
check_removal_permissions '/home/nysareal/crm-backups/crm-test-dev246-pre-20261029T171009Z.tar.gz'
check_target '/home/nysareal/crm-backups/crm-test-dev246-pre-20261029T171009Z.tar.gz.sha256' file 110
check_removal_permissions '/home/nysareal/crm-backups/crm-test-dev246-pre-20261029T171009Z.tar.gz.sha256'
check_target '/home/nysareal/crm-backups/crm-test-dev248-pre-20261031T074530Z' directory 58132724
check_removal_permissions '/home/nysareal/crm-backups/crm-test-dev248-pre-20261031T074530Z'
check_target '/home/nysareal/crm-backups/crm-test-dev248-pre-20261031T074530Z.tar.gz' file 41058649
check_removal_permissions '/home/nysareal/crm-backups/crm-test-dev248-pre-20261031T074530Z.tar.gz'
check_target '/home/nysareal/crm-backups/crm-test-dev248-pre-20261031T074530Z.tar.gz.sha256' file 110
check_removal_permissions '/home/nysareal/crm-backups/crm-test-dev248-pre-20261031T074530Z.tar.gz.sha256'

printf 'Filesystem before cleanup\n'
df -P -B1 -- /home/nysareal

rm -rf -- '/home/nysareal/crm-release-preparation/20261031-dev248'
confirm_removed '/home/nysareal/crm-release-preparation/20261031-dev248'
rm -rf -- '/home/nysareal/crm-release-preparation/20261031-ui001'
confirm_removed '/home/nysareal/crm-release-preparation/20261031-ui001'
rm -rf -- '/home/nysareal/crm-release-preparation/20261031-ui252'
confirm_removed '/home/nysareal/crm-release-preparation/20261031-ui252'
rm -rf -- '/home/nysareal/crm-release-preparation/20261031-ui253'
confirm_removed '/home/nysareal/crm-release-preparation/20261031-ui253'
rm -rf -- '/home/nysareal/crm-release-preparation/20261101-wa255'
confirm_removed '/home/nysareal/crm-release-preparation/20261101-wa255'
rm -rf -- '/home/nysareal/crm-release-preparation/20261101-wa256'
confirm_removed '/home/nysareal/crm-release-preparation/20261101-wa256'
rm -rf -- '/home/nysareal/crm-release-preparation/20261101-wa257'
confirm_removed '/home/nysareal/crm-release-preparation/20261101-wa257'
rm -rf -- '/home/nysareal/crm-release-preparation/20261103-dev262'
confirm_removed '/home/nysareal/crm-release-preparation/20261103-dev262'
rm -rf -- '/home/nysareal/crm-release-preparation/20261104-dev263'
confirm_removed '/home/nysareal/crm-release-preparation/20261104-dev263'
rm -rf -- '/home/nysareal/crm-release-preparation/20261104-dev264'
confirm_removed '/home/nysareal/crm-release-preparation/20261104-dev264'
rm -rf -- '/home/nysareal/crm-release-preparation/20261106-dev265-run2'
confirm_removed '/home/nysareal/crm-release-preparation/20261106-dev265-run2'
rm -rf -- '/home/nysareal/crm-release-preparation/20261110-dev266'
confirm_removed '/home/nysareal/crm-release-preparation/20261110-dev266'
rm -rf -- '/home/nysareal/crm-release-preparation/20261110-dev267-run2'
confirm_removed '/home/nysareal/crm-release-preparation/20261110-dev267-run2'
rm -rf -- '/home/nysareal/crm-release-preparation/20261111-dev268'
confirm_removed '/home/nysareal/crm-release-preparation/20261111-dev268'
rm -rf -- '/home/nysareal/crm-release-preparation/20261112-dev270-r2'
confirm_removed '/home/nysareal/crm-release-preparation/20261112-dev270-r2'
rm -rf -- '/home/nysareal/crm-release-preparation/20261112-dev271-r1'
confirm_removed '/home/nysareal/crm-release-preparation/20261112-dev271-r1'
rm -rf -- '/home/nysareal/crm-release-preparation/20261112-dev271-r2'
confirm_removed '/home/nysareal/crm-release-preparation/20261112-dev271-r2'
rm -rf -- '/home/nysareal/crm-backups/crm-test-dev241-20261027T071210Z'
confirm_removed '/home/nysareal/crm-backups/crm-test-dev241-20261027T071210Z'
rm -rf -- '/home/nysareal/crm-backups/crm-test-dev241-20261027T072707Z'
confirm_removed '/home/nysareal/crm-backups/crm-test-dev241-20261027T072707Z'
rm -rf -- '/home/nysareal/crm-backups/crm-test-dev242-pre-20261027T085524Z'
confirm_removed '/home/nysareal/crm-backups/crm-test-dev242-pre-20261027T085524Z'
rm -rf -- '/home/nysareal/crm-backups/crm-test-dev242-pre-20261027T085524Z.tar.gz'
confirm_removed '/home/nysareal/crm-backups/crm-test-dev242-pre-20261027T085524Z.tar.gz'
rm -rf -- '/home/nysareal/crm-backups/crm-test-dev242-pre-20261027T085524Z.tar.gz.sha256'
confirm_removed '/home/nysareal/crm-backups/crm-test-dev242-pre-20261027T085524Z.tar.gz.sha256'
rm -rf -- '/home/nysareal/crm-backups/crm-test-dev243-pre-20261027T193434Z'
confirm_removed '/home/nysareal/crm-backups/crm-test-dev243-pre-20261027T193434Z'
rm -rf -- '/home/nysareal/crm-backups/crm-test-dev243-pre-20261027T193434Z.tar.gz'
confirm_removed '/home/nysareal/crm-backups/crm-test-dev243-pre-20261027T193434Z.tar.gz'
rm -rf -- '/home/nysareal/crm-backups/crm-test-dev243-pre-20261027T193434Z.tar.gz.sha256'
confirm_removed '/home/nysareal/crm-backups/crm-test-dev243-pre-20261027T193434Z.tar.gz.sha256'
rm -rf -- '/home/nysareal/crm-backups/crm-test-dev243-pre-20261027T210340Z'
confirm_removed '/home/nysareal/crm-backups/crm-test-dev243-pre-20261027T210340Z'
rm -rf -- '/home/nysareal/crm-backups/crm-test-dev243-pre-20261027T210340Z.tar.gz'
confirm_removed '/home/nysareal/crm-backups/crm-test-dev243-pre-20261027T210340Z.tar.gz'
rm -rf -- '/home/nysareal/crm-backups/crm-test-dev243-pre-20261027T210340Z.tar.gz.sha256'
confirm_removed '/home/nysareal/crm-backups/crm-test-dev243-pre-20261027T210340Z.tar.gz.sha256'
rm -rf -- '/home/nysareal/crm-backups/crm-test-dev243-pre-20261028T053234Z'
confirm_removed '/home/nysareal/crm-backups/crm-test-dev243-pre-20261028T053234Z'
rm -rf -- '/home/nysareal/crm-backups/crm-test-dev243-pre-20261028T053234Z.tar.gz'
confirm_removed '/home/nysareal/crm-backups/crm-test-dev243-pre-20261028T053234Z.tar.gz'
rm -rf -- '/home/nysareal/crm-backups/crm-test-dev243-pre-20261028T053234Z.tar.gz.sha256'
confirm_removed '/home/nysareal/crm-backups/crm-test-dev243-pre-20261028T053234Z.tar.gz.sha256'
rm -rf -- '/home/nysareal/crm-backups/crm-test-dev243-pre-20261028T053940Z'
confirm_removed '/home/nysareal/crm-backups/crm-test-dev243-pre-20261028T053940Z'
rm -rf -- '/home/nysareal/crm-backups/crm-test-dev243-pre-20261028T053940Z.tar.gz'
confirm_removed '/home/nysareal/crm-backups/crm-test-dev243-pre-20261028T053940Z.tar.gz'
rm -rf -- '/home/nysareal/crm-backups/crm-test-dev243-pre-20261028T053940Z.tar.gz.sha256'
confirm_removed '/home/nysareal/crm-backups/crm-test-dev243-pre-20261028T053940Z.tar.gz.sha256'
rm -rf -- '/home/nysareal/crm-backups/crm-test-dev243-pre-20261028T054325Z'
confirm_removed '/home/nysareal/crm-backups/crm-test-dev243-pre-20261028T054325Z'
rm -rf -- '/home/nysareal/crm-backups/crm-test-dev243-pre-20261028T054325Z.tar.gz'
confirm_removed '/home/nysareal/crm-backups/crm-test-dev243-pre-20261028T054325Z.tar.gz'
rm -rf -- '/home/nysareal/crm-backups/crm-test-dev243-pre-20261028T054325Z.tar.gz.sha256'
confirm_removed '/home/nysareal/crm-backups/crm-test-dev243-pre-20261028T054325Z.tar.gz.sha256'
rm -rf -- '/home/nysareal/crm-backups/crm-test-dev244-pre-20261027T204429Z-app.tar.gz'
confirm_removed '/home/nysareal/crm-backups/crm-test-dev244-pre-20261027T204429Z-app.tar.gz'
rm -rf -- '/home/nysareal/crm-backups/crm-test-dev244-pre-20261027T204429Z-runtime.tar.gz'
confirm_removed '/home/nysareal/crm-backups/crm-test-dev244-pre-20261027T204429Z-runtime.tar.gz'
rm -rf -- '/home/nysareal/crm-backups/crm-test-dev245-pre-20261028T062501Z'
confirm_removed '/home/nysareal/crm-backups/crm-test-dev245-pre-20261028T062501Z'
rm -rf -- '/home/nysareal/crm-backups/crm-test-dev245-pre-20261028T062501Z.tar.gz'
confirm_removed '/home/nysareal/crm-backups/crm-test-dev245-pre-20261028T062501Z.tar.gz'
rm -rf -- '/home/nysareal/crm-backups/crm-test-dev245-pre-20261028T062501Z.tar.gz.sha256'
confirm_removed '/home/nysareal/crm-backups/crm-test-dev245-pre-20261028T062501Z.tar.gz.sha256'
rm -rf -- '/home/nysareal/crm-backups/crm-test-dev246-pre-20261029T171009Z'
confirm_removed '/home/nysareal/crm-backups/crm-test-dev246-pre-20261029T171009Z'
rm -rf -- '/home/nysareal/crm-backups/crm-test-dev246-pre-20261029T171009Z.tar.gz'
confirm_removed '/home/nysareal/crm-backups/crm-test-dev246-pre-20261029T171009Z.tar.gz'
rm -rf -- '/home/nysareal/crm-backups/crm-test-dev246-pre-20261029T171009Z.tar.gz.sha256'
confirm_removed '/home/nysareal/crm-backups/crm-test-dev246-pre-20261029T171009Z.tar.gz.sha256'
rm -rf -- '/home/nysareal/crm-backups/crm-test-dev248-pre-20261031T074530Z'
confirm_removed '/home/nysareal/crm-backups/crm-test-dev248-pre-20261031T074530Z'
rm -rf -- '/home/nysareal/crm-backups/crm-test-dev248-pre-20261031T074530Z.tar.gz'
confirm_removed '/home/nysareal/crm-backups/crm-test-dev248-pre-20261031T074530Z.tar.gz'
rm -rf -- '/home/nysareal/crm-backups/crm-test-dev248-pre-20261031T074530Z.tar.gz.sha256'
confirm_removed '/home/nysareal/crm-backups/crm-test-dev248-pre-20261031T074530Z.tar.gz.sha256'

printf 'Total apparent bytes removed: %s\n' 16706266125
printf 'Filesystem after cleanup\n'
df -P -B1 -- /home/nysareal
