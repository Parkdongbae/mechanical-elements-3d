# glm-5.3_skill — 가벼운 AI 모델로 고품질 3D 학습 웹앱을 만드는 방법

> 대상: glm-5.3-flash처럼 빠르지만 한 번에 큰 설계를 맡기기 어려운 모델과 함께 일하는 사용자.
> 목표: 이 저장소(v2)의 수준 — 실물처럼 보이는 절차 모델, 스튜디오급 렌더링, 정돈된 UI — 을 재현한다.
> 원리: **모델에게 판단을 맡기지 말고 절차와 부품을 준다.** 큰 모델이 스스로 하는 일(설계, 치수 계산, 자기 검증)을
> 이 문서의 규칙·코드 조각·체크리스트가 대신한다.
> 함께 볼 문서: `upgrade_skill.md`(왜 그렇게 하는지), `docs/work-orders/`(실제 지시서 예시).
>
> **이 문서의 한계**: glm-5.3-flash로 직접 실행해 검증한 절차가 아니다. 더 큰 모델로 이 저장소를 만들며 효과가 있었던 방식을,
> 가벼운 모델이 따라 하기 쉽게 잘게 나누고 규칙화한 것이다. 실제로 써 보며 맞지 않는 부분은 고쳐 쓰기 바란다.

---

## 1. 사용자가 지켜야 할 5가지 (가장 중요)

1. **한 번에 하나만 시킨다.** "자전거를 만들어 줘"가 아니라 "자전거 바퀴 1개를 만드는 함수를 써 줘". 한 요청 = 파일 1개, 300줄 이하.
2. **치수를 준다.** 반지름·길이·위치를 숫자로 정해서 준다(3장의 치수표 양식). 가벼운 모델은 치수를 스스로 맞추지 못해 부품이 박히거나 뜬다.
3. **준비된 코드 조각을 붙여 준다.** 5장의 조각(재질·조명·기어·회전체·나선·벨트 경로·크랭크)을 그대로 쓰게 한다. 새로 발명하게 두지 않는다.
4. **매번 캡처를 본다.** 코드가 그럴듯해도 화면이 틀린 경우가 많다. 캡처를 사람이 보고(또는 이미지를 볼 수 있는 모델에게 보여 주고) 6장의 체크리스트로 판정한다.
5. **고칠 때는 한 가지만 지적한다.** "전체적으로 개선해 줘"는 금지. "뒷바퀴가 프레임에 0.05 박혀 있다. `WHEEL_Z`를 0.21로 바꿔라"처럼.

---

## 2. 작업 순서 (이 순서를 바꾸지 않는다)

| 단계 | 할 일 | 끝났는지 확인 |
|---|---|---|
| 1 | 프로젝트 뼈대: Vite + TypeScript(strict) + three | `npm run dev`로 빈 화면 |
| 2 | `materials.ts` (5.1 조각 그대로) | 타입 검사 통과 |
| 3 | `SceneSetup.ts` (5.2 조각 그대로): 환경맵·3점 조명·바닥·OrbitControls | 회색 구 하나를 놓으면 금속 하이라이트와 그림자가 보임 |
| 4 | 미리보기 페이지 + 캡처 스크립트 (5.9) | `node scripts/shot.mjs ...`가 PNG를 만듦 |
| 5 | 부품 헬퍼: 회전체·인벌류트 기어·나선 (5.3~5.5) | 부품 1개씩 캡처 |
| 6 | 기계 1개를 **부분별로**: 받침 → 몸체 → 축·바퀴 → 미션 부품 → 움직임 | 부분마다 캡처 |
| 7 | UI: 디자인 토큰 → 홈 → 상세 화면 (7장) | 밝음/다크, 390px 캡처 |
| 8 | 자동 흐름 테스트(정답 순서로 끝까지) | 콘솔 에러 0 |

기계가 여러 개면 6단계를 기계마다 반복한다. **한 기계가 끝나기 전에 다음 기계를 시작하지 않는다.**

---

## 3. 요청하는 법 — 템플릿

### 3.1 기계 설계표(사용자가 먼저 채운다)

모델에게 코드를 시키기 전에 이 표를 채운다. 채우기 어려우면 모델에게 "코드 말고 표만" 먼저 받아서 사람이 고친다.

