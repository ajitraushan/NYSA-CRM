#!/usr/bin/env bash
set -euo pipefail

VERIFY='/home/nysareal/verify-crm-test-worker.sh'
BASE_URL='https://crm-test.nysarealty.com'

[[ -x "$VERIFY" ]] || {
  echo "STOP: worker verifier is not executable at $VERIFY" >&2
  exit 2
}

snapshot(){
  local stage=$1 output count pid
  echo "STAGE=$stage"
  output="$($VERIFY 1 require-pf-safe)" || {
    printf '%s\n' "$output"
    exit 3
  }
  printf '%s\n' "$output"
  count="$(printf '%s\n' "$output" | awk -F= '$1=="CRM_TEST_WORKER_COUNT"{print $2;exit}')"
  pid="$(printf '%s\n' "$output" | awk -F= '$1=="CRM_TEST_WORKER_PID"{print $2;exit}')"
  [[ "$count" == 1 && "$pid" =~ ^[0-9]+$ ]] || {
    echo "STOP: $stage did not resolve exactly one CRM-Test PID" >&2
    exit 4
  }
  STABLE_PID=${STABLE_PID:-$pid}
  [[ "$pid" == "$STABLE_PID" ]] || {
    echo "STOP: CRM-Test worker changed from $STABLE_PID to $pid during $stage" >&2
    exit 5
  }
}

probe(){
  local stage=$1 path=$2 body
  echo "PROBE=$stage"
  body="$(curl -fsS --max-time 15 "$BASE_URL$path")" || {
    echo "STOP: $stage request failed" >&2
    exit 6
  }
  printf '%s\n' "$body"
}

STABLE_PID=''
snapshot before_liveness
probe liveness /api/health
snapshot after_liveness
probe readiness /api/readiness
snapshot after_readiness
probe repeated_liveness /api/health
snapshot final

echo "STABLE_CRM_TEST_WORKER_PID=$STABLE_PID"
echo 'RESULT=PASS'
