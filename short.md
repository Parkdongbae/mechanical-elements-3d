# PRD — opencode 로 「507 기계 운동」 유튜브 쇼츠 만들기

작성: Opus · 2026-11-27 · 대상: opencode(모델 `zai-coding-plan/glm-5.3-flash`)와 그것을 띄우는 사람
이 문서가 `docs/work-orders/22-쇼츠-opencode-직접-작업.md` 보다 새롭다. 둘이 다르면 **이 문서를 따른다.**

---

## 1. 목적

「507 기계 운동」 앱의 3D 모델(1~250번 완성)을 번호 하나당 **유튜브 쇼츠 6개 언어 × 세로·가로 = 12편**으로 만든다.
쇼츠 한 편 = 원서 판화 → 3D 모델로 겹쳐 바뀜 → 돌며 보기 → 핵심 부위 확대(느린 재생) → "직접 돌려 보세요" + 앱 주소.
제작 도구(녹화·더빙·자막·카드·효과음·합성·검사)는 이미 다 있다. **opencode 가 하는 일은 대본을 쓰고, 정해진 명령을 차례로 돌리고, 결과를 확인하는 것뿐이다.** 코드 수정은 하지 않는다.

## 2. 범위

| 항목 | 내용 |
|---|---|
| 완성된 번호 | 1~51번(6개 언어 모두 완성·검증 끝). **건드리지 않는다.** |
| 이번에 만들 번호 | **52번부터** 한 번에 하나씩. 3D 모델이 있는 번호만(1~250). |
| 언어 | ko(한국어), en(영어), ja(일본어), zh(중국어), hi(힌디어), ar(아랍어) |
| 결과물 | 번호마다 `shorts/<언어>/NNN.mp4`(세로 1080×1920), `NNN-wide.mp4`(가로 1920×1080), `NNN.json`(업로드 정보) — 6개 언어 |
| 하지 않는 것 | 유튜브 업로드, git, 코드 수정, 서버 띄우기 |

## 3. 작업 환경

- 작업 폴더: `E:\mechanical-elements-3d-main` — opencode 는 **반드시 이 폴더에서** 띄운다.
- 검사 서버: `http://localhost:5274` 가 켜져 있어야 한다(녹화가 이 서버의 3D 화면을 찍는다).
  - 확인: 브라우저에서 `http://localhost:5274/preview.html?mm=52` 가 열리면 된다.
  - 꺼져 있으면 사람이 이 폴더에서 `npm run dev:check` 를 따로 띄워 둔다(창을 닫으면 꺼짐). opencode 는 서버를 띄우지 않는다.
- 디스크: E 드라이브에 여유가 **10GB 이상** 있어야 한다. 제작이 끝나면 녹화 프레임은 자동으로 지워진다(편당 약 70MB). 실패한 번호의 프레임은 남으니 가끔 확인한다.
- 시간: **15~19시에는 GLM 을 쓰지 않는다**(사용자 규칙).
- 한 대화(opencode 세션)에 **번호 하나**. 30분 넘게 같은 자리에서 맴돌면 끊고 새 대화로 남은 단계부터 맡긴다.

## 4. 번호 하나의 흐름(전체)

```
0. 길이 등급 확인 ── shorts/scripts/len.json (없으면 15초)
1. 대본 쓰기 ────── shorts/scripts/<6개 언어>.json 에 "NN" 추가
   └ 검사: node scripts/shorts/scriptlint.mjs NN   (6줄 모두 OK)
2. 더빙 길이 ────── node scripts/shorts/tts.mjs NN all
   └ 너무 긴 언어만 줄이고 다시(최대 3번)
3. 제작 ─────────── node scripts/shorts/make.mjs NN --langs=all   (20~40분)
4. 검사 ─────────── node scripts/shorts/check.mjs NN --sheet       (12줄 모두 OK)
5. 스스로 점검 ──── 7절 목록으로 대본·업로드 정보를 읽고 shorts/_work/self-check-0NN.md 에 적기
6. 마무리 보고 ──── 한글 요약 (사람·Claude 가 최종 검증)
```

번호는 파일 이름에서 **세 자리**(`052`), 명령 인자와 JSON 키에서는 **그냥 숫자**(`52`)다.

## 5. 0단계 — 길이 등급

