#!/bin/bash
set -u
export LC_ALL=C

if (( $# != 0 )) || [[ $(id -un) != nysareal ]]; then
  printf 'Run without arguments as the nysareal hosting account\n' >&2
  exit 1
fi

failed=0
check() {
  local module=$1 function=$2 code=0
  printf '\n$ uapi --output=json %s %s\n' "$module" "$function"
  uapi --output=json "$module" "$function" || code=$?
  printf '\nExit code (%s %s): %d\n' "$module" "$function" "$code"
  if (( code != 0 )); then
    failed=1
  fi
}

check Quota get_quota_info
check DomainInfo list_domains
check ResourceUsage get_usages
exit "$failed"
