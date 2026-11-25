#!/usr/bin/env bash
# 「507 기계 운동」 GLM 실행기 — 한 번에 1건만(요청 한도 때문에 병렬 금지).
# 사용: bash scripts/mm507/glm_run.sh <kit | tools | gallery | 운동번호 | s·x·f번호 | sh·shfix·shrev번호(쇼츠)> [모델=zai-coding-plan/glm-5.3-flash]
# 로그: shots/mm/log/<작업>.log
set -u
cd "$(dirname "$0")/../.." || exit 1
TASK="$1"
MODEL="${2:-zai-coding-plan/glm-5.3-flash}"
mkdir -p shots/mm/log
LOG="shots/mm/log/$TASK.log"

COMMON="RULES (always):
- Three.js 0.170 + TypeScript strict. No 'any'. No new dependencies. Comments in Korean, short.
- Use ONLY the material functions from src/models/materials.ts (never 'new THREE.MeshStandardMaterial').
- Do not run git. Do not start a dev server (one already runs at http://localhost:5273).
- Touch only the files this task names. If something outside looks wrong, mention it in your summary instead of editing it.
- Before finishing run 'npx tsc --noEmit' and fix every error in the files you wrote.
- End with a short Korean summary: what you wrote, the tsc result, what you could not do."

COMMON_SH="RULES (always):
- Do not run git. Do not start any server. Do not render videos (another step does that).
- Touch only the files this task names.
- End with a short Korean summary: what you wrote or found, the check result, what you could not do."

case "$TASK" in
  kit)
    PROMPT="TASK P2 (foundation) for the '507 Mechanical Movements' part of this repo.
Read docs/work-orders/16-507-전체계획.md carefully (sections 2, 3 and 3-4 are your spec) and docs/work-orders/00-개요.md section 4.
Also read: src/models/materials.ts, src/models/parts/gears.ts and src/models/parts/geom.ts (reuse involuteOutline, lathe, extrude helpers), src/machines/stlShared.ts (makeLabelSprite), src/dev/preview.ts, src/machines/Treadmill.ts (how a belt strip is swept along a path).
WRITE exactly these files:
 1. src/mm507/types.ts  (as specified in section 3-2)
 2. src/mm507/kit/stand.ts, shaft.ts, pulley.ts, belt.ts, gear.ts, misc.ts, index.ts  (every function/class listed in section 3-3 with exactly those names and signatures, plus Belt.setPath(path: THREE.Vector3[]): void that rebuilds the strip for a new path with the same number of points)
 3. src/mm507/registry.ts  (section 3-4: import.meta.glob('./models/m*.ts'), hasModel(n), loadModel(n), listModels())
 4. src/mm507/kitDemo.ts  (default export a MovementBuilder that lays out one of every kit part on the display stand, with two pulleys + open belt and two meshing spur gears that rotate, so the kit can be inspected)
 5. EDIT src/dev/preview.ts: add query '?mm=<n>' (loads that model through the registry, adds model.group to the scene, calls model.update(dt, speed) every frame, optional '&t=<sec>' stops the simulation at that time, '&speed=<x>' default 1, uses model.view or a default front view pos [0, 2.1, 6.2] target [0, 1.75, 0]) and '?mm=kit' (uses kitDemo). Do not change the behaviour of the existing query options.
Quality bar: parts must look machined (LatheGeometry profiles with small chamfers for pulleys/hubs, involute teeth for gears, 32+ radial segments), pulleys and gears need spokes or holes plus one bright mark so rotation is visible, the belt is a thin flat strip that hugs the pulleys with seam marks that move with setOffset.
VERIFY: npx tsc --noEmit ; then run
  node scripts/shot.mjs \"preview.html?mm=kit&t=1\" shots/mm/kit-a.png 6000
  node scripts/shot.mjs \"preview.html?mm=kit&t=1.6\" shots/mm/kit-b.png 6000
both must print 'saved' without 'CONSOLE ERRORS'.
$COMMON"
    ;;
  tools)
    PROMPT="TASK P1 (data tooling) for the '507 Mechanical Movements' part of this repo.
