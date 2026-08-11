#!/bin/bash
# roster.tsv 를 병렬 4로 돌린다. 이미 있는 파일은 건너뛴다(중간에 끊겨도 이어서 됨).
cd "$(dirname "$0")/../.."
N=4
while IFS=$'\t' read -r ID CORE; do
  [ -z "$ID" ] && continue
  while [ "$(jobs -rp | wc -l)" -ge "$N" ]; do wait -n; done
  ./tools/concept/gen.sh "$ID" "$CORE" &
done < tools/concept/roster.tsv
wait
echo "=== 완료: $(ls assets/concept/*.png 2>/dev/null | wc -l)장 ==="
