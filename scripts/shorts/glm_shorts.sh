#!/usr/bin/env bash
# 쇼츠 6개 언어를 GLM(glm-5.3-flash)이 주 작업자로 만드는 순서(지휘: Opus 가 세운 계획, 2026-11-25).
# 사용: ALT=<alt.sh 경로> bash scripts/shorts/glm_shorts.sh <번호>   (번호 하나씩 — GLM 은 한 번에 1건)
#  1) [GLM sh]    6개 언어 대본 쓰기 → scriptlint 통과할 때까지(최대 2번)
#  2) [스크립트]  더빙 시험(tts all) — 시간 넘는 언어가 있으면
#  3) [GLM shfix] 그 언어 대본 줄이기(더빙 다시 돌려 확인) → 다시 검사(최대 2번)
#  4) [스크립트]  녹화·카드·효과음·합성·검사(make --langs=all, 40분 안팎 — GLM 대화 안에서 돌리지 않는다: 45분 제한·감시에 걸림)
#  5) [GLM shrev] 6개 언어 제목·설명·대본 검수 보고 shorts/_work/review-NNN.md
#  그림(대조·미리보기) 확인은 Opus 가 한다(GLM flash 는 그림을 못 본다).
#  기록: shorts/_work/glm-NNN.txt . GLM 감시(scripts/mm507/glm_watch.sh)를 함께 띄운다.
set -u
cd "$(dirname "$0")/../.." || exit 1
N="${1:?번호}"; ID=$(printf "%03d" "$N")
MODEL="zai-coding-plan/glm-5.3-flash"
OUT=shorts/_work/glm-$ID.txt
mkdir -p shorts/_work
say() { echo "$(date '+%H:%M') $*" | tee -a "$OUT"; }
glm() { # glm <작업>
  local now; now=$((10#$(date +%H%M)))
  if [ "$now" -ge 1500 ] && [ "$now" -lt 1900 ]; then say "15~19시 GLM 금지 — $1 건너뜀"; return 1; fi
  if [ -n "${ALT:-}" ]; then bash "$ALT" bash scripts/mm507/glm_run.sh "$1" "$MODEL" > /dev/null 2>&1
  else bash scripts/mm507/glm_run.sh "$1" "$MODEL" > /dev/null 2>&1; fi
}
toolong() { # 시간 넘는 언어 목록
  node -e "const fs=require('fs');const o=[];for(const l of ['ko','en','ja','zh','hi','ar']){try{if(JSON.parse(fs.readFileSync('shorts/_work/'+l+'/$ID/dub/dub.json','utf8')).tooLong)o.push(l)}catch{o.push(l)}}console.log(o.join(' '))"
}

say "== $ID 시작"
# 1) 대본
for k in 1 2; do
  node scripts/shorts/scriptlint.mjs "$N" --quiet && break
  say "1) GLM 대본 쓰기(sh$N) $k번째"; glm "sh$N"
done
node scripts/shorts/scriptlint.mjs "$N" >> "$OUT" 2>&1 || { say "대본 검사 실패 — 멈춤(Opus 확인 필요)"; exit 1; }
say "1) 대본 통과"

# 2)~3) 더빙 길이
node scripts/shorts/tts.mjs "$N" all >> "$OUT" 2>&1
for k in 1 2; do
  L=$(toolong); [ -z "$L" ] && break
  say "3) 시간 넘는 언어: $L — GLM 줄이기(shfix$N) $k번째"; glm "shfix$N"
done
L=$(toolong); [ -n "$L" ] && { say "더빙이 여전히 김: $L — 멈춤(Opus 확인 필요)"; exit 1; }
node scripts/shorts/scriptlint.mjs "$N" --quiet || { say "줄인 뒤 대본 검사 실패 — 멈춤"; exit 1; }
say "2) 더빙 길이 통과"

# 4) 렌더
say "4) 제작(make --langs=all) 시작"
node scripts/shorts/make.mjs "$N" --langs=all > "shorts/_work/make-$ID.log" 2>&1
grep -aE "^(OK|ERR)" "shorts/_work/make-$ID.log" >> "$OUT"
node scripts/shorts/check.mjs "$N" --sheet >> "$OUT" 2>&1 || { say "검사 실패 — 멈춤(make-$ID.log 확인)"; exit 1; }
say "4) 12편 검사 통과"

# 5) 검수
say "5) GLM 검수(shrev$N)"; glm "shrev$N"
[ -f "shorts/_work/review-$ID.md" ] && cat "shorts/_work/review-$ID.md" >> "$OUT"
say "== $ID 끝"
