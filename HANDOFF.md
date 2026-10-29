# HANDOFF — 3D 기계요소 학습 웹앱 인수인계 문서

> 새 세션에서 이 프로젝트를 이어받을 때 이 문서를 먼저 읽으세요.
> 마지막 업데이트: 2026-10-29

## 1. 프로젝트 개요

중학교 '기술·가정' 2022 개정 교과과정 '기계의 구성과 동력 전달' 단원용 3D 인터랙티브 학습 웹앱.
불완전한 3D 기계를 관찰하고, 알맞은 기계요소를 찾아 드래그/조립하면 동력 전달 애니메이션이 작동합니다.

- **참조 교재**: `교과서및지도서/2022개정_미래엔_중학교_기술·가정②_교사용교과서_5단원(2026).pdf`
  (기계요소 분류는 이 교과서 기준 4분류: 결합용/축용/제어용/전동용 — 관용은 이 단원 미수록)
- **기획 문서**: `3d.md` (요구사항·마일스톤·검증 이력)

## 2. 실행 방법

```powershell
cd C:\Users\Park\Desktop\Mechanical_elements
npm run dev        # → http://localhost:5173 (포트 점유 시 5174)
npm run build      # 프로덕션 빌드 (dist/)
npm run preview    # 빌드 결과 미리보기
```

- Node v24, Windows 환경.
- `Port in use` 메시지가 뜨면 이전 vite 프로세스가 살아있는 것 — 5173/5174 리스너 종료 후 재시작.

## 3. 기술 스택

| 항목 | 선택 |
|---|---|
| 빌드 | Vite 5 |
| 언어 | TypeScript (strict, noUncheckedIndexedAccess) |
| 3D | Three.js 0.170 |
| 물리(오답 연출) | Cannon-es 0.20 |
| 3D 에셋 | **전부 절차적 생성** (GLB 파일 없음) + 기어 장치·철골 구조물은 parts/ STL 로드 |

## 4. 미션(머신) 7종 — 화면 좌상단에서 전환

| 머신 id | 이름 | 미션 단계 (순서 강제) | 완료 시 애니메이션 |
|---|---|---|---|
| bicycle | 🚲 자전거 | 크랭크축(축용) → 스프로킷 → 체인 → 평행 핀 (4단계) | 페달 60rpm → 뒷바퀴 100rpm(기어비 1.67), 체인 링크 이동 |
| clock | ⏰ 시계 | 스프링(태엽, 제어용) → 평 기어 (전동용) | 태엽 드럼 6rpm → 분침 3rpm → 시침 0.26rpm (1/24 감속 아님, 6:2 관계) |
| treadmill | 🏃 러닝머신 | 볼 베어링(축용) → 벨트와 풀리(전동용) | 모터 롤러 60rpm → 벨트 1.13m/s |
| steering | 🚗 자동차 핸들 | 래크와 피니언 → 링크 (전동용) | 핸들 ±55° → 래크 ±29cm → 바퀴 조향 |
| gearhunt | 🔍 기어의 종류 | 조립 단계 없음 — **개별 STL 부품을 동력 전달 순서대로 드래그 조립** (7단계) | 전 기어가 맞물려 회전, 슬라이더로 속도 제어(0~10x) |
| steelframe | 🏗️ 철골공사 | 정답 1단계 — 하부/상부 기둥·이음칼라·H형 들보가 인트로 애니메이션으로 순차 조립 등장, **하단 패널에서 결합용 나사(볼트와 너트)를 찾아 선택** | bolts_nuts.stl이 비행해 접합부에 체결(에미시브 플래시), 정보 패널 표시 |
| merryround | 🎠 회전놀이기구 | 정답 1단계 — base → shaft → hub_cap → turntable → handles 순서 인트로 조립, **하단 패널에서 축용 볼 베어링을 찾아 선택** | ball_bearing.stl이 비행해 축에 체결(플래시) 후 회전부(회전판·허브캡·핸들·베어링 볼)가 램프업하며 회전(≈8.1rpm), 정보 패널 표시 |

## 5. 파일 구조와 역할

