# MACHINES — 기계 모듈 계약

src/machines/는 7개 기계 구현(Bicycle·Clock·GearHunt·MerryGoRound·SteelFrame·Steering·Treadmill)과 그 계약 타입(types.ts)을 담는다. 루트 규칙 외 이 디렉터리 고유 규칙만 기술.

## OVERVIEW
BaseMachine 상속으로 기계를 구현하고, types.ts의 MachineSim/DragMachine 판별자로 렌더·인터랙션을 분기하는 도메인.

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| 기계 인터페이스 | types.ts | Machine, MachineSim, MachineDisplayItem |
| 드래그 기계 계약 | types.ts | DragMachine + isDragMachine() |
| 예약 인터페이스 | types.ts | HuntMachine + isHuntMachine() — 미사용, HANDOFF.md 예약 명시 |
| 회전/좌표 버그 | 각 기계 | axisPoint(scad) vs center(three) 구분 확인 |

## CONVENTIONS (루트와 다른 점)
- 파일명 PascalCase(Bicycle.ts 등) — 프로젝트 내 유일한 디렉터리.
- 각 클래스는 BaseMachine 확장 + 단일 클래스 export(Bicycle만 RING_R·SPR_R 상수 추가 export).
- 기계 등록은 src/data/machines.ts에서: 새 클래스 + 임포트 + MACHINES 항목 추가가 계약.

## ANTI-PATTERNS (이 디렉터리)
- GearHunt 회전 부호: DRAG_DEFS/PRE_PLACED의 `sign` 필드만 수정한다(프레임 비교 검증 후).
- GearHunt 복원: 반드시 `huntIds` 배열 기반. 파트 수 기반 복원 금지(과거 버그).
- scad axisPoint를 toThree() 변환 전에 three center와 혼합 금지(GearHunt.ts:285 가드 주석).
- 인트로에서 opacity 페이드 금지 — drop-only 연출만.

## NOTES
- 핫스팟: Bicycle.ts(481줄), MerryGoRound.ts(463줄), GearHunt.ts(410줄).
- 물리 연출(cannon-es)은 src/sim/physics.ts의 PhysicsFX가 담당 — 기계 내부에 물리 엔진 직접 호출 금지 아님, 기존 패턴은 PhysicsFX 경유.