Read docs/work-orders/16-507-전체계획.md sections 1 and 2, and docs/work-orders/15-507-자료준비.md including 부록 A (the data format).
Inputs: data/mm507/pNNN.json (per plate: figures[].box normalized [x0,y0,x1,y1] on the plate page image, texts[] with n, titleKo, ko, easy, category, mech, optional en, enStart, enFix), data/mm507/en.json (OCR English per number), data/mm507/ocr/pNNN.json (OCR words with pixel boxes at 220 dpi), the PDF mechanical_movements_507/Mechanical_Movements_507.pdf (PyMuPDF 'pymupdf' is installed; see scripts/mm507/render_page.py).
WRITE scripts/mm507/build_assets.py (Python 3.12, only pymupdf + stdlib) that:
 1. Merges the English text: start from en.json; for numbers missing there, use texts[].en if present, otherwise split the OCR text of the previous number at texts[].enStart (case-insensitive, tolerant to extra spaces/punctuation); apply enFix replacements. Report numbers that still have no English.
 2. Crops every figure: render the plate page at 200 dpi, crop the normalized box with a 6 px margin, convert to grayscale, and save public/mm507/fig/NNN.png (3-digit number) — skip files that are already newer than their JSON.
 3. Writes public/mm507/catalog.json: an array sorted by n of { n, title, cat, ko, easy, en, plate } (title = titleKo, cat = category).
 4. Prints a summary: how many numbers 1..507 have a figure, Korean text, English text; lists of missing numbers for each; duplicates.
The script must be idempotent and must not fail when some pNNN.json files are still missing (just report).
RUN it: python scripts/mm507/build_assets.py   and show the summary. Do not edit any data/mm507 file.
$COMMON"
    ;;
  gallery)
    PROMPT="TASK P4 (screens) for the '507 Mechanical Movements' part of this repo.
Read docs/work-orders/16-507-전체계획.md sections 4 and 5 (your spec), docs/work-orders/11-탐구-실험-3종.md section '공통 구조', and as working examples src/labs/PowerFlow.ts + src/styles/lab-power.css, src/modes/Encyclopedia.ts, src/modes/types.ts, src/ui/home.ts, src/main.ts (function route), src/styles/tokens.css.
WRITE: src/mm507/Gallery.ts (AppMode with list, detail and about views), src/mm507/about.ts (history text built from section 5 and data loaded from /mm507/preface if present — keep facts to what the work order states), src/styles/mm507.css (prefix mm-, tokens only, light/dark, mobile sheet under 820px).
EDIT minimally: src/modes/types.ts (add optional 'param?: string' and 'navigate?(path: string): void' to ModeContext), src/main.ts (route '#/mm', '#/mm/<n>', '#/mm/about' to the Gallery mode passing the parameter; re-entering with a new parameter must not leak the previous view; existing routes unchanged; import the css), src/ui/home.ts + src/styles/app.css (a new home section '507 기계 운동' with one large card that navigates to '#/mm'), src/dev/preview.ts (query '?mode=mm&param=<n|about>').
The catalog is fetched at runtime from /mm507/catalog.json; figures are /mm507/fig/NNN.png; 3D models come from src/mm507/registry.ts (hasModel, loadModel).
VERIFY: npx tsc --noEmit ; then
  node scripts/shot.mjs \"preview.html?mode=mm\" shots/mm/gallery.png 5000
  node scripts/shot.mjs \"preview.html?mode=mm&param=1\" shots/mm/detail-1.png 6000
  node scripts/shot.mjs \"preview.html?mode=mm&param=about\" shots/mm/about.png 5000
  node scripts/shot.mjs \"preview.html?mode=mm&param=1&theme=dark\" shots/mm/detail-1-dark.png 6000 390 844
