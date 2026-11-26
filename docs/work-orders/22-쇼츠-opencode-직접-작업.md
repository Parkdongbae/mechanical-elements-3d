# 작업 지시서 22 — opencode 로 「507 기계 운동」 쇼츠 직접 만들기

사용자가 opencode(GLM)를 직접 띄워 쇼츠를 만들 때 쓰는 지시서. 작성 Opus, 2026-11-26.
자동 실행기(scripts/shorts/glm_shorts.sh)가 하는 일을 opencode 대화 한 번에 맡기는 형태다.

## 1. 작업 폴더

```
E:\mechanical-elements-3d-main
```

opencode 는 반드시 이 폴더에서 띄운다(대본·스크립트·영상 경로가 모두 이 폴더 기준).

## 2. 시작 전 준비(사람이 한 번)

1. **검사 서버(5274)가 켜져 있어야 한다** — 녹화가 이 서버의 3D 화면을 찍는다.
   확인: 브라우저에서 http://localhost:5274/preview.html 이 열리면 된다. 안 열리면 이 폴더에서 `npm run dev:check` 를 따로 띄워 둔다(창을 닫으면 꺼짐).
2. **번호 고르기 — 지금 자동 실행기와 겹치지 않게.** 2026-11-26 밤 기준 자동 실행기가 26~50번을 만들고 있다. opencode 로는 **51번부터** 하나씩 맡긴다(3D 모델은 1~200번까지 있음).
   - 같은 번호를 둘이 동시에 만들면 파일이 서로 덮인다.
   - 렌더링(4단계)은 컴퓨터를 많이 쓴다. 자동 실행기와 동시에 돌리면 둘 다 느려지고, 메모리가 모자라면 합성이 실패할 수 있다(그때는 그 언어만 다시 합성하면 된다 — 6절).
3. 15~19시에는 GLM 을 쓰지 않는다(사용자 규칙).

## 3. 띄우는 방법

이 폴더에서 터미널(PowerShell)을 열고:

```powershell
cd E:\mechanical-elements-3d-main
opencode
```

opencode 화면이 뜨면 4절의 지시문에서 `NN` 을 번호(예: 51)로 바꿔 붙여 넣는다. 모델은 `zai-coding-plan/glm-5.3-flash`.
한 대화에 **번호 하나**만 맡긴다(길어지면 헤맨다). 30분이 넘도록 같은 자리에서 맴돌면 끊고 새 대화로 다시 맡긴다.

## 4. opencode 에 붙여 넣을 지시문

```text
TASK: make the YouTube Shorts of '507 Mechanical Movements' number NN in six languages (ko, en, ja, zh, hi, ar). Work in this folder only. Do not run git. Do not start any server. Do steps 1 to 5 in order and do not skip the checks.

STEP 1 — scripts. Read shorts/scripts/ko.json, en.json, ja.json, zh.json, hi.json, ar.json (entries "1" to "25" are approved examples — copy their style). Source facts: public/mm507/catalog.json entry "n": NN (title, easy, easyEn, ko, en) and src/mm507/i18n/ja.json, zh.json, hi.json, ar.json → titles["NN"], easy["NN"].
In each of the six files add the key "NN" = {"hook", "body", "cta"}. hook: one short curious question. body: one or two sentences of the working principle, only facts from the source, never engraving letters (A, B, C…). cta: EXACTLY the same string as entry "1" of that file. Keep all other keys and valid JSON (2-space indent).
Length of hook+body+cta: ko 45~60 characters without spaces, ja 45~58 characters, zh 40~58 characters, en 24~32 words, hi 18~25 words, ar 14~20 words. Write each language natively.
CHECK: run  node scripts/shorts/scriptlint.mjs NN  — every line must start with OK. Fix and re-run until it does.

STEP 2 — dubbing length. Run  node scripts/shorts/tts.mjs NN all . Then for each language L read shorts/_work/L/0NN/dub/dub.json (use 3 digits, e.g. 051). If "tooLong" is true, make that language's hook and body about 15% shorter (keep the facts, keep cta), run  node scripts/shorts/tts.mjs NN L  again and re-check. Repeat at most 3 times. Then run scriptlint again (all OK).

STEP 3 — render. Run  node scripts/shorts/make.mjs NN --langs=all  and wait until it ends (about 20~40 minutes). It records the 3D model, builds dubbing, subtitles, cards, sound and composes 12 videos.

STEP 4 — check. Run  node scripts/shorts/check.mjs NN --sheet . All 12 lines must start with OK. If a language failed with a memory error, run  node scripts/shorts/compose.mjs NN L  for that language and check again.

STEP 5 — review. Read shorts/ko/0NN.json … shorts/ar/0NN.json (title, description, tags, script). For every language check: written in that language, names this mechanism correctly, script says only facts from the source, no Korean inside non-Korean files, app link https://mechanical-elements-3d.vercel.app/#/mm/NN present. Write shorts/_work/review-0NN.md in Korean, one line per language: OK or the exact problem.

End with a short Korean summary: scriptlint result, which languages needed shortening, check.mjs result (12 OK?), review result.
```

## 5. 끝난 뒤 확인(사람)

- `shorts/_work/review-0NN.md` — 언어별 OK/문제.
- `shorts/preview-0NN.png` — 6개 언어 대표 장면(눈으로 화면·자막 확인).
- 영상: `shorts/<언어>/0NN.mp4`(세로·쇼츠), `0NN-wide.mp4`(가로), 업로드 정보 `0NN.json`.
- 업로드: 한·영은 `node scripts/shorts/upload.mjs NN`(비공개로 올림, 기록이 있으면 다시 안 올림). 일·중·힌디·아랍은 직접 올린다.

## 6. 막혔을 때

| 증상 | 할 일 |
|---|---|
| scriptlint 가 계속 BAD | 표시된 언어·길이를 보고 그 언어 대본만 다시 쓰게 한다 |
| 더빙이 계속 김(tooLong) | 끝 문장(cta)은 스크립트가 자동으로 빠르게 읽는다. 본문만 줄이게 한다 |
| make 중 `TimeoutError`·브라우저 시작 실패 | 검사 서버(5274)가 켜져 있는지 확인하고 make 를 다시 |
| 합성 `Cannot allocate memory` | 다른 렌더링이 끝난 뒤 `node scripts/shorts/compose.mjs NN <언어>` |
| GLM 이 같은 오류를 되풀이하며 30분 넘김 | 끊고 새 대화에서 남은 단계부터 맡긴다(예: "STEP 3부터") |

## 7. 하지 말 것

- git 명령, 서버 새로 띄우기, `scripts/`·`src/` 코드 수정 — 쇼츠는 대본(json)만 바꾸면 된다.
- 다른 번호의 대본 수정, cta 바꾸기.
- 자동 실행기가 만들고 있는 번호(26~50) 건드리기.