- 쇼츠 길이는 번호마다 15초(기본), 20초, 25초 셋 중 하나다.
- 등급은 `shorts/scripts/len.json` 에 있다. 예: `{"35":20,"36":20}`. **없는 번호는 15초.**
- **opencode 는 len.json 을 고치지 않는다.** 등급은 사람(또는 Claude)이 미리 정한다.
  - 기준(참고): 동작이 한 가지인 단순한 기계 = 15초. 단계가 둘 이상이거나 멈춤·역전·속도 변화가 핵심인 기계 = 20초. 25초는 아주 드물게.
  - 20초 번호가 필요해 보이면 6단계 보고에 "20초가 나을 것 같음 — 이유"만 적는다.
- 길이에 따라 녹화 시간·확대 장면·더빙 허용 시간·대본 길이 기준이 자동으로 바뀐다(스크립트가 len.json 을 읽음).

## 6. 1단계 — 대본 쓰기

### 6-1. 읽을 것
- 본보기(승인된 대본): `shorts/scripts/ko.json`, `en.json`, `ja.json`, `zh.json`, `hi.json`, `ar.json` 의 `"1"` ~ `"51"`. 15초는 `"1"`~`"5"`, 20초는 `"35"`, `"36"`, `"39"`, `"46"`, `"49"` 를 따라 한다.
- 사실의 출처(**이것만** 쓴다):
  - `public/mm507/catalog.json` 에서 `"n": NN` 항목의 `title`, `ko`(원문 번역), `en`(원문 영어), `easy`(쉬운 풀이), `easyEn`.
  - `src/mm507/i18n/ja.json`, `zh.json`, `hi.json`, `ar.json` 의 `titles["NN"]`, `easy["NN"]`.
  - 필요하면 설계표 `docs/mm507-sheets/0NN.md`(모델이 실제로 어떻게 움직이는지, 숫자).

### 6-2. 쓸 것
6개 파일 각각에 키 `"NN"` 을 추가한다. 다른 키는 절대 바꾸지 않는다. JSON 은 2칸 들여쓰기, 유효해야 한다.

```json
"52": {
  "hook": "…",
  "body": "…",
  "cta": "…"
}
```

| 칸 | 규칙 |
|---|---|
| hook | 짧은 질문 하나. 이 기계가 궁금해지게. (예: "벨트 하나로 두 바퀴가 함께 돈다?") |
| body | 작동 원리. 15초는 1~2문장, 20초·25초는 2~3문장으로 단계(① 무엇이 → ② 어떻게 → 결과)를 설명. |
| cta | 그 언어 파일의 `"1"` 의 cta 와 **글자 하나까지 똑같이**. (ko: "앱에서 직접 돌려 보세요!") |

### 6-3. 길이(hook+body+cta 합계) — scriptlint 가 검사한다

| 등급 | ko(공백 뺀 글자) | ja(글자) | zh(글자) | en(낱말) | hi(낱말) | ar(낱말) |
|---|---|---|---|---|---|---|
| 15초 | 45~60 | 45~58 | 40~58 | 24~32 | 18~25 | 14~20 |
| 20초 | 70~85 | 66~82 | 60~82 | 36~46 | 27~36 | 21~28 |
| 25초 | 90~105 | 85~100 | 78~100 | 46~57 | 35~44 | 27~35 |

### 6-4. 내용 규칙(지금까지 검증에서 실제로 걸린 것들)
1. **출처에 없는 사실·숫자 금지.** 숫자(배수, 바퀴 수, 잇수)는 원문·쉬운 풀이·설계표에 있는 것만. 과장 금지("가장", "완벽하게" 등).
2. **판화 글자(A, B, C, a, b…) 금지** — 영상에는 글자가 안 보인다. "바퀴 A" → "큰 바퀴".
3. **6개 언어가 같은 내용**이어야 한다. 한국어를 낱말 그대로 옮기지 말고 그 언어답게 쓰되, 사실은 같게.
4. 문법을 지킨다. 특히 자주 틀린 것:
   - 힌디어: 목적어·조사(से, को) 빠뜨리지 말 것, 문장을 동사(है/होता है)로 끝낼 것.
   - 아랍어: 동사 뜻이 숫자와 맞게(예: يضاعف 는 "두 배로" 라서 "3배"에 쓰면 틀림 → "يجعل … 3 أضعاف"), 주어가 모호하지 않게.
5. 원문과 모델이 다르면(모델 설명에 "원문은 2배라 했지만 실제는 3배" 같은 메모가 있으면) **실제로 보이는 쪽**을 말하고 원문의 숫자를 단정하지 않는다.
6. 아랍어 숫자는 아라비아 숫자(3)로 써도 된다. 줄바꿈·이모지·해시태그는 대본에 넣지 않는다.