all must print 'saved' without 'CONSOLE ERRORS'.
$COMMON"
    ;;
  s[0-9]*)
    NUM=$((10#${TASK#s})); N=$(printf "%03d" "$NUM")
    PROMPT="TASK: write ONE design sheet (설계표) of the '507 Mechanical Movements' part: number $NUM. Write it in Korean.
READ, in this order:
 1. docs/work-orders/20-507-속도향상.md sections 3-2, 3-3 (검사 선언 JSON), 4 (오류 유형, 설계표 새 양식 ★ 절, 난도) — follow the new sheet format exactly.
 2. Good examples: docs/mm507-sheets/101.md, 104.md, 131.md (same format, already built and verified).
 3. The original text: in public/mm507/catalog.json the entry with \"n\": $NUM (fields en, ko, easy).
 4. The engraving public/mm507/fig/$N.png — LOOK at it if you can view images. Count the parts, which part touches/meshes which, what is fixed and what moves, what drives. Letters (A, B, …) in the engraving match the text.
 5. src/mm507/kit/index.ts and the kit files it re-exports, plus existing per-number kits src/mm507/kit/k*.ts — reuse functions; read only.
WRITE docs/mm507-sheets/$N.md with: 판화 묘사·원문 요지, ## ★ 판화 읽기 (질문표), 구동, 부품과 치수 (coordinates, radii, teeth, z), ## ★ 줄·벨트 표, ## ★ 연결 표 (every part is supported — nothing floats), ## ★ 깊이 계산 (z -0.25~0.8, x ±2.2, y ≤ 3.3, include swinging arm tips), 동작 (every pose a closed function of theta or a periodic table that closes exactly each period), 표시 (rotArrow, at least 3 tag labels that follow moving parts, notes), ## ★ 검사 선언 (a fenced json block, format of section 3-3; the heading must be exactly '## ★ 검사 선언'), 확인 (t values, cam), ## ★ 난도·질문.
Rules learned from earlier numbers: horizontal-shaft bearing rings have their hole along the shaft and posts stop at the ring surface; arrows show the real rotation direction and do not cover parts; view shows the whole display stand (pos z about 6.2~6.6); outline names for holes contain lowercase 'hole'; marker strips/nuts/rod ends must not sink into moving parts.
If a part is missing from the kit, implement it ONLY in a new file src/mm507/kit/k$N.ts (never edit other kit files or index.ts; models import from '../kit/k$N'), and write '이미 구현됨: name(signature)' in the sheet's 키트 추가 section.
VERIFY: node scripts/mm507/sheetlint.mjs $NUM  must show fail 0 ; npx tsc --noEmit must show no error in k$N.ts. Do not write the model file.
$COMMON"
    ;;
  x[0-9]*)
    NUM=$((10#${TASK#x})); N=$(printf "%03d" "$NUM")
    REQ="$(cat "shots/mm/log/x$NUM.txt")"
    PROMPT="TASK: fix the model of '507 Mechanical Movements' number $NUM as the user asked.
USER REQUEST and notes:
$REQ
READ docs/mm507-sheets/$N.md, src/mm507/models/m$N.ts and the kit files it imports. LOOK at the engraving public/mm507/fig/$N.png if you can view images.
Edit src/mm507/models/m$N.ts (and only if needed the per-number kit src/mm507/kit/k$N.ts). Do not edit shared kit files.
VERIFY: npx tsc --noEmit (no error in your files); node scripts/mm507/autocheck.mjs $NUM must end with fail 0; node scripts/shot.mjs \"preview.html?mm=$NUM&t=1\" shots/mm/$N-x1.png 6000 and t=1.6 as $N-x2.png must print saved without CONSOLE ERRORS. Add 2~3 lines at the end of docs/mm507-sheets/$N.md under '## 사용자 지적 후 수정 (GLM)'.
$COMMON"
    ;;
  f[0-9]*)
    NUM=$((10#${TASK#f})); N=$(printf "%03d" "$NUM")
    PROMPT="TASK: fix the model of '507 Mechanical Movements' number $NUM so the automatic check passes.
The automatic checker result is in shots/mm/auto/$N.json (fields fail, warn, checks with reasons and positions). READ it first, then docs/mm507-sheets/$N.md (the design sheet), src/mm507/models/m$N.ts, and the kit files it imports. LOOK at shots/mm/auto/$N-cmp.png and $N-close.png and the engraving public/mm507/fig/$N.png if you can view images.
Fix every fail (and real warns: parts sinking into each other, floating parts, labels covering parts) by editing src/mm507/models/m$N.ts and, only if the cause is there, src/mm507/kit/k$N.ts. Keep the mechanism, the ratios and the engraving layout. Do not edit shared kit files.
VERIFY: npx tsc --noEmit (no error in your files); node scripts/mm507/autocheck.mjs $NUM  must end with fail 0. Add 2~3 lines at the end of docs/mm507-sheets/$N.md under '## 자동 검사 후 수정 (GLM)'.
$COMMON"
    ;;
  sh[0-9]*)
    NUM=$((10#${TASK#sh})); N=$(printf "%03d" "$NUM")
    PROMPT="TASK: write the YouTube Shorts narration scripts of '507 Mechanical Movements' number $NUM in SIX languages (ko, en, ja, zh, hi, ar).
READ:
 1. shorts/scripts/ko.json, en.json, ja.json, zh.json, hi.json, ar.json — entries \"1\" to \"5\" are approved examples. Copy their style exactly.
 2. The source facts: public/mm507/catalog.json entry with \"n\": $NUM (title, easy = Korean easy explanation, easyEn, ko, en), and src/mm507/i18n/ja.json, zh.json, hi.json, ar.json → titles[\"$NUM\"] and easy[\"$NUM\"].
WRITE: in each of the six files add the key \"$NUM\" = {\"hook\": ..., \"body\": ..., \"cta\": ...}. Keep every other key unchanged and keep valid JSON (2-space indent).
 - hook: one short question that makes people curious about this mechanism.
 - body: one or two sentences with the working principle, only facts that are in the source. Never use engraving letters (A, B, C…) — they are not visible in the video.
 - cta: EXACTLY the same string as entry \"1\" of that file.
 - Length of hook+body+cta: ko 45~60 characters (no spaces), ja 45~58 characters, zh 40~58 characters, en 24~32 words, hi 18~25 words, ar 14~20 words. Each language is written natively, not word-for-word from Korean.
VERIFY: node scripts/shorts/scriptlint.mjs $NUM  — every line must start with OK. Fix and re-run until it does.
$COMMON_SH"
    ;;
  shfix[0-9]*)
    NUM=$((10#${TASK#shfix})); N=$(printf "%03d" "$NUM")
    PROMPT="TASK: some Shorts narrations of '507 Mechanical Movements' number $NUM are too long for the video time.
For each language L in ko en ja zh hi ar, read shorts/_work/L/$N/dub/dub.json . Where \"tooLong\" is true, shorten that language's entry \"$NUM\" in shorts/scripts/L.json: make hook and body about 15% shorter, keep the meaning and the facts, keep cta unchanged.
Then run  node scripts/shorts/tts.mjs $NUM L  for that language and read dub.json again. Repeat (at most 3 times per language) until tooLong is false.
VERIFY: node scripts/shorts/scriptlint.mjs $NUM  — every line must start with OK (if shortening breaks the minimum length, rewrite instead of cutting).
$COMMON_SH"
    ;;
  shrev[0-9]*)
    NUM=$((10#${TASK#shrev})); N=$(printf "%03d" "$NUM")
    PROMPT="TASK: review the finished Shorts of '507 Mechanical Movements' number $NUM in six languages before upload.
READ: shorts/ko/$N.json, shorts/en/$N.json, shorts/ja/$N.json, shorts/zh/$N.json, shorts/hi/$N.json, shorts/ar/$N.json (title, description, tags, playlist, script) and public/mm507/catalog.json entry \"n\": $NUM .
RUN: node scripts/shorts/check.mjs $NUM  (every line must start with OK).
CHECK for every language: the title and description are in that language and name this mechanism correctly; the script says the same facts as the source and nothing extra; no Korean text inside non-Korean files; hashtags and the app link https://mechanical-elements-3d.vercel.app/#/mm/$NUM are present.
WRITE shorts/_work/review-$N.md in Korean: one line per language — 'OK' or the exact problem. Do NOT edit the video files or the json files; only report.
$COMMON_SH"
    ;;
  *)
    N=$(printf "%03d" "$TASK")
    NUM=$((10#$TASK))
    PROMPT="TASK: implement ONE movement model of the '507 Mechanical Movements' part: number $NUM.
READ, in this order:
 1. docs/mm507-sheets/$N.md  — the design sheet. Implement it exactly (parts, dimensions, motion, labels, notes). If it has a '키트 추가' section, also add exactly that to the kit file it names (optional parameters / new functions only; never change existing signatures).
 2. docs/work-orders/16-507-전체계획.md section 3 (model conventions: display stand, front view like the engraving, function-style module, absolute pose from accumulated theta).
 3. src/mm507/types.ts and src/mm507/kit/index.ts with the kit files it re-exports — use the kit, do not re-implement parts.
 4. src/mm507/models/m001.ts if it exists (the reference model — copy its structure).
 5. The original engraving public/mm507/fig/$N.png if you are able to view images (optional).
WRITE src/mm507/models/m$N.ts with a default export of type MovementBuilder. Nothing else (except a '키트 추가' the sheet asks for).
VERIFY: npx tsc --noEmit ; then run
  node scripts/shot.mjs \"preview.html?mm=$NUM&t=1\" shots/mm/$N-a.png 6000
  node scripts/shot.mjs \"preview.html?mm=$NUM&t=1.6\" shots/mm/$N-b.png 6000
both must print 'saved' without 'CONSOLE ERRORS'. If the sheet's '확인' section names other times or camera angles, shoot those too as shots/mm/$N-c.png etc.
$COMMON"
    ;;
esac

timeout 2700 opencode run --auto -m "$MODEL" "$PROMPT" > "$LOG" 2>&1
CODE=$?
echo "[$TASK] exit $CODE model $MODEL" >> "$LOG"
tail -2 "$LOG"
exit $CODE
