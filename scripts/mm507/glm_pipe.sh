#!/usr/bin/env bash
# 「507 기계 운동」 GLM 전용 파이프라인 — 번호마다 설계표 → 모델 → 자동 검사 → (실패 시) 수정을 끊김 없이.
# 사용: ALT=<alt.sh 경로> bash scripts/mm507/glm_pipe.sh 137 160 [동시수=7]
#  - GLM 은 glm-5.3-flash 만, 한 키로 동시 7개까지(요청 한도). 키를 바꿔 병렬을 늘리지 않는다.
#  - 결과 한 줄: shots/mm/log/pipe-NNN.txt , 전체 요약: shots/mm/log/pipe-summary.txt
set -u
cd "$(dirname "$0")/../.." || exit 1
A="${1:?시작 번호}"; B="${2:?끝 번호}"; P="${3:-7}"
MODEL="zai-coding-plan/glm-5.3-flash"
mkdir -p shots/mm/log

glm() { # glm <작업>
  if [ -n "${ALT:-}" ]; then bash "$ALT" bash scripts/mm507/glm_run.sh "$1" "$MODEL" > /dev/null 2>&1
  else bash scripts/mm507/glm_run.sh "$1" "$MODEL" > /dev/null 2>&1; fi
  if grep -q "Usage limit reached" "shots/mm/log/$1.log" 2>/dev/null; then echo LIMIT; fi
}

one() {
  local n=$1 id; id=$(printf "%03d" "$n")
  local out="shots/mm/log/pipe-$id.txt" t0=$SECONDS
  # 1) 설계표 — sheetlint fail 0 이면 그대로 쓴다
  local k
  for k in 1 2; do
    node scripts/mm507/sheetlint.mjs "$n" --quiet > /dev/null 2>&1 && break
    [ "$(glm "s$n")" = LIMIT ] && { echo "$id 한도 도달(설계표)" > "$out"; return; }
  done
  node scripts/mm507/sheetlint.mjs "$n" --quiet > /dev/null 2>&1 || { echo "$id 설계표 실패" > "$out"; return; }
  # 2) 모델
  if [ ! -f "src/mm507/models/m$id.ts" ]; then
    [ "$(glm "$n")" = LIMIT ] && { echo "$id 한도 도달(모델)" > "$out"; return; }
  fi
  [ -f "src/mm507/models/m$id.ts" ] || { echo "$id 모델 없음" > "$out"; return; }
  # 3) 자동 검사 → 실패면 GLM 수정(최대 3번)
  local v=""
  for k in 0 1 2 3; do
    v=$(node scripts/mm507/autocheck.mjs "$n" 2>&1 | grep -E "^$id " | awk '{print $2}')
    [ "$v" = PASS ] || [ "$v" = WARN ] && break
    [ "$k" = 3 ] && break
    [ "$(glm "f$n")" = LIMIT ] && { echo "$id 한도 도달(수정)" > "$out"; return; }
  done
  echo "$id ${v:-ERR} $((SECONDS - t0))s" > "$out"
}
export -f one glm
export MODEL ALT

seq "$A" "$B" | xargs -P "$P" -I{} bash -c 'one {}'
cat shots/mm/log/pipe-*.txt 2>/dev/null | sort > shots/mm/log/pipe-summary.txt
cat shots/mm/log/pipe-summary.txt
