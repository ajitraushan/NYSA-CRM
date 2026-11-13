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

live_root=/home/nysareal/nysa-core-dashboard-dd6262a-stage
dev244=/home/nysareal/nysa-core-dashboard-dd6262a-stage.dev244-mixed-20261028T055500Z

check_live_root() {
  if [[ -L $live_root || ! -d $live_root || $(realpath -e -- "$live_root") != "$live_root" ]]; then
    printf 'Live CRM Test root is missing or does not resolve to its exact path: %s\n' "$live_root" >&2
    exit 1
  fi
}

# Sizes are from receipt c2c03d9b, committed in 1a8101f.
check_live_root
check_target '/home/nysareal/nysa-core-dashboard-dd6262a-stage.failed-1793734674548' directory 926469452
check_target '/home/nysareal/nysa-core-dashboard-dd6262a-stage.pre-recovery-20261103T2340DUBAI' directory 926419624
check_target '/home/nysareal/nysa-core-dashboard-dd6262a-stage.dev244-mixed-20261028T055500Z' directory 108312194
check_removal_permissions '/home/nysareal/nysa-core-dashboard-dd6262a-stage.failed-1793734674548'
check_removal_permissions '/home/nysareal/nysa-core-dashboard-dd6262a-stage.pre-recovery-20261103T2340DUBAI'

blocked=$(find -P "$dev244" -type d ! -writable ! -user nysareal -print -quit)
if [[ -n $blocked ]]; then
  printf 'Non-writable directory is not owned by nysareal: %s\n' "$blocked" >&2
  exit 1
fi

# chmod skips symlinks encountered during recursion. Reject hard links
# because changing a shared inode could affect a name outside this copy.
linked=$(find -P "$dev244" ! -type d ! -type l -links +1 -print -quit)
if [[ -n $linked ]]; then
  printf 'Hard-linked entry blocks recursive chmod: %s\n' "$linked" >&2
  exit 1
fi

printf 'Filesystem before cleanup\n'
df -P -B1 -- /home/nysareal
chmod -R u+w -- '/home/nysareal/nysa-core-dashboard-dd6262a-stage.dev244-mixed-20261028T055500Z'
check_removal_permissions '/home/nysareal/nysa-core-dashboard-dd6262a-stage.dev244-mixed-20261028T055500Z'

rm -rf -- '/home/nysareal/nysa-core-dashboard-dd6262a-stage.failed-1793734674548'
confirm_removed '/home/nysareal/nysa-core-dashboard-dd6262a-stage.failed-1793734674548'
rm -rf -- '/home/nysareal/nysa-core-dashboard-dd6262a-stage.pre-recovery-20261103T2340DUBAI'
confirm_removed '/home/nysareal/nysa-core-dashboard-dd6262a-stage.pre-recovery-20261103T2340DUBAI'
rm -rf -- '/home/nysareal/nysa-core-dashboard-dd6262a-stage.dev244-mixed-20261028T055500Z'
confirm_removed '/home/nysareal/nysa-core-dashboard-dd6262a-stage.dev244-mixed-20261028T055500Z'

check_live_root
printf 'Live CRM Test root present: %s\n' "$live_root"
printf 'Total apparent bytes removed: %s\n' 1961201270
printf 'Filesystem after cleanup\n'
df -P -B1 -- /home/nysareal
