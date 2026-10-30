# MODELS — 절차적 지오메트리 팩토리

src/models/는 GLB 에셋 없이 모든 3D 파트를 만드는 레이어: factory.ts(651줄, 22파트 절차 생성 + 기어 수학 + ChainPath2D), surfaces.ts(나무결 그레인맵 + 평면 UV), thumbnails.ts(썸네일 팩토리).

## OVERVIEW
buildPart()가 데이터(elements.ts의 PartDef)를 받아 Three.js 메시를 생성하는 프로젝트의 지오메트리 단일 진입점.

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| 파트 생성/변형 | factory.ts | buildPart(), normalizePart(), build*GearMesh() |
| 체인/경로 따라가기 | factory.ts | ChainPath2D 클래스, buildChainAlongPath() |
| 재질 질감 | surfaces.ts | getGrainMaps() — STL엔 UV가 없어 generatePlanarUVs() 선행 필수 |
| 메모리 누수 | factory.ts | disposeObject() — main·physics·thumbnails가 사용 |

## CONVENTIONS (루트와 다른 점)
- lowercase 파일명 + PascalCase 클래스 export(factory.ts는 함수 다수 export).
- OpenSCAD STL은 Z-up 절대좌표: 로드 후 rotateX(-π/2) 변환이 이 레이어의 책임.

## ANTI-PATTERNS (이 디렉터리)
- 재질 분할(addGroup) 시 prepareGeometry가 반환하는 새 BufferGeometry를 Mesh에 사용할 것 — 원본 geometry 재사용 금지(회전/UV/그룹 유실 과거 버그).
- 금속 PBR 재질은 SceneSetup의 studio env map 없이 사용 금지(어둡고 평평하게 렌더링).
- STL 로드 후 generatePlanarUVs() 생략 금지 — 그레인맵이 깨진다.

## NOTES
- 핫스팟: factory.ts 651줄, 전체 프로젝트에서 가장 많이 참조되는 모듈(main·모든 기계·thumbnails·physics).
- gearShape()는 ExtrudeGeometry용 2D 단면 생성기 — 기어 수정 시 여기서부터.
- surfaces.ts의 그레인맵은 캔버스 기반 절차 생성 — 외부 텍스처 파일 없음.
- thumbnails.ts는 ThumbnailFactory로 미리보기 메시를 생성 — UI 표시 전용.
