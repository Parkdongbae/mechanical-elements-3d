# PROJECT KNOWLEDGE BASE

**Generated:** 2026-10-30
**Commit:** ce723ea
**Branch:** main

## OVERVIEW
Three.js 기반 기계 요소(기어·베어링 등) 3D 교육 조립 게임. 프레임워크 없는 Vite+TypeScript 단일 엔트리, 절차적 지오메트리 + OpenSCAD STL 파이프라인.

## STRUCTURE
```
./
├── index.html            # 유일한 HTML 엔트리 → src/main.ts
├── src/
│   ├── main.ts           # 464줄 게임 컨트롤러(god-controller)
│   ├── machines/         # 기계별 모듈 + 계약 타입(types.ts) — 자체 AGENTS.md
│   ├── models/           # 절차적 파트 팩토리/재질/썸네일 — 자체 AGENTS.md
│   ├── scene/            # SceneManager(렌더러·카메라·조명·env map)
│   ├── sim/              # PhysicsFX(cannon-es 오답 연출)
│   ├── state/            # localStorage 진행도(mech3d-progress-v2)·설정
│   ├── ui/               # HUD 클래스 + 정답 사운드
│   └── data/             # elements.ts(22파트), machines.ts(7기계 레지스트리)
├── parts/                # OpenSCAD 원본(.scad + 절대좌표 STL)
├── public/models/        # parts/ 수동 복사본(빌드 포함) — parts 수정 후 재복사 필수
├── mcp/image-to-stl/     # 로컬 MCP 서버(opencode.json 등록)
├── HANDOFF.md            # 설계 계약·금지 패턴·검증 규칙 — 작업 전 필독
├── 3d.md                 # 요구사항/마일스톤
└── openscad.md           # STL 저작 워크플로
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| 기계 추가 | src/data/machines.ts | 새 클래스 + 임포트 + MACHINES 항목 + main.ts switchMachine |
| 파트 지오메트리 | src/models/factory.ts | buildPart(), build*GearMesh() |
| 좌표/회전 버그 | machines/types.ts · factory.ts | axisPoint(scad) vs center(three) 구분 |
| 재질·텍스처 | src/models/surfaces.ts | getGrainMaps() 전 UV는 generatePlanarUVs() 선행 |
| 진행도/설정 | src/state/ | localStorage 키 mech3d-progress-v2 |
| 금지 패턴 | HANDOFF.md §6 | 규칙으로 취급 |

## CODE MAP
(중앙도: 문자열 참조 카운트 근사 — LSP 미설치)

| Symbol | Type | Location | Refs | Role |
|--------|------|----------|------|------|
| BaseMachine / Machine | class/type | src/machines/types.ts | 10 | 모든 기계의 계약 |
| buildPart() / mat() | fn | src/models/factory.ts | 7 | 파트 생성·재질 |
| CATEGORIES / PARTS | data | src/data/elements.ts | 4 | 카테고리·22파트 정의 |
| MACHINES / getMachineDef() | data | src/data/machines.ts | 3 | 기계 레지스트리(단일 팩토리점) |
| SceneManager | class | src/scene/SceneSetup.ts | - | 씬 부트스트랩 |
| disposeObject() | fn | src/models/factory.ts | - | 누수 방지 해제 |

## CONVENTIONS
- 코드 식별자는 영어, 주석/데이터문자열/문서/폴더명은 한국어 혼용.
- machines/는 PascalCase 파일명, models·scene·sim·state·ui는 lowercase 파일 + PascalCase 클래스 export.
- tsconfig가 Vite 기본보다 엄격: strict + noUnusedLocals/Parameters + noUncheckedIndexedAccess + noFallthroughCasesInSwitch.
- GLB 에셋 없음: 파트는 전부 절차 생성(factory.ts) 또는 OpenSCAD STL.

## ANTI-PATTERNS (THIS PROJECT)
- 좌표계 혼합 금지: scad axisPoint를 toThree() 변환 전에 three center와 섞지 않는다(GearHunt.ts:285 가드 주석).
- GearHunt 회전 부호: DRAG_DEFS/PRE_PLACED의 `sign`만 수정, 프레임 비교로 검증.
- GearHunt 복원은 반드시 `huntIds` 배열 기반(파트 수 기반 복원은 과거 버그).
- 재질 분할(addGroup) 시 prepareGeometry의 새 BufferGeometry를 반환해 Mesh에 사용(원본 재사용 시 회전/UV/그룹 유실).
- opacity 페이드 인트로 애니메이션 금지(베어링이 opacity 0로 남음, drop-only 사용).
- 금속 PBR은 SceneSetup의 studio env map 없이는 어둡게 렌더링됨.
- parts/ 수정 후 public/models/ 재복사 누락 금지.

## UNIQUE STYLES
- `mechanical-elements-3d/`는 루트의 완전 복제 체크아웃(별도 .git). 루트 사본만 편집.
- STL은 Z-up 절대좌표 → 코드에서 rotateX(-π/2) 필요. UV 없음 → generatePlanarUVs() 필수.

## COMMANDS
```bash
npm run dev        # vite, host:true, :5173
npm run build      # tsc --noEmit && vite build
npm run preview    # dist 서빙
node mcp/image-to-stl/server.mjs   # 로컬 MCP 서버
```

## NOTES
- 테스트 러너 없음. 검증 = tsc --noEmit + build + playwright 헤드리스 Chrome 프레임 비교(HANDOFF.md §8).
- 검증 전 `localStorage.clear()`로 상태 초기화.
- vite chunkSizeWarningLimit 1200 — 대형 청크 허용됨.
- HuntMachine/isHuntMachine은 예약됨(미사용, HANDOFF.md 명시).
