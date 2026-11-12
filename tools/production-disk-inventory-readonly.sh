#!/bin/bash
set -euo pipefail
export LC_ALL=C
shopt -s dotglob nullglob

account=/home/nysareal
if [[ $(id -un) != nysareal ]]; then
  printf 'Expected the nysareal hosting account\n' >&2
  exit 1
fi

report_size() {
  local path=$1 allocated apparent
  allocated=$(du --summarize --one-file-system --no-dereference --block-size=1 -- "$path")
  apparent=$(du --summarize --one-file-system --no-dereference --apparent-size --block-size=1 -- "$path")
  printf '%s\t%s\t%q\n' "${allocated%%$'\t'*}" "${apparent%%$'\t'*}" "$path"
}

printf 'Inventory time (UTC)\n'
date -u +%FT%TZ
printf '\nAccount quota\n'
uapi --output=json Quota get_quota_info

printf '\nAllocated bytes\tApparent bytes\tPath (shell-escaped)\n'
printf '\nImmediate children of %q\n' "$account"
for child in "$account"/*; do
  report_size "$child"
done

roots=("$account/crm-release-preparation")
for candidate in "$account"/*backup*; do
  [[ -d $candidate && ! -L $candidate ]] && roots+=("$candidate")
done
for root in "${roots[@]}"; do
  printf '\nRoot %q\n' "$root"
  if [[ ! -d $root || -L $root ]]; then
    printf 'Root absent or symlink. Skipped.\n'
    continue
  fi
  for child in "$root"/*; do
    report_size "$child"
  done
done

export_path=$account/tmp/wn15-approval1-export-20261111
if [[ -e $export_path || -L $export_path ]]; then
  report_size "$export_path"
else
  printf '\nWN-15 export absent at %q\n' "$export_path"
fi