```
src/
├── main.ts              # 게임 컨트롤러: 머신 전환, 미션 진행, 드래그/클릭 판정, 메인 루프
├── data/
│   ├── elements.ts      # 기계요소 4대분류 + 22종 데이터 (교과서 검증됨)
│   └── machines.ts      # 7개 머신 정의 (단계·라벨·힌트·완료문구)
├── machines/
│   ├── types.ts         # Machine / HuntMachine / DragMachine 인터페이스 + BaseMachine
│   ├── Bicycle.ts       # 자전거 (프레임 절차 생성, 4슬롯, 체인 경로 ChainPath2D)
│   ├── Clock.ts         # 시계 (태엽 드럼 하우징, 기어 트레인)
│   ├── Treadmill.ts     # 러닝머신 (벨트 ChainPath2D 재사용, 그루브 풀리)
│   ├── Steering.ts      # 자동차 조향장치 (기울어진 컬럼, 타이로드 동기화)
│   ├── GearHunt.ts      # STL 드래그 조립 (parts/ 개별 부품 10종 로드)
│   ├── SteelFrame.ts    # 철골공사 — parts/bolt_nut STL 5종 로드, 인트로 조립, 볼트 체결
│   └── MerryGoRound.ts  # 회전놀이기구 — parts/회전 놀이 기구 STL 6종 로드, 인트로 조립,
│                        #   볼 베어링 체결 후 회전. 삼각형 무게중심으로 재질 분할(핸들 빨강/파랑,
│                        #   베어링 링/볼) — splitByMaterial + geometry groups
├── models/
│   ├── factory.ts       # 22종 부품 절차 생성 팩토리 + ChainPath2D(외접접선 경로) + normalizePart
│   ├── surfaces.ts      # 공용: 브러시드 메탈 그레인 맵(getGrainMaps) + 플래너 UV(generatePlanarUVs)
│   │                    #   — SteelFrame/MerryGoRound 등 STL 파트 머신 공용 (SteelFrame에서 추출)
│   └── thumbnails.ts    # 오프스크린 렌더러로 부품 썸네일 PNG 생성
├── scene/SceneSetup.ts  # 렌더러/카메라/조명/바닥/OrbitControls (add/remove 래퍼 포함)
│                        # + 스튜디오 환경맵(PMREM): 하늘 그라데이션+HDR 소프트박스 — 금속 PBR 반사용
├── sim/physics.ts       # Cannon-es 오답 물리 연출
├── state/progress.ts    # localStorage 진행도 (머신별 installed/huntIds + last)
├── ui/hud.ts            # 머신바/대분류/소분류 패널/미션칩/토스트/학습카드/속도슬라이더
└── style.css            # 반응형 스타일 (PC + 태블릿)
public/models/           # parts/ 에서 복사한 STL (빌드 포함용) — parts 수정 시 재복사
public/models/bolt_nut/  # 철골공사 STL 5종 (parts/bolt_nut 에서 복사)
public/models/merry_round/ # 회전놀이기구 STL 6종 (parts/회전 놀이 기구 에서 복사)
parts/                   # 원본 STL (OpenSCAD 기어 장치 개별 부품 + total, bolt_nut 철골 부재,
                         #   회전 놀이 기구 6종 + .scad 원본)
3d.md                    # 기획 문서
HANDOFF.md               # 이 문서
```

## 6. 핵심 설계 — 새 코드 작성 시 반드시 알아야 할 것

### 6-1. 머신 인터페이스 (src/machines/types.ts)
- `Machine`: stepCount, isInstalled, getFlyTarget, slotTarget, buildStepModel, installStep, reset, update, boostHint, createSim
- `BaseMachine`: 공통 구현(슬롯 펄스, 그림자). `stepCount` 오버라이드 가능 (GearHunt = 0)
- `HuntMachine`: 클릭 찾기 모드 (beginHunt/handleHuntPick...) — 현재 사용처 없음(예비)
- `DragMachine`: 드래그 조립 모드 (GearHunt) — isDragMachine() 타입 가드 사용
- **좌표계 혼합 금지**: `axisPoint`는 OpenSCAD(scad) 좌표, `center`는 회전 변환 후 three 좌표.
  뺄셈 전 반드시 `toThree(axisPoint)` 변환 — 이 버그로 부품이 유형 중심을 공전한 적 있음(GearHunt.ts 참조)