### 6-5. 검사
```
node scripts/shorts/scriptlint.mjs NN
```
6줄 모두 `OK` 로 시작해야 한다. `BAD` 줄은 언어와 이유(길이·cta·한글 섞임 등)를 알려 준다 — **그 언어만** 고치고 다시 돌린다.

## 7. 2단계 — 더빙 길이

```
node scripts/shorts/tts.mjs NN all
```
- edge-tts 로 6개 언어 더빙을 만들고, 말이 영상 시간 안에 들어가는지 잰다.
- 각 언어의 `shorts/_work/<언어>/0NN/dub/dub.json` 을 읽어 `"tooLong": true` 인 언어만:
  1. 그 언어의 hook·body 를 15% 정도 줄인다(사실은 그대로, cta 는 그대로).
  2. `node scripts/shorts/tts.mjs NN <언어>` 로 그 언어만 다시.
  3. 최대 3번. 그래도 길면 멈추고 보고.
- 줄인 뒤 `scriptlint` 를 다시 돌려 최소 길이 밑으로 내려가지 않았는지 확인한다(내려가면 줄이지 말고 다시 쓴다).
- 끝 문장(cta)이 길면 스크립트가 알아서 빠르게 읽는다 — cta 는 고치지 않는다.
- 네트워크 오류(edge-tts 연결 끊김)는 같은 명령을 다시 돌리면 된다.

## 8. 3단계 — 제작

```
node scripts/shorts/make.mjs NN --langs=all
```
- 20~40분 걸린다. 끝날 때까지 기다린다(중간에 다른 명령을 돌리지 않는다).
- 하는 일: 3D 녹화(언어별) → 더빙·자막 → 카드(인트로·아웃트로) → 효과음 → 합성(세로·가로) → 길이·형식 검사.
- 끝에 `OK shorts/ko/0NN.mp4 …` 같은 12줄이 나온다. `ERR` 이 있으면 9절.
- **구독·좋아요 버튼은 52번부터 자동으로 빠진다**(1~51번만 넣는 규칙, `compose.mjs` 의 `CTA_BUTTONS_LAST = 51`). 따로 할 일 없음.
- 배경음악은 Badinerie 로 자동. 음악 파일은 재배포 불가라 커밋·이동하지 않는다.

## 9. 4단계 — 검사

```
node scripts/shorts/check.mjs NN --sheet
```
- 12줄이 모두 `OK` 여야 한다(해상도·길이·음량·무음 구간·코덱).
- `--sheet` 가 `shorts/preview-0NN.png`(6개 언어 × 대표 장면)를 만든다 — 사람·Claude 가 눈으로 본다.
- 실패할 때:

| 증상 | 할 일 |
|---|---|
| 한 언어만 `ERR`, 로그에 `Cannot allocate memory` | `node scripts/shorts/compose.mjs NN <언어>` 로 그 언어만 다시 합성 후 check |
| 녹화 중 `TimeoutError`·브라우저 시작 실패 | 검사 서버(5274)가 켜져 있는지 사람에게 확인 요청, 그 뒤 make 다시 |
| `ENOSPC`(디스크 가득) | 멈추고 보고. 사람이 `shorts/_work/<언어>/<번호>/frames` 중 완성본이 있는 것을 지운다 |
| 길이 ERR(예: 19.9초 > 19.5) | 검사 기준 문제일 수 있음 — 멈추고 보고(스크립트 고치지 말 것) |
| 같은 오류가 두 번 반복 | 멈추고 보고 |

## 10. 5단계 — 스스로 점검(최종 검증은 Claude 가 한다)

**opencode(GLM) 의 점검은 최종 검증이 아니다.** 사용자 규칙상 검증은 Claude(Opus/Sonnet)가 따로 한다. opencode 는 아래를 확인해 `shorts/_work/self-check-0NN.md` 에 한국어로 언어마다 한 줄(`OK` 또는 문제)을 적는다.

