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
  local path=$1 allocated=N/A apparent=N/A allocated_output apparent_output
  local allocated_status=0 apparent_status=0 line mode unreadable=0
  local -A diagnostics=()
  allocated_output=$(du --summarize --one-file-system --no-dereference --block-size=1 -- "$path" 2>&1) || allocated_status=$?
  apparent_output=$(du --summarize --one-file-system --no-dereference --apparent-size --block-size=1 -- "$path" 2>&1) || apparent_status=$?
  for mode in allocated apparent; do
    local output_var=${mode}_output
    while IFS= read -r line; do
      if [[ $line =~ ^([0-9]+)$'\t' ]]; then
        printf -v "$mode" '%s' "${BASH_REMATCH[1]}"
      elif [[ -n $line ]]; then
        diagnostics["$line"]=1
      fi
    done <<< "${!output_var}"
  done
  printf '%s\t%s\t%q' "$allocated" "$apparent" "$path"
  if (( allocated_status || apparent_status )); then
    for line in "${!diagnostics[@]}"; do
      case $line in
        'du: cannot access '*|'du: cannot read directory '*) ((unreadable+=1)) ;;
      esac
    done
    printf '\tPARTIAL (%d unreadable entries)\n' "$unreadable"
    printf 'du exit status for %q: allocated=%d apparent=%d\n' "$path" "$allocated_status" "$apparent_status" >&2
    for line in "${!diagnostics[@]}"; do
      printf '%s\n' "$line" >&2
    done
  else
    printf '\n'
  fi
}

printf 'Inventory time (UTC)\n'
date -u +%FT%TZ
printf '\nAccount quota\n'
quota_status=0
quota_output=$(uapi --output=json Quota get_quota_info 2>&1) || quota_status=$?
if (( quota_status != 0 )); then
  printf 'Quota unavailable (exit %d)\n' "$quota_status"
fi
printf '%s\n' "$quota_output"

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