### 6-2. 회전 방향 부호 규약 (GearHunt)
부호는 OpenSCAD 원본 애니메이션의 회전 방향을 따르며, 접촉점 속도 일치로 검증됨:
- spur_gear2(구동, -1) ⇄ spur_gear1(+1): 외접 맞물림 = 반대 부호
- bevel_gear1(+1, 수직축) → bevel_gear2(+1, 수평축): 90° 베벨 — 접촉 속도 일치
- bevel_gear2 축 → worm_screw(+1): 사용자 지시로 bevel2와 반대 방향
- worm_screw(-비율 1) → worm_wheel(-1, 1/24 감속) → pinion(-1, 1/24, 동축) → rack(+1 슬라이드)
- 방향 변경은 DRAG_DEFS/PRE_PLACED의 `sign` 만 수정. 수정 후 반드시 프레임 비교 검증

### 6-3. 진행도 저장 (localStorage key: `mech3d-progress-v2`)
```ts
{ last: string, machines: { [id]: { installed: number, completedOnce: boolean, huntFound?: number, huntIds?: string[] } } }
```
- GearHunt 복원은 `huntIds`(설치 순서대로 정렬된 부품 id 배열) 기준 — 개수 기반이면 잘못된 부품이 복원되는 버그 발생했었음

### 6-4. 슬롯(빈 자리) 표시
`BaseMachine.addSlot(step, radius, position)` → 초록색 토러스가 펄스. 순차 미션에서는
이전 단계 설치 시 `hideSlot(n) / showSlot(n+1)` 호출 필요

## 7. STL 파이프라인 (기어의 종류 / 철골공사 / 회전놀이기구)

1. 원본: `parts/*.stl`, `parts/bolt_nut/*.stl`, `parts/회전 놀이 기구/*.stl`
   (OpenSCAD로 생성, Z-up, mm, **조립 좌표계 유지**)
2. `public/models/`, `public/models/bolt_nut/`, `public/models/merry_round/` 로 복사 (빌드 포함) — parts 수정 시 반드시 재복사
3. GearHunt.ts가 STLLoader로 로드: `rotateX(-π/2)` (Z-up→Y-up) → bbox 중심 `center` 빼기
   → scale `k` = 2.6/maxDim → 회전축은 `toThree(axisPoint) - center` 기준
4. **각 부품 STL은 조립 좌표 그대로 export 되어야 함** (OpenSCAD render_part 위치 유지)
5. SteelFrame.ts: `prepareGeometry()`에서 rotateX 후 각 부품 bbox 중심 재배치(자기 중심 회전용),
   scale k = 0.0026(전체 폭 1000mm → 2.6). **STL에는 UV가 없으므로** `generatePlanarUVs()`로
   법선 지배축 플래너 UV를 생성해야 그레인(러프니스/범프) 맵이 면 전체에 적용된다
6. 금속 PBR 사실감: SceneSetup의 스튜디오 환경맵(하늘 그라데이션 + HDR 소프트박스)이 필수 —
   환경맵 없이는 metalness 높은 재질이 어둡고 평면하게 보임. 평면 위주 STL 면은 환경을
   단일색으로 반사하므로 그레인 맵으로 미세 변화를 준다
7. **재질 분할 패턴 (MerryGoRound.ts 참조)**: STL은 재질이 1개뿐이라 단색으로 보인다.
   삼각형 **무게중심**을 분류해 `geometry.addGroup()`으로 재질 배열을 나눈다.
   - 핸들: 무게중심 각도(atan2) → 45° 간격 8개 섹터 → 홀짝으로 빨강/파랑 교차 (참조 사진과 동일)
   - 베어링: 무게중심 반지름 → 볼 중심 70mm 근처(68~71.5)만 볼(금색), 나머지 링(은색).
     링 표면 삼각형의 무게중심 반지름은 정확히 65/75이므로 경계를 넓게 잡으면 링이 금색으로 오분류됨
   - **주의: 분할하면 새 BufferGeometry가 만들어지므로 반드시 prepareGeometry가 분할된
     지오메트리를 반환하고 호출부가 그것을 Mesh에 쓰게 할 것.** 원본을 재사용하면
     회전/UV/그룹이 모두 빠진 채 렌더되고 재질 배열도 무시된다(전부 material[0] 색으로 보임)

## 8. 검증 패턴 (수정 후 반드시)

