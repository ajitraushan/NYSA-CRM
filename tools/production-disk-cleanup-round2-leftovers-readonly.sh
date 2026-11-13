#!/bin/bash
set -euo pipefail
export LC_ALL=C

if (( $# != 0 )) || [[ $(id -un) != nysareal ]]; then
  printf 'Run without arguments as the nysareal hosting account\n' >&2
  exit 1
fi

status=0
report_directory() {
  local path=$1 size owners
  printf '\n%s\n' "$path"
  if [[ -L $path || ! -d $path || $(realpath -e -- "$path") != "$path" ]]; then
    printf 'Unavailable: expected an existing directory at the exact path\n' >&2
    status=1
    return
  fi

  if size=$(du --summarize --one-file-system --no-dereference --apparent-size --block-size=1 -- "$path" 2>/dev/null); then
    printf 'Apparent bytes: %s\n' "${size%%$'\t'*}"
  else
    printf 'Apparent bytes unavailable: du could not read the full directory\n' >&2
    status=1
  fi

  if owners=$(find "$path" -xdev -type d \( ! -writable -o ! -executable \) -printf '%u\n' 2>/dev/null); then
    printf '%s\n' "$owners" | awk 'NF {count++; owner[$0]=1} END {
      printf "Directories without write or search access: %d\n", count
      for (name in owner) print name
    }'
  else
    printf 'Directory count and owners unavailable: find could not traverse the full directory\n' >&2
    status=1
  fi
}

report_directory /home/nysareal/nysa-core-dashboard-dd6262a-stage.dev244-mixed-20261028T055500Z
report_directory /home/nysareal/nysa-core-dashboard-dd6262a-stage.failed-1793734674548
report_directory /home/nysareal/nysa-core-dashboard-dd6262a-stage.pre-recovery-20261103T2340DUBAI
exit "$status"
