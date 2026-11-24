# 이어서 할 일 (2026-11-24 저녁 기준)

새 세션은 이 문서 → `HANDOFF.md` 0장 → 아래에 적힌 지시서 순으로 읽고 시작한다.
브랜치: `feature/home-school-20` (푸시 전). 검증용 dev 서버: `npm run dev -- --port 5273 --strictPort` (`.claude/launch.json`의 `dev`).

## A. 가정·학교 미션 20종 (지시서 `docs/work-orders/14-가정·학교-20종.md`)
- 구현·커밋 완료 17종: Opus 5(fan, umbrella, piano, clickpen, printer), Sonnet 7(sharpener, doorhandle, swivelchair, flagpole, board, gate, swing), Haiku 2(desk, ladder), GLM 3(seesaw=glm-5.3, door·window=glm-5.3-flash).
- GLM(flash) 순차 실행 중이던 3종: stapler(파일 작성됨, **미커밋**), scooter, hoop.
  로그: 스크래치패드 `q-<id>.log`. 파일이 15줄 스텁 그대로면 다시 실행:
  `bash <스크래치패드>/flash-main.sh <id> <파일> <설계표 절>` 대신, 지시서 14의 5장 설계표를 그대로 주고 `opencode run --auto -m zai-coding-plan/glm-5.3-flash "…"` 로 1개씩.
- **남은 일**: ① 3종 완료 확인·커밋 ② **Opus 최종 검증·수정**(지시서 14의 6장 — 20종 전부 캡처 검수, Haiku·GLM 담당은 보강, 사다리는 크기가 기준(반경 3)을 넘음, 태극기 괘 위치 확인) ③ `node scripts/thumbs.mjs` ④ `node scripts/smoke.mjs` ⑤ `npm run build` ⑥ HANDOFF 갱신 ⑦ 푸시·PR.
- 참고: `preview.html`의 `&t=`는 실제 시간이 그만큼 흘러야 도달한다(헤드리스는 느리므로 대기 ms를 넉넉히).

## B. 「507 기계 운동」 (지시서 `15-507-자료준비.md`, `16-507-전체계획.md`, 진행표 `docs/mm507-progress.md`)
- **P0 자료 완료**: `data/mm507/pNNN.json` 57쌍 — 507개 전부 한글 이름·번역·쉬운 풀이·분류·모델링 메모·판화 좌표. 영어 원문은 OCR(`data/mm507/en.json`, 441개 자동 분할 + `enStart`로 병합 예정). 표제지·서문 확인 사실은 지시서 16의 5장.
- 설계표 작성됨: 001, 002, 003, 005, 008, 009, 010 (`docs/mm507-sheets/`). **004·006·007은 미작성**(판화 확인함: 004 = 위 풀리 + 아래 양쪽 안내 풀리 + 가운데 수직축 홈 풀리의 삼각 벨트, 006 = 손잡이 달린 반원 세그먼트 + 아래 풀리 2개의 엇걸이 벨트, 007 = 풀리 3개(고정·헐거움·고정) + 속 빈 축 + 베벨 기어 A·B·C).
- GLM 대기열(이 세션의 백그라운드에서 순차 실행 걸어 둠): 미션 3종 → `glm_run.sh kit`(glm-5.3) → `glm_run.sh tools`. 결과 로그 `shots/mm/log/kit.log`, `tools.log`. 새 세션에서는 `src/mm507/kit/`, `scripts/mm507/build_assets.py`, `public/mm507/catalog.json` 존재 여부로 완료를 판단하고, 없으면 다시 실행한다.
- **남은 일(순서)**: ① 키트 검증(`preview.html?mm=kit` 캡처)·수정 ② `glm_run.sh 1`, `2` → 판화와 대조 검증 → 키트 보완 ③ `glm_run.sh gallery`(목록·상세·소개·홈 카드) 검증 ④ 설계표 004·006·007 작성, 이후 10개 묶음으로 "설계표 → GLM 순차 실행 → Opus 검증·수정 → 커밋" 반복 ⑤ 100번에서 문서·스모크·빌드·푸시.
- 규칙: 앱 코드는 GLM, Claude는 지시서·설계표·검증·수정. GLM은 **한 번에 1건**(동시 실행 시 요청 한도). 양산은 glm-5.3-flash, 뼈대는 glm-5.3.
- 영어 원문을 모델이 길게 옮겨 적으면 출력 필터에 막힌다 — 원문은 OCR 산출물을 스크립트로만 다룬다.

## C. 기타
- `mechanical_movements_507/`(PDF·링크)는 사용자가 넣은 원본 자료 — 커밋하지 않았다. 저장소에 올릴지 `.gitignore`에 넣을지 사용자 확인 필요(PDF 18MB).
- `vite.config.ts`에 감시 제외 설정 추가(내려받는 파일 때문에 dev 서버가 죽던 문제).
- 풍동 실험 '하부 보기'는 완료·커밋됨.
