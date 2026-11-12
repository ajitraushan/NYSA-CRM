#!/bin/bash
set -euo pipefail
export LC_ALL=C

node=/opt/alt/alt-nodejs24/root/usr/bin/node
npm=/opt/alt/alt-nodejs24/root/usr/lib/node_modules/npm/bin/npm-cli.js

verify_file() {
  local file=$1 expected_owner=$2 owner verification status=0 line flags listed
  printf '\nFile: %s\n' "$file"
  owner=$(/usr/bin/rpm -qf --qf '%{NAME} %{VERSION} %{RELEASE} %{ARCH}\n' -- "$file") || return 1
  printf 'RPM owner (name version release architecture): %s\n' "$owner"
  if [[ $owner == *$'\n'* || ${owner%% *} != "$expected_owner" && ${owner%% *} != alt-nodejs24 ]]; then
    printf 'RPM verification: unexpected package owner\n'
    return 1
  fi
  # RPM verifies the owning package. Keep only the two requested file results.
  verification=$(/usr/bin/rpm -Vf --noscripts -- "$file" 2>&1) || status=$?
  if (( status > 1 )) || { (( status == 1 )) && [[ -z $verification ]]; }; then
    printf 'RPM verification: command did not produce usable evidence\n'
    return 1
  fi
  while IFS= read -r line; do
    [[ -z $line ]] && continue
    read -r flags listed <<< "$line"
    if [[ $listed == "$file" || $listed == *" $file" ]]; then
      printf 'RPM verification: modified or missing (%s)\n' "$line"
      return 1
    fi
    if [[ $flags != missing && ! $flags =~ ^[.SM5DLUGTP?]{9}$ ]] ||
       [[ $listed != /* && $listed != [[:alpha:]][[:space:]]/* ]]; then
      printf 'RPM verification: unrecognized output\n'
      return 1
    fi
  done <<< "$verification"
  printf 'RPM verification: unmodified\n'
  /usr/bin/sha256sum -- "$file"
}

failed=0
verify_file "$node" alt-nodejs24 || failed=1
verify_file "$npm" alt-nodejs24-npm || failed=1
if (( failed )); then
  exit 1
fi
printf '\nNode version: '
"$node" --version