`shorts/ko/0NN.json` … `shorts/ar/0NN.json` 을 읽고:
- [ ] 제목·설명·태그가 **그 언어**로 되어 있고, 이 기계 이름이 맞다.
- [ ] 영어가 아닌 파일에 한국어가 섞여 있지 않다.
- [ ] 앱 주소 `https://mechanical-elements-3d.vercel.app/#/mm/NN` 이 있다.
- [ ] 영어(en) 설명에만 다음 문장이 있다: `Chinese, Hindi, Arabic and Japanese speakers, please visit https://www.youtube.com/channel/UCKNs2uVXcGmB_48FMUyhtzQ`
- [ ] `script` 칸이 `shorts/scripts/<언어>.json` 의 `"NN"` 과 같다.
- [ ] 대본이 6-4 규칙(출처에 있는 사실만, 판화 글자 없음, 6개 언어 같은 내용)을 지킨다.

## 11. 6단계 — 마무리 보고(한국어, 짧게)

- 길이 등급(15/20/25초)과 scriptlint 결과
- 더빙을 줄인 언어(있으면)
- check 결과(12편 OK 인지)
- self-check 결과(문제 있던 언어)
- 원문·모델이 애매해 판단한 곳(있으면)

## 12. 완료 조건(Definition of Done)

번호 하나가 끝났다고 말하려면 모두 참이어야 한다.
1. `scriptlint NN` 6줄 모두 OK.
2. 6개 언어 모두 `dub.json` 의 `tooLong` 이 false.
3. `check.mjs NN --sheet` 12줄 모두 OK, `shorts/preview-0NN.png` 생성.
4. `shorts/_work/self-check-0NN.md` 작성.
5. 다른 번호·다른 파일을 바꾸지 않았다.

그 다음(사람·Claude 가 하는 일, opencode 는 하지 않음):
- Claude 검증(대본 사실·문법, 업로드 정보, 미리보기 그림) → 문제 있으면 그 언어만 고치고 `make.mjs NN --langs=<언어>` 로 다시 만든다.
- 직접 올리는 일·중·힌디·아랍 목록 갱신: `node scripts/shorts/uplist.mjs` → `shorts/UPLOAD-ja-zh-hi-ar.md`.
- 한·영 자동 업로드는 사용자가 시킬 때만: `node scripts/shorts/upload.mjs NN`(비공개, 이미 올린 번호는 건너뜀).

## 13. 하지 말 것

- `git` 명령 일체.
- 서버 띄우기·끄기(`npm run dev`, `npm run dev:check` 등).
- `scripts/`·`src/`·`public/`·`docs/` 아래 파일 수정 — 쇼츠는 `shorts/scripts/<언어>.json` 의 그 번호 키만 바꾼다. (예외 없음. 스크립트가 틀린 것 같으면 보고만.)
- `shorts/scripts/len.json` 수정.
- 다른 번호의 대본 수정, `cta` 바꾸기, 1~51번 건드리기.
- 유튜브 업로드(`upload.mjs`) 실행.
- 같은 번호를 두 대화에서 동시에 만들기(파일이 서로 덮인다). 렌더링(make) 두 개를 동시에 돌리기(메모리 부족).
- 배경음악 파일 복사·이동·커밋.

## 14. 파일 지도

| 경로 | 뜻 |
|---|---|
| `shorts/scripts/<언어>.json` | 대본(번호 → hook·body·cta). **opencode 가 쓰는 유일한 파일** |
| `shorts/scripts/len.json` | 길이 등급(15/20/25). 읽기만 |
| `public/mm507/catalog.json` | 원문·쉬운 풀이·제목(사실의 출처) |
| `src/mm507/i18n/<언어>.json` | 언어별 제목·쉬운 풀이 |
| `docs/mm507-sheets/0NN.md` | 3D 모델 설계표(실제 동작·숫자) |
| `scripts/shorts/scriptlint.mjs` | 대본 형식·길이 검사 |
| `scripts/shorts/tts.mjs` | 더빙·자막 |
| `scripts/shorts/make.mjs` | 녹화→합성→검사 한 번에 |
| `scripts/shorts/compose.mjs` | 합성만 다시(메모리 오류 때) |
| `scripts/shorts/check.mjs` | 완성 영상 검사, `--sheet` 미리보기 |
| `scripts/shorts/uplist.mjs` | 일·중·힌디·아랍 직접 업로드 목록 만들기 |
| `shorts/<언어>/0NN.mp4`, `0NN-wide.mp4`, `0NN.json` | 결과물 |
| `shorts/_work/<언어>/0NN/` | 중간 파일(더빙 dub.json, 카드, 녹화 프레임) |
| `shorts/preview-0NN.png` | 6개 언어 대표 장면 |

## 15. opencode 에 붙여 넣을 지시문(영어 — 번호 `NN` 만 바꿔서)