```
기계: 러닝머신
좌표: 바닥 y=0, 앞 = +X, 폭 방향 = Z. 단위 1 ≈ 0.35m
전체 크기: 길이 3.2 (x -1.6~1.6), 폭 1.2, 높이 2.4
부품과 치수:
  - 데크 프레임: 상자 3.0 × 0.12 × 1.1, 중심 (0, 0.30, 0)
  - 앞 롤러: 반지름 0.09, 길이 1.0, 축 방향 Z, 중심 (1.35, 0.36, 0)
  - 뒤 롤러: 반지름 0.09, 길이 1.0, 중심 (-1.35, 0.36, 0)
  - 벨트: 두 롤러를 감는 띠, 두께 0.015, 폭 0.95
  - 모터: 반지름 0.14, 길이 0.4, 중심 (1.35, 0.14, 0.75)
  ...
미션 부품: ① 볼 베어링 — 앞 롤러 +Z 축 끝 (1.35, 0.36, 0.55)  ② 구동 벨트 — 모터 풀리(r 0.12)와 롤러 풀리(r 0.12)
움직임: 롤러 60rpm → 벨트 속도 = 2π·0.09·60/60. 윗면이 -X로 이동.
표시 수치: 모터 회전수, 벨트 속도, 풀리 비율
재질: 프레임 castIron, 롤러 steel, 벨트 rubber, 모터 aluminum(파랑 틴트), 커버 ghost
```

### 3.2 코드 요청 프롬프트

```
[역할] Three.js 0.170 + TypeScript(strict)로 절차 모델을 만드는 개발자.
[할 일] 아래 설계표의 "데크 프레임과 롤러 2개"만 만드는 함수 buildDeck(): THREE.Group 을 작성한다.
[규칙]
- 재질은 materials.ts의 함수만 쓴다(직접 new MeshStandardMaterial 금지).
- 치수는 파일 맨 위 상수로 선언하고, 위치는 그 상수로 계산한다. 숫자를 본문에 직접 쓰지 않는다.
- 원기둥 세그먼트: 반지름 0.1 이상은 40, 그 미만은 24.
- 모든 메시에 castShadow = true.
- 회전체는 아래 lathe 헬퍼를 쓴다(붙여 넣은 코드).
- 설명 없이 코드만 출력한다. 250줄 이하.
[설계표] (3.1 붙여 넣기)
[쓸 수 있는 코드] (5장의 필요한 조각 붙여 넣기)
```

### 3.3 수정 요청 프롬프트

```
[현재 코드] (해당 함수만)
[문제 1개] 캡처에서 앞 롤러가 프레임 윗면보다 0.03 낮아 벨트가 프레임을 관통한다.
[고칠 것] ROLLER_Y를 DECK_TOP + ROLLER_R 로 계산하도록 바꾼다. 다른 부분은 건드리지 않는다.
[출력] 바뀐 줄만.
```

---

## 4. 반드시 지킬 규칙 (프롬프트에 매번 넣는다)

**모델링**
- 치수는 상수, 위치는 계산. 눈대중 숫자 금지.
- 모든 부품은 무언가에 붙어 있다(브래킷·축·볼트). 공중에 뜬 부품 금지.
- 모서리에 모따기: 회전체는 프로파일에 45° 선분, 판은 `bevelEnabled`.
- 원기둥 세그먼트 24~48. 육안으로 각이 보이면 안 된다.
- 반복 부품(볼트, 스포크, 체인 링크)은 `InstancedMesh`.
- 내부가 핵심이면 하우징은 `ghost()`(반투명) 또는 반쪽 단면.
- 강조색은 학습 대상 부품에만.

**움직임**
- 맞물린 기어: 회전비 = 잇수비, 방향 반대.
- 같이 도는 축과 바퀴는 같은 방향. 차가 앞으로 가는 방향으로 통일.
- 벨트·체인은 풀리 바깥을 감는다.
- 막대(커넥팅 로드, 링크)의 길이는 변하지 않는다 — 5.7, 5.8의 식을 쓴다.

**코드**
- TypeScript strict, `any` 금지, 새 라이브러리 금지(three만).
- 한 파일 300줄 이하. 넘으면 나눈다.
- 미션 로직(단계·정답·저장)과 모델 코드를 섞지 않는다.

**하지 말 것**
- 토러스를 쌓아 나사·스프링을 흉내 내기 → 5.5의 나선을 쓴다.
- 사다리꼴 톱니 → 5.4의 인벌류트를 쓴다.
- 환경맵 없이 `metalness`만 올리기 → 금속이 검게 나온다.
- "전체 다시 작성" 요청 → 잘 되던 부분까지 망가진다.

---

## 5. 그대로 쓰는 코드 조각

