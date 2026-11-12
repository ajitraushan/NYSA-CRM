#!/bin/bash
set -euo pipefail
export LC_ALL=C

archive=/home/nysareal/backup-11.1.2026_18-42-45_nysareal.tar.gz
expected_bytes=25479313722

if (( $# != 0 )) || [[ $(id -un) != nysareal ]]; then
  printf 'Run without arguments as the nysareal hosting account\n' >&2
  exit 1
fi
if [[ -L $archive || ! -f $archive ]]; then
  printf 'Expected a regular archive at %s\n' "$archive" >&2
  exit 1
fi

before=$(stat -c '%d:%i:%s:%y:%z' -- "$archive")
bytes=$(stat -c '%s' -- "$archive")
if [[ $bytes != "$expected_bytes" ]]; then
  printf 'Archive size mismatch: expected %s bytes, observed %s\n' "$expected_bytes" "$bytes" >&2
  exit 1
fi
hash=$(sha256sum -- "$archive")
after=$(stat -c '%d:%i:%s:%y:%z' -- "$archive")
if [[ $before != "$after" ]]; then
  printf 'Archive changed during hashing\n' >&2
  exit 1
fi
printf 'Archive bytes: %s\n%s\n' "$bytes" "$hash"
