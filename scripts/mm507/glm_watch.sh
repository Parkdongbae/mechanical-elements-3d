#!/usr/bin/env bash
# GLM 감시 — 5분마다 돌고 있는 GLM 작업(glm_run.sh)을 보고, 헤매는 작업은 바로 끊는다(사용자 지시 2026-11-25).
# 사용: bash scripts/mm507/glm_watch.sh [간격초=300] [최대분=30]
#  끊는 경우(하나라도):
#   1) 로그(shots/mm/log/<작업>.log)가 간격(5분) 동안 한 줄도 늘지 않음 → 멈춤
#   2) 작업이 시작된 지(ps 의 시작 시각) 최대분(30분)이 넘음 → 헤맴
#   3) 로그 끝부분이 요청 한도 재시도(attempt 6 이상)만 되풀이 → 한도에 막힘
#  끊으면 opencode 가 죽고 glm_run 이 끝나므로, glm_pipe 는 그 번호를 실패로 적고 다음 번호로 넘어간다.
#  기록: shots/mm/log/watch.txt . 돌고 있는 glm_pipe·glm_shorts·glm_run 이 없으면(두 번 연속) 스스로 끝난다.
set -u
cd "$(dirname "$0")/../.." || exit 1
GAP="${1:-300}"
MAXMIN="${2:-30}"
LOGD=shots/mm/log
OUT=$LOGD/watch.txt
idle=0

note() { echo "$(date '+%m-%d %H:%M') $*" | tee -a "$OUT"; }

# 한 프로세스와 그 아래 모두를 끊는다(msys 프로세스는 kill, Windows 프로그램은 taskkill /T)
kill_tree() {
  local pid=$1 kids k win
  kids=$(ps -ef | awk -v p="$pid" '$3==p {print $2}')
  for k in $kids; do kill_tree "$k"; done
  win=$(ps -e | awk -v p="$pid" '$1==p {print $4}')
  [ -n "$win" ] && taskkill //F //T //PID "$win" > /dev/null 2>&1
  kill -9 "$pid" 2> /dev/null
}

check() {
  local now pid job st log age mt last t0 n=0
  now=$(date +%s)
  while read -r pid job st; do
    [ -z "$pid" ] && continue
    n=$((n + 1))
    log=$LOGD/$job.log
    t0=$(date -d "$st" +%s 2> /dev/null || echo "$now")
    [ "$t0" -gt "$now" ] && t0=$((t0 - 86400))
    age=$(( (now - t0) / 60 ))
    mt=$(stat -c %Y "$log" 2> /dev/null || echo "$now")
    last=$(tail -n 20 "$log" 2> /dev/null | sed 's/\x1b\[[0-9;]*m//g')
    if [ $((now - mt)) -ge "$GAP" ]; then
      note "끊음 $job (pid $pid): 로그가 $(( (now - mt) / 60 ))분째 그대로"; kill_tree "$pid"
    elif [ "$age" -ge "$MAXMIN" ]; then
      note "끊음 $job (pid $pid): ${age}분째 끝나지 않음"; kill_tree "$pid"
    elif echo "$last" | grep -qE "retrying \(attempt ([6-9]|[1-9][0-9])\)"; then
      note "끊음 $job (pid $pid): 요청 한도 재시도만 되풀이"; kill_tree "$pid"
    else
      note "진행 $job: ${age}분, 마지막 출력 $(( (now - mt) ))초 전"
    fi
  done < <(ps -ef | awk '/glm_run\.sh/ && !/awk/ {for (i = 1; i <= NF; i++) if ($i ~ /glm_run\.sh$/) {print $2, $(i + 1), $5; break}}')
  if [ "$n" -eq 0 ] && ! ps -ef | grep -qE "[g]lm_pipe.sh|[g]lm_shorts.sh"; then idle=$((idle + 1)); else idle=0; fi
}

note "감시 시작 — ${GAP}초마다, 최대 ${MAXMIN}분"
while :; do
  check
  [ "$idle" -ge 2 ] && { note "돌고 있는 GLM 작업 없음 — 감시 끝"; exit 0; }
  sleep "$GAP"
done