> 아래 조각은 이 저장소에서 쓰는 방식의 축약본이다. 5.1·5.2는 동작 중인 파일을 줄인 것이고(축약본 그대로 화면에 띄워 보지는 않았다),
> 5.4 인벌류트·5.6 벨트 경로·5.7 크랭크 식은 수치로 확인했다(외곽선 자기 교차 없음, 벨트 접선 직교, 로드 길이 오차 0). 전체 구현은 `src/models/materials.ts`, `src/scene/SceneSetup.ts`,
> `src/models/parts/geom.ts`, `src/models/parts/gears.ts`에 있다. 가벼운 모델에게는 저장소 파일을 통째로 주기보다
> 필요한 조각만 붙여 준다.

### 5.1 재질 라이브러리 (`materials.ts`)

```ts
import * as THREE from 'three';

function noiseTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  for (let y = 0; y < 256; y++) {            // 가로 헤어라인
    const v = 215 + Math.random() * 40;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(0, y, 256, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  return t;
}
let grain: THREE.CanvasTexture | null = null;

function metal(color: number, roughness: number, metalness = 1): THREE.MeshStandardMaterial {
  grain ??= noiseTexture();
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, roughnessMap: grain, bumpMap: grain, bumpScale: 0.25 });
}

export const steel = (color = 0xc3ccd6) => metal(color, 0.34);
export const darkSteel = (color = 0x58626d) => metal(color, 0.42);
export const chrome = () => new THREE.MeshStandardMaterial({ color: 0xf2f5f8, roughness: 0.08, metalness: 1 });
export const castIron = (color = 0x3a4047) => metal(color, 0.72, 0.75);
export const aluminum = (color = 0xd9dee4) => metal(color, 0.45, 0.95);
export const brass = () => metal(0xd4a94a, 0.3);
export const rubber = () => new THREE.MeshStandardMaterial({ color: 0x1b1d21, roughness: 0.88, metalness: 0 });
export const plastic = (color = 0x23262b) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0 });
export const paint = (color = 0xd8362f) =>
  new THREE.MeshPhysicalMaterial({ color, roughness: 0.42, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.12 });
export const ghost = (color = 0x9fb4c8, opacity = 0.35) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.5, transparent: true, opacity, depthWrite: false });
export const glow = (color: number, intensity = 1) =>
  new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4 });
```

### 5.2 씬 — 환경맵과 조명 (이것이 "금속처럼 보이는가"를 결정한다)

```ts
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export function setupScene(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdde5ee);
  scene.fog = new THREE.Fog(0xdde5ee, 16, 44);

  // 환경맵: 어두운 방 + 밝은 패널들 → 금속에 하이라이트 띠
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.SphereGeometry(60), new THREE.MeshBasicMaterial({ color: 0x70798a, side: THREE.BackSide })));
  const panel = (w: number, h: number, i: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(i, i, i), side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  panel(30, 20, 4.2, -20, 26, 16);   // 키 소프트박스
  panel(18, 12, 2.0, 26, 12, -10);   // 필
  panel(40, 3, 5.5, 0, 30, -22);     // 위 스트립 — 윤곽 하이라이트
  panel(4, 26, 3.0, 34, 8, 14);      // 옆 스트립
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(env, 0.03).texture;
  scene.environmentIntensity = 0.7;
  pmrem.dispose();

  // 3점 조명 — 키가 강하고 주변광은 약해야 그림자가 산다
  scene.add(new THREE.HemisphereLight(0xeaf2ff, 0x97a3b0, 0.42));
  const key = new THREE.DirectionalLight(0xfff3e2, 3.1);
  key.position.set(5.5, 10, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 30 });
  key.shadow.bias = -0.0002;
  key.shadow.normalBias = 0.02;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xdfeaff, 1.1);
  rim.position.set(-3, 6, -8);
  scene.add(rim);

  const ground = new THREE.Mesh(new THREE.CircleGeometry(40, 72), new THREE.MeshStandardMaterial({ color: 0xdfe6ee, roughness: 0.82 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 120);
  camera.position.set(4.4, 3.4, 6.8);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 1, 0);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.49;
  return { renderer, scene, camera, controls };
}
```

앰비언트 오클루전 후처리(GTAOPass)는 품질을 한 단계 더 올리지만 함정이 있다. 가벼운 모델에게 맡기지 말고
이 저장소의 `SceneSetup.ts`에서 `setupComposer`와 `overrideVisibility` 부분을 **그대로 복사**한다
(법선 패스 동안 `scene.background = null`, 스프라이트·투명 재질 숨김이 빠지면 검은 사각형이 생긴다).

