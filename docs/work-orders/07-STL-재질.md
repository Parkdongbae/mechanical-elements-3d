# 작업 지시서 07 — STL 기계 8종 재질·연출 통일

먼저 `00-개요.md`, `HANDOFF.md` 7장(STL 파이프라인)·10장(주의)을 읽는다.

소유 파일: `src/machines/GearHunt.ts`, `SteelFrame.ts`, `MerryGoRound.ts`, `DrivetrainFF.ts`, `DrivetrainFR.ts`, `DrivetrainAWD.ts`,
`DrivetrainEVSingle.ts`, `DrivetrainEVDual.ts`. 필요하면 공용 헬퍼를 `src/machines/stlShared.ts`(신규)에 둔다. `src/models/surfaces.ts` 수정 가능.

## 원칙

**형상(STL)·좌표·회전 부호·미션 로직·인트로 순서는 절대 바꾸지 않는다.** 사용자가 직접 만든 OpenSCAD 모델이고, 회전 방향은 사용자 지정이다.
바꾸는 것은 재질·음영·보조 요소뿐이다.

## 할 일

1. **셰이딩**: STL은 면 법선(flat)이라 원통이 각져 보인다. 로드 직후 `BufferGeometryUtils.mergeVertices` + `toCreasedNormals(geo, 각도≈35°)`
   (three/examples/jsm/utils/BufferGeometryUtils.js)로 곡면은 매끈하게, 모서리는 날카롭게. UV 생성(`generatePlanarUVs`)·재질 그룹 분할(MerryGoRound의
   `splitByMaterial`)과의 순서 주의 — 인덱스/그룹이 깨지지 않는지 확인. 정점 수가 큰 STL에서 로딩 지연이 과하면 해당 부품은 생략하고 보고.
2. **재질**: 각 파일의 `new THREE.MeshStandardMaterial({...})` 레시피를 `src/models/materials.ts` 함수로 교체.
   - 엔진·변속기·디퍼렌셜 하우징 → `castIron` / `aluminum` (서로 다른 톤으로 구분)
   - 축류(구동축·차축·프로펠러 샤프트) → `steel` / `darkSteel`
   - 타이어 → `rubber`, 휠 → `aluminum`/`chrome` (재질 그룹이 없어 단일 재질이면 타이어 톤 우선)
   - 배터리·모터(EV) → 배터리는 `plastic` 계열 짙은 색 + 포인트, 모터는 `aluminum` + `copper` 느낌
   - 철골 H빔 → 붉은 방청 도장(`paint(0x9c3b2e)`류) 또는 강재 톤, 볼트·너트는 `steel`(아연 도금 밝은 톤)
   - 회전놀이기구 → 원색 `paint`(기존 빨강/파랑 유지), 베어링은 `chrome`+`brass`
   - 기어의 종류 → 기어 종류별로 금속 톤을 달리해 구별(황동/청동/강재), 정답 가이드(반투명)는 `ghost`
   - 반투명 하우징(ghost)·유리 회전판은 `ghost()`/`glass()` 사용, opacity 값은 기존과 비슷하게.
   - 기존 코드가 재질의 `emissive`/`opacity`를 애니메이션(플래시·페이드)한다 — 교체 후에도 그대로 동작해야 한다.
3. **라벨**: 캔버스 스프라이트 라벨(`makeLabel`/`makeCallout`)의 모양을 통일 — 둥근 알약형 배경(짙은 남색 85% 불투명), 흰 글자, 굵기 700,
   해상도 2배(흐릿하지 않게), 지시선은 같은 색. 공용 헬퍼로 추출 권장. `layers.set(1)` 유지.
4. **그림자**: 모든 STL 메시 `castShadow`/`receiveShadow` 확인. 각 기계의 자체 바닥판/받침이 있으면 새 바닥(밝은 회색 스튜디오 바닥)과 어울리게 색 조정 또는 제거.
5. **회전 마커**(바퀴의 주황 박스): 형태는 유지하되 `glow()` 재질로 통일.

## 검증
- 8개 기계 각각 `preview.html?machine=<id>&steps=0` 과 `steps=all&t=2` 캡처(인트로 애니메이션이 있으니 대기 6000ms 이상), 다크 테마 2~3장.
  id: `gearhunt`, `steelframe`, `merryround`, `drivetrain-ff`, `drivetrain-fr`, `drivetrain-awd`, `ev-single`, `ev-dual`
  (gearhunt는 steps 개념이 없다 — 기본 화면만.)
- 전/후 비교를 위해 작업 전 캡처를 먼저 남긴다(`shots/07-before-*.png`).
- 회전 방향이 바뀌지 않았는지: 수정은 재질뿐이므로 diff로 확인하고, `t=1`/`t=1.5` 2장으로 회전 여부만 본다.
