#!/bin/bash
# Continuous 5-worker upload runner
# Keeps launching batches of 5 workers (25 shows each) until all shows are done
cd "$(dirname "$0")/.."

while true; do
  # Check how many remain
  REMAINING=$(python3 -c "
import json
with open('scripts/.upload-progress.json') as f: done=set(json.load(f))
with open('data/tth-tour-data.json') as f: gigs=json.load(f)
remaining=[g for g in gigs if g.get('archiveUrl') and g['id'] not in done]
print(len(remaining))
")

  echo "$(date '+%H:%M:%S') === $REMAINING shows remaining ==="

  if [ "$REMAINING" -le 0 ]; then
    echo "All shows processed!"
    break
  fi

  # Launch 5 workers
  PIDS=()
  for W in 1 2 3 4 5; do
    OFFSET=$(( (W - 1) * 25 ))
    if [ "$OFFSET" -ge "$REMAINING" ]; then
      break
    fi
    python3 scripts/upload-audio-to-b2.py --worker $W --start-from $OFFSET --limit 25 \
      2>&1 | grep -E "(===|Processing|Downloaded|Done:|Complete!|Failed|ERROR)" &
    PIDS+=($!)
    echo "  Worker $W started (offset $OFFSET), PID $!"
  done

  # Wait for all workers to finish
  for PID in "${PIDS[@]}"; do
    wait $PID
  done

  echo "$(date '+%H:%M:%S') === Batch complete, merging... ==="

  # Merge results
  python3 scripts/upload-audio-to-b2.py --merge 2>&1

  # Fix track names
  python3 scripts/fix-track-names.py 2>&1 | grep -E "(Found|Fixed|Skipped|Done)"

  echo "$(date '+%H:%M:%S') === Ready for next batch ==="
done