### 5.3 회전체 — 모따기가 들어간 축/풀리/허브

```ts
/** 프로파일 [반지름, 축 방향 위치]를 Y축으로 돌린다. 모따기는 작은 선분을 넣어 표현 */
export function lathe(profile: [number, number][], segs = 48): THREE.BufferGeometry {
  const pts = profile.map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(pts, segs);
  geo.computeVertexNormals();
  return geo;
}

// 예: 반지름 0.1, 길이 0.6, 양끝 0.012 모따기한 축
const R = 0.1, L = 0.6, C = 0.012;
const shaft = lathe([[0, -L / 2], [R - C, -L / 2], [R, -L / 2 + C], [R, L / 2 - C], [R - C, L / 2], [0, L / 2]]);
```

### 5.4 인벌류트 기어 외곽선

```ts
/** 잇수 z, 피치 반지름 rp 의 기어 외곽 점열(XY 평면). 압력각 20° */
export function involuteOutline(z: number, rp: number, phase = 0): [number, number][] {
  const m = (2 * rp) / z;                 // 모듈
  const ra = rp + m;                      // 이끝원
  const rf = rp - 1.25 * m;               // 이뿌리원
  const rb = rp * Math.cos((20 * Math.PI) / 180); // 기초원
  const inv = (r: number) => { const a = Math.acos(Math.min(1, rb / r)); return Math.tan(a) - a; };
  const half = Math.PI / (2 * z) + inv(rp); // 피치원에서 이 두께의 절반각 + 인벌류트 보정
  const pts: [number, number][] = [];
  const N = 6;
  for (let i = 0; i < z; i++) {
    const c = phase + (i * 2 * Math.PI) / z; // 이 중심 각도
    const side = (sign: number) => {
      const out: [number, number][] = [];
      for (let k = 0; k <= N; k++) {
        const r = Math.max(rb, rf) + ((ra - Math.max(rb, rf)) * k) / N;
        const a = c + sign * (half - inv(r));
        out.push([r * Math.cos(a), r * Math.sin(a)]);
      }
      return out;
    };
    const right = side(-1);                // 이뿌리 → 이끝
    const left = side(1).reverse();        // 이끝 → 이뿌리
    pts.push([rf * Math.cos(c - half - 0.02), rf * Math.sin(c - half - 0.02)], ...right, ...left,
             [rf * Math.cos(c + half + 0.02), rf * Math.sin(c + half + 0.02)]);
  }
  return pts;
}

// 사용: Shape로 만들어 구멍을 뚫고 압출
const shape = new THREE.Shape(involuteOutline(20, 0.4).map(([x, y]) => new THREE.Vector2(x, y)));
const hole = new THREE.Path(); hole.absarc(0, 0, 0.07, 0, Math.PI * 2, true); shape.holes.push(hole);
const gear = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 1 });
```

맞물림 규칙(프롬프트에 그대로 넣는다):
- 두 기어는 같은 모듈 → `rp1 / z1 = rp2 / z2`, 중심거리 = `rp1 + rp2`
- 회전: `θ2 = −θ1 · z1 / z2`
- 위상: 기어 1의 이가 접점을 향하면 기어 2는 이골이 접점을 향하게 `phase2 = π + π / z2`(접점 방향 기준)

### 5.5 나선 — 스프링·나사산

```ts
/** 반지름 R, 피치 p, 감긴 수 turns 의 나선 중심선 */
function helixCurve(R: number, p: number, turns: number): THREE.CatmullRomCurve3 {
  const pts: THREE.Vector3[] = [];
  const n = Math.ceil(turns * 24);
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * turns * Math.PI * 2;
    pts.push(new THREE.Vector3(R * Math.cos(a), (a / (Math.PI * 2)) * p, R * Math.sin(a)));
  }
  return new THREE.CatmullRomCurve3(pts);
}
// 코일 스프링: 선 지름 0.03
const spring = new THREE.TubeGeometry(helixCurve(0.2, 0.09, 7), 7 * 32, 0.015, 10);
// 늘고 주는 스프링은 매 프레임 지오메트리를 다시 만들지 말고 mesh.scale.y 를 길이 비로 바꾼다.
```

나사산처럼 **솔리드로 보여야 하는 나선**은 삼각형 단면을 나선을 따라 스윕해야 한다. 이건 가벼운 모델이 자주 틀리므로
저장소의 `threadedRod`(`src/models/parts/geom.ts`)를 복사해 쓴다.

