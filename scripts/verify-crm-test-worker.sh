#!/usr/bin/env bash
set -euo pipefail

EXPECTED_ROOT='/home/nysareal/nysa-core-dashboard-dd6262a-stage'
EXPECTED_LABEL="lsnode:${EXPECTED_ROOT}/"
EXPECTED_COUNT=${1:-any}
PF_MODE=${2:-count-only}

case "$EXPECTED_COUNT" in
  any|0|1) ;;
  *)
    echo 'STOP: expected count must be any, 0, or 1' >&2
    exit 2
    ;;
esac

case "$PF_MODE" in
  count-only|require-pf-safe|require-pf-read-only) ;;
  *)
    echo 'STOP: mode must be count-only, require-pf-safe, or require-pf-read-only' >&2
    exit 2
    ;;
esac

RAW_PROCESSES="$(pgrep -afu "$USER" '[l]snode:' 2>/dev/null || true)"
MATCHED_PIDS=()
TOTAL_LSNODE_COUNT=0

while IFS= read -r row; do
  [[ -n "$row" ]] || continue
  read -r pid label _ <<<"$row"
  [[ "$pid" =~ ^[0-9]+$ ]] || continue
  TOTAL_LSNODE_COUNT=$((TOTAL_LSNODE_COUNT + 1))
  [[ "$label" == "$EXPECTED_LABEL" ]] && MATCHED_PIDS+=("$pid")
done <<<"$RAW_PROCESSES"

CRM_TEST_WORKER_COUNT=${#MATCHED_PIDS[@]}
echo "ACCOUNT_LSNODE_PROCESS_COUNT=$TOTAL_LSNODE_COUNT"
echo "CRM_TEST_WORKER_COUNT=$CRM_TEST_WORKER_COUNT"
for pid in "${MATCHED_PIDS[@]}"; do
  echo "CRM_TEST_WORKER_PID=$pid"
done

if [[ "$CRM_TEST_WORKER_COUNT" -gt 1 ]]; then
  echo 'STOP: duplicate CRM-Test workers detected' >&2
  exit 3
fi

if [[ "$EXPECTED_COUNT" != any && "$CRM_TEST_WORKER_COUNT" -ne "$EXPECTED_COUNT" ]]; then
  echo "STOP: expected exactly $EXPECTED_COUNT CRM-Test worker(s); found $CRM_TEST_WORKER_COUNT" >&2
  exit 4
fi

if [[ "$PF_MODE" != count-only ]]; then
  if [[ "$CRM_TEST_WORKER_COUNT" -ne 1 ]]; then
    echo 'STOP: PF safety verification requires exactly one CRM-Test worker' >&2
    exit 5
  fi

  PID=${MATCHED_PIDS[0]}
  [[ -r "/proc/$PID/environ" ]] || {
    echo 'STOP: CRM-Test worker environment is not readable' >&2
    exit 6
  }

  for name in \
    PROPERTY_FINDER_PRODUCTION_ALLOW_READS \
    PROPERTY_FINDER_PRODUCTION_ALLOW_DRAFT_CREATE \
    PROPERTY_FINDER_PRODUCTION_ALLOW_PUBLISH
  do
    value="$(
      tr '\0' '\n' < "/proc/$PID/environ" |
      awk -F= -v key="$name" '$1==key{print substr($0,length(key)+2);exit}'
    )"
    value=${value:-missing}
    echo "$name=$value"
    expected=0
    if [[ "$PF_MODE" == require-pf-read-only && "$name" == PROPERTY_FINDER_PRODUCTION_ALLOW_READS ]]; then
      expected=1
    fi
    if [[ "$value" != "$expected" ]]; then
      echo "STOP: $name must equal $expected" >&2
      exit 7
    fi
  done
fi

echo 'RESULT=PASS'