```text
TASK: make the YouTube Shorts of '507 Mechanical Movements' number NN in six languages (ko, en, ja, zh, hi, ar).
Read short.md in this folder first and follow it exactly. Work only in this folder. Do not run git. Do not start or stop any server. Do not edit any file except the key "NN" in shorts/scripts/ko.json, en.json, ja.json, zh.json, hi.json, ar.json. Do not edit shorts/scripts/len.json. Do not upload anything.

STEP 0 — length. Read shorts/scripts/len.json. The video length for NN is 15 seconds unless NN is listed there (20 or 25).

STEP 1 — scripts. Copy the style of the approved entries in the six script files (15 s: "1"-"5"; 20 s: "35","36","39","46","49"). Facts only from public/mm507/catalog.json entry "n": NN (title, ko, en, easy, easyEn), src/mm507/i18n/<lang>.json titles["NN"] and easy["NN"], and docs/mm507-sheets/0NN.md. In each file add "NN": {"hook","body","cta"}. hook = one short curious question. body = how it works (15 s: 1-2 sentences; 20/25 s: 2-3 sentences explaining the steps). cta = EXACTLY the cta string of entry "1" of that same file. No engraving letters (A, B, C...). No numbers or facts that are not in the sources. The six languages must say the same facts, each written natively and grammatically (Hindi: keep postpositions and end with a verb; Arabic: verbs must fit the numbers).
Length of hook+body+cta (15 s / 20 s / 25 s): ko 45-60 / 70-85 / 90-105 characters without spaces; ja 45-58 / 66-82 / 85-100 characters; zh 40-58 / 60-82 / 78-100 characters; en 24-32 / 36-46 / 46-57 words; hi 18-25 / 27-36 / 35-44 words; ar 14-20 / 21-28 / 27-35 words.
CHECK: node scripts/shorts/scriptlint.mjs NN  — all six lines must start with OK. Fix only the BAD languages and re-run.

STEP 2 — dubbing. node scripts/shorts/tts.mjs NN all . For each language L read shorts/_work/L/0NN/dub/dub.json (three digits, e.g. 052). If "tooLong" is true: shorten that language's hook and body by about 15% (keep facts and cta), run node scripts/shorts/tts.mjs NN L , check again (at most 3 times). Then run scriptlint again (all OK; if shortening broke the minimum length, rewrite instead of cutting).

STEP 3 — render. node scripts/shorts/make.mjs NN --langs=all  and wait until it finishes (20-40 minutes). Do not run anything else meanwhile.

STEP 4 — check. node scripts/shorts/check.mjs NN --sheet  — all 12 lines must start with OK. If one language failed with "Cannot allocate memory", run node scripts/shorts/compose.mjs NN L and check again. For any other error (timeout, ENOSPC, length) stop and report.

STEP 5 — self-check. Read shorts/ko/0NN.json ... shorts/ar/0NN.json. For each language check: title/description/tags in that language and naming this mechanism; no Korean inside non-Korean files; the app link https://mechanical-elements-3d.vercel.app/#/mm/NN is present; only the English description contains "Chinese, Hindi, Arabic and Japanese speakers, please visit https://www.youtube.com/channel/UCKNs2uVXcGmB_48FMUyhtzQ"; "script" equals the scripts file entry. Write shorts/_work/self-check-0NN.md in Korean, one line per language: OK or the exact problem.

End with a short Korean summary: length tier, scriptlint result, which languages were shortened, check result (12 OK?), self-check result, anything you were unsure about.
```

## 16. 막혔을 때(사람용)

| 증상 | 할 일 |
|---|---|
| scriptlint 가 계속 BAD | 표시된 언어·길이만 다시 쓰게 한다("STEP 1 for ar only") |
| 더빙이 계속 김 | body 만 줄이게 한다. 3번 넘으면 그 번호를 20초로 올릴지 Claude 에게 묻는다(len.json) |
| make 중 브라우저 오류 | 검사 서버(5274) 확인 후 "STEP 3부터" |
| 합성 메모리 오류 | 다른 렌더링이 끝난 뒤 `node scripts/shorts/compose.mjs NN <언어>` |
| 디스크 가득 | 완성 영상이 있는 번호의 `shorts/_work/<언어>/<번호>/frames` 지우기 |
| GLM 이 30분 넘게 같은 오류 | 끊고 새 대화에서 "STEP n 부터" |
| 끝난 번호 | Claude 에게 "NN번 쇼츠 검증해 줘" — 검증 후 업로드 목록 갱신 |