### 5.6 벨트 경로 — 두 풀리를 감는 띠

```ts
/** 중심 c1, c2(2D), 반지름 r1, r2 를 감는 닫힌 경로의 점열. 벨트는 바깥을 감는다 */
function beltPath(c1: [number, number], r1: number, c2: [number, number], r2: number, n = 48): [number, number][] {
  const dx = c2[0] - c1[0], dy = c2[1] - c1[1];
  const d = Math.hypot(dx, dy), base = Math.atan2(dy, dx);
  const off = Math.acos((r1 - r2) / d);          // 접점까지의 각
  const arc = (c: [number, number], r: number, a0: number, a1: number) =>
    Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)] as [number, number]; });
  // 풀리1은 뒤쪽(접점 사이의 큰 호), 풀리2는 앞쪽을 감는다
  return [...arc(c1, r1, base + off, base + 2 * Math.PI - off), ...arc(c2, r2, base - off, base + off)];
}
// 벨트가 흐르는 모습: 경로를 따라 놓은 표시(마커)의 위치를 belt속도·dt 만큼 호장거리로 전진시킨다.
```

### 5.7 크랭크-슬라이더 (피스톤, 재봉틀 바늘)

```ts
// 크랭크 반지름 R, 커넥팅 로드 길이 L, 크랭크각 th (0 = 상사점)
const pistonY = (th: number) => R * Math.cos(th) + Math.sqrt(L * L - (R * Math.sin(th)) ** 2);
// 로드의 기울기: 크랭크 핀 (R sin th, R cos th) 과 피스톤 핀 (0, pistonY) 를 잇는 방향으로 회전시킨다.
const rodAngle = (th: number) => Math.atan2(R * Math.sin(th), pistonY(th) - R * Math.cos(th));
```

### 5.8 미끄럼 없는 구름과 회전수

```ts
// 바퀴가 x 만큼 이동하면 회전각 = x / 반지름 (진행 방향으로 굴러감)
wheel.rotation.z = -x / WHEEL_R;
// 맞닿아 도는 두 바퀴(마찰차): 접점 속도가 같다 → ω2 = −ω1 · r1 / r2
// rpm → 각속도: ω = rpm · 2π / 60   |   선속도 v = ω · r
```

### 5.9 미리보기와 캡처

미리보기 페이지는 쿼리로 상태를 정한다: `?machine=id&steps=n&t=초&cam=x,y,z,tx,ty,tz&theme=dark`.
캡처는 playwright + 시스템 Chrome:

```js
// scripts/shot.mjs  사용: node scripts/shot.mjs "preview.html?machine=bike&steps=all&t=1" shots/a.png 4000
import { chromium } from 'playwright';
const [, , target, out = 'shots/out.png', wait = '3000'] = process.argv;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:5173/' + target);
await page.waitForTimeout(Number(wait));
await page.screenshot({ path: out });
await browser.close();
console.log('saved', out, errors.length ? 'ERRORS:\n' + errors.join('\n') : '');
```

---

## 6. 캡처 판정 체크리스트

캡처를 볼 때마다 이 순서로 본다. 하나라도 "아니오"면 그 항목 **하나만** 고치게 한다.

**형태**
- [ ] 1초 안에 무슨 기계인지 알겠는가
- [ ] 공중에 뜬 부품이 없는가
- [ ] 서로 박혀 있는 부품이 없는가
- [ ] 원기둥에 각이 보이지 않는가
- [ ] 비율이 실물과 비슷한가(바퀴가 너무 작다, 축이 너무 굵다 등)

**재질·빛**
- [ ] 금속에 밝은 띠(하이라이트)가 보이는가
- [ ] 바닥에 그림자가 또렷한가
- [ ] 색이 3~4가지 안에서 정돈돼 있는가

**미션**
- [ ] 처음 상태에서 빈 자리(슬롯)가 눈에 띄는가
- [ ] 부품을 장착한 뒤 제자리에 붙어 있는가(이중 이동 없음)

**움직임** — 시점을 달리한 캡처 2장(t=1, t=1.6)을 비교
- [ ] 돌아야 할 것이 돌았는가(표시선·스포크 위치가 달라졌는가)
- [ ] 맞물린 것이 반대로, 같이 도는 것이 같은 방향으로 도는가
- [ ] 벨트·체인이 풀리 바깥을 감고 있는가
- [ ] 막대가 늘어나거나 떨어지지 않는가

