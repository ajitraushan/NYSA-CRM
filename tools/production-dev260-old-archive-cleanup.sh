#!/bin/bash
set -euo pipefail
export LC_ALL=C

target=/home/nysareal/backup-11.1.2026_18-42-45_nysareal.DEV260-OLD-20261102T0101GST.tar.gz
expected_bytes=24943955451

if (( $# != 0 )) || [[ $(id -un) != nysareal ]]; then
  printf 'Run without arguments as the nysareal hosting account\n' >&2
  exit 1
fi

printf 'Filesystem before cleanup\n'
df -P -B1 -- /home/nysareal

if [[ -L $target || ! -f $target ]]; then
  printf 'Expected an existing regular file at %s\n' "$target" >&2
  exit 1
fi
bytes=$(stat -c '%s' -- "$target")
if [[ $bytes != "$expected_bytes" ]]; then
  printf 'Size mismatch for %s: expected %s, observed %s\n' "$target" "$expected_bytes" "$bytes" >&2
  exit 1
fi

rm -- "$target"
if [[ -e $target || -L $target ]]; then
  printf 'Cleanup target still exists at %s\n' "$target" >&2
  exit 1
fi
printf 'Removed %s (%s bytes)\n' "$target" "$bytes"
printf 'Filesystem after cleanup\n'
df -P -B1 -- /home/nysareal