1. `npx tsc --noEmit` + `npm run build`
2. playwright(headless Chrome) E2E:
   - 부품 카드 좌표는 **화면 캡처 후 픽셀 확인** (카메라 각도에 따라 다름)
   - 조립 완료 후 1초 간격 2프레임 비교 — 회전 방향·축 중심·공전 여부 확인
   - 래크 등 슬라이드 부품: 2.5s 간격 3프레임 — 이동 방향·리셋 주기 확인
3. 검증 중 발견된 과거 버그들 (재발 방지):
   - 체인이 스프로킷 안쪽을 감음 → ChainPath2D arc 방향 부호
   - 크랭크축 설치 시 위치 이중 오프셋 → installStep에서 model.position 리셋
   - 래크 속도에서 웜 감속비 누락 → /24 적용
   - GearHunt 복원 시 개수 기반 복원으로 잘못된 부품 배치 → huntIds 배열 사용
   - 핸들 컬럼·시계 드럼 등 축점 좌표 오차 → STL bbox center 실측으로 교정

## 9. UI 요소

- 좌상단: 머신 선택 바 (6개)
- 상단: 미션 텍스트 + 단계 칩 + 힌트/다시하기 버튼
- 우상단: 속도 슬라이더 (GearHunt만, 0~10x) 또는 RPM/정보 패널
- 우측 중앙: 🏷️ 기어 이름 보기 버튼 (GearHunt만, 클릭 시 전동용 패널)
- 하단: 대분류 4버튼 → 소분류 패널(썸네일)
- 하단 최하단: 마우스/터치 조작법 안내
- 토스트: 정답(초록)/오답·경고(빨강)/안내(흰색)

## 10. 알려진 동작/주의

- 페이지 로드 시 진행도 복원 — 테스트 전 `localStorage.clear()` 권장 (playwright evaluate)
- 배치 실패(빗나친 드래그) 시 OrbitControls가 카메라를 회전시킴 → 이후 좌표는 재확인 필요
- info-card(학습 카드)가 열리면 하단 패널 클릭을 가림 → 자동화 시 `.info-close` 먼저 클릭
- 부품 클릭 판정: 정밀 레이캐스트 우선, 실패 시 외접구 폴백 (얇은 축 잡기용)
- 시계 평기어는 웜 드럼 기어(14치)와 맞물림 (중심거리 = 반지름 합)
- 자전거 평행 핀은 시뮬레이션 중 체인을 따라 이동 (userData.s + chainOffset)
- 철골공사(SteelFrame): 오답 물리 연출 중(`physics.busy`, ttl 2.0s)에는 부품 선택이 무시됨 —
  headless 저FPS(4fps) 환경에서는 dt cap 0.05s 때문에 busy 해제에 최대 10s 소요. 실기기(60fps)는 무관
- 철골공사 복원: 진행도 installed=1인데 bolts_nuts.stl이 아직 로드 전이면 `pendingInstall` 플래그로
  로드 완료 시점에 자동 체결됨 (인트로는 재생되지 않음)
- 회전놀이기구(merryround): 축(shaft)·베이스는 고정부, 회전판·허브캡·핸들·베어링은 `spinGroup`이
  rotation.y로 회전(램프업 1.8s → ≈8.1rpm). 인트로 등장 순서는 사용자 지정으로
  base(0s) → shaft(0.5s) → hub_cap(1.0s) → turntable(1.5s) → handles(2.0s) — 허브 캡이 회전판보다
  먼저 떠 있다 판 위에 안착하는 연출이 의도된 것
- 회전놀이기구 베어링 가시성: 회전판(지름 2000mm)이 베어링(r95mm) 위를 덮어 **체결 후에는
  회전판 아래로 가려진다**. 베어링이 잘 보이는 순간은 하단 패널 썸네일 → 비행(체결 전) → 플래시.
  정밀하게 보려면 우클릭 팬으로 시점을 회전판 아래로 내린 뒤 확대
- playwright는 devDependencies에 추가됨 (`npx playwright install chromium` 필요 없음 —
  %LOCALAPPDATA%\ms-playwright에 chromium-1248 있음). E2E 시 headless는 저FPS(4fps)라
  dt cap 0.05s 때문에 비행/물리/busy 해제가 수 초 걸림 — 대기 시간 넉넉히
- 검증용 스크린샷 픽셀 비교는 `frameA.equals(frameB)` (Buffer)로 충분 — 회전 중이면 바이트 불일치