**UI** — 1280폭, 390폭, 다크
- [ ] 글자가 잘리거나 겹치지 않는가
- [ ] 패널이 3D의 중요한 부분을 가리지 않는가

---

## 7. UI를 시킬 때

1. **디자인 토큰을 먼저 고정한다.** 색·반지름·그림자를 CSS 변수로 정하고(`tokens.css`를 그대로 복사), "이 변수만 써라"고 지시한다. 가벼운 모델은 화면마다 색을 새로 만든다.
2. **화면 하나 = 요청 하나.** 홈, 상세 상단, 하단 독, 설정 패널을 따로 시킨다.
3. **구조를 글로 준다.**
   ```
   홈 화면: 위에서부터 [로고·제목 | 테마·설정 버튼] → [소개 문장·시작 버튼 | 진행도 3줄] → [묶음 제목 + 카드 그리드(카드: 썸네일 16:10, 이름, 한 줄 소개, 분류 색 점)]
   카드 그리드: repeat(auto-fill, minmax(200px, 1fr)), 간격 14px. 820px 미만은 2열.
   ```
4. 호버로만 열리는 메뉴 금지, 버튼 높이 44px 이상, 정답을 고르면 선택 패널을 바로 닫는다.
5. 밝음/다크는 `<html data-theme>`와 변수 재정의로만.

---

## 8. 가벼운 모델이 자주 내는 실수와 대처

| 실수 | 알아보는 법 | 대처 |
|---|---|---|
| 없는 three API를 지어낸다 | 타입 검사 에러 | `npx tsc --noEmit` 결과를 그대로 붙여 "이 에러만 고쳐라" |
| 좌표축을 섞는다(Y-up과 Z-up) | 부품이 누워 있거나 엉뚱한 곳 | 설계표 첫 줄에 축 규약을 쓰고 매 요청에 반복 |
| 지오메트리를 돌린 뒤 위치를 또 더한다 | 부품이 두 배 거리에 | "position은 한 번만 설정" 규칙, 캡처로 확인 |
| 긴 파일을 다시 쓰다 앞부분을 잊는다 | 잘 되던 기능이 사라짐 | 파일을 작게, 수정은 "바뀐 줄만" |
| 재질을 직접 만든다 | 화면 질감이 제각각 | `MeshStandardMaterial` 검색해 0건인지 확인 |
| 회전 방향을 대충 정한다 | 축과 바퀴가 반대로 돎 | 6장 움직임 항목, 부호 규칙을 프롬프트에 명시 |
| 수치를 지어낸다(역사·제원) | 확인 불가 | "확실하지 않으면 쓰지 말 것", 사람이 검토 |
| "완료했습니다"라고만 한다 | — | 캡처 없이는 완료로 치지 않는다 |

---

## 9. 더 큰 모델을 잠깐 쓸 수 있다면

비용 대비 효과가 큰 순서:
1. **설계표 작성과 치수 계산**(3.1) — 여기가 틀리면 뒤가 전부 틀린다.
2. **기반 파일**(재질·씬·후처리·기어·나선 헬퍼) — 한 번 만들면 계속 쓴다.
3. **캡처 비평** — 이미지를 보고 "무엇이 어색한가"를 짚는 일.
4. 기구학이 복잡한 기계(4절 링크, 캠, 변속기).

반복적인 부품 제작, UI 화면, 문구, 데이터 입력은 가벼운 모델로 충분하다.

---

## 10. 최소 성공 경로 (처음 해 보는 사람용)

1. 이 저장소를 복제해 `npm install && npm run dev`.
2. `src/machines/CamAutomata.ts`를 열어 구조를 본다(치수 상수 → 부품 함수 → 단계 설치 → 시뮬레이션).
3. 3.1 양식으로 새 기계의 설계표를 쓴다.
4. 스텁 파일을 만들고 `src/data/machines.ts`에 정의를 추가한다(다른 항목을 복사).
5. 3.2 프롬프트로 부분별 함수를 하나씩 받아 붙이고, 그때마다 `node scripts/shot.mjs "preview.html?machine=<id>&steps=0" shots/x.png`로 확인한다.
6. 움직임을 넣고 `steps=all&t=1`, `t=1.6` 두 장을 비교한다.
7. `node scripts/ui-flow.mjs <id> light`로 실제 앱에서 끝까지 진행되는지 확인한다.
8. `node scripts/smoke.mjs`가 ALL PASS면 커밋한다.
