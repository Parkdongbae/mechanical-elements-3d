// 270 풀리용 마찰 줄이는 받침 전용 키트 — 고정 축 + 풀리 몸통 + 우리(케이지·판·핀·롤러 6)
// 설계표 docs/mm507-sheets/270.md 의 치수·속도식을 그대로 옮겼다. L/R 두 풀리가 같은 함수를 쓴다.
import * as THREE from 'three';
import { brass, darkSteel, paint, steel } from '../../models/materials';
import { extrude, lathe, merge, mesh, rodProfile, tubeProfile, type V2 } from '../../models/parts/geom';
import { setMM } from './mm';

const TAU = Math.PI * 2;

/** 270번 상수 — 배치(CX·CY), 치수(축·롤러·구멍·줄 반지름), 운동비(우리·롤러), 왕복(진폭·주기), 풀리 단면 27점 */
export const K270 = {
  CX: [-0.85, 0.85] as V2,
  CY: 2.05,
  A_SHAFT: 0.15,
  B_ROLL: 0.135,
  B_DRAW: 0.1345,
  R_BORE: 0.42,
  RC: 0.285,
  R_ROPE: 0.615,
  AMP: 0.4,
  PERIOD: 10,
  K_CAGE: 0.736842,
  K_ROLL: 1.555556,
  K_REL: 0.818713,
  /** 풀리 단면 (r, 깊이) 27점 — 반시계. 쓸 때 첫 점을 끝에 덧붙여 닫는다(구멍 벽까지) */
  PULLEY270: [
    [0.42, -0.08], [0.48, -0.08], [0.48, -0.03], [0.54, -0.03], [0.54, -0.07], [0.632, -0.07],
    [0.64, -0.062], [0.64, -0.0273], [0.6279, -0.0347], [0.6139, -0.037], [0.6001, -0.0339],
    [0.5885, -0.0258], [0.5807, -0.0139], [0.578, 0], [0.5807, 0.0139], [0.5885, 0.0258],
    [0.6001, 0.0339], [0.6139, 0.037], [0.6279, 0.0347], [0.64, 0.0273], [0.64, 0.062],
    [0.632, 0.07], [0.54, 0.07], [0.54, 0.03], [0.48, 0.03], [0.48, 0.08], [0.42, 0.08]
  ] as V2[]
};

export interface State270 {
  /** 줄 흐름(+가 손잡이를 당김) */
  s: number;
  /** 풀리 각(반시계 +) */
  phi: number;
  /** 우리(롤러 묶음) 각 = 0.736842·φ */
  cage: number;
  /** 롤러의 우리에 대한 자전 = 0.818713·φ */
  rollerRel: number;
  /** 손잡이 줄끝 y */
  handleY: number;
  /** 추 쪽 줄끝 y */
  weightEndY: number;
  /** ṡ 부호: +1 당김(반시계), −1 놓음, 0 정지 */
  dir: -1 | 0 | 1;
}

/** 270번 운동식(t = 초) — 사인 왕복, 닫힌 식 */
export function state270(t: number): State270 {
  const w = TAU / K270.PERIOD;
  const s = K270.AMP * Math.sin(w * t);
  const phi = s / K270.R_ROPE;
  const c = Math.cos(w * t);
  const dir: State270['dir'] = c > 1e-9 ? 1 : c < -1e-9 ? -1 : 0;
  return { s, phi, cage: K270.K_CAGE * phi, rollerRel: K270.K_REL * phi, handleY: 1.25 - s, weightEndY: 1.25 + s, dir };
}

/** 핀·롤러 6개 각도: 30° + 60°k */
const PIN_ANGLE = [0, 1, 2, 3, 4, 5].map((k) => ((30 + 60 * k) * Math.PI) / 180);

/** 우리판: 원 0.46 − 가운데 구멍 0.155 − 핀 구멍 6(0.02), 두께 0.015 */
function cagePlate270(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, 0.46, 0, TAU, false);
  const bore = new THREE.Path();
  bore.absarc(0, 0, 0.155, 0, TAU, true);
  shape.holes.push(bore);
  for (const a of PIN_ANGLE) {
    const h = new THREE.Path();
    h.absarc(Math.cos(a) * K270.RC, Math.sin(a) * K270.RC, 0.02, 0, TAU, true);
    shape.holes.push(h);
  }
  return extrude(shape, 0.015);
}

/** 한 풀리 세트(원점 = 풀리 중심, 회전축 = z): 고정 축·풀리·우리. 이름 끝에 L/R 이 붙는다 */
export function rollerPulley270(o: { cover: 'solid' | 'glass'; suffix: 'L' | 'R' }): {
  stud: THREE.Group;
  pulley: THREE.Group;
  cage: THREE.Group;
} {
  const S = o.suffix;

  // ── 고정 축(돌지 않음): 몸통 + 뒤 받침 원판(뒤판 앞면에 붙음) + 앞뒤 고리 ──
  const stud = new THREE.Group();
  stud.name = `stud${S}`;
  const shaftGeo = lathe(rodProfile(K270.A_SHAFT, -0.3, 0.2, 0, 0.02), 40);
  shaftGeo.rotateX(Math.PI / 2);
  const shaft = mesh(shaftGeo, steel());
  shaft.name = `stud${S}Body`;
  stud.add(shaft);
  const supGeo = lathe(rodProfile(0.3, -0.3, -0.2), 40);
  supGeo.rotateX(Math.PI / 2);
  const sup = mesh(supGeo, darkSteel());
  sup.name = `stud${S}Plate`;
  stud.add(sup);
  ([[-0.12, -0.1], [0.1, 0.12]] as [number, number][]).forEach(([z0, z1], i) => {
    const g = lathe(tubeProfile(K270.A_SHAFT, 0.17, z0, z1, 0.002), 36);
    g.rotateX(Math.PI / 2);
    const collar = mesh(g, steel());
    collar.name = `stud${S}Collar${i}`;
    stud.add(collar);
  });
  setMM(stud, { kind: 'shaft', axis: 'z', r: K270.A_SHAFT, z0: -0.3, z1: 0.2 });

  // ── 풀리(홈 바닥 0.578, 줄 중심 0.615, 테 0.64) ──
  const pulley = new THREE.Group();
  pulley.name = `pulley${S}`;
  const bodyGeo = lathe([...K270.PULLEY270, K270.PULLEY270[0]!], 64);
  bodyGeo.rotateX(Math.PI / 2);
  const body = mesh(bodyGeo, brass());
  body.name = `pulleyBody${S}`;
  pulley.add(body);
  const mark = mesh(new THREE.BoxGeometry(0.06, 0.014, 0.006), paint(0xf2b619));
  mark.name = `pulley${S}Mark`;
  mark.position.set(0.59, 0, 0.073);
  pulley.add(mark);
  setMM(pulley, {
    kind: 'wheel', fn: 'rollerPulley270', axis: 'z', r: 0.615, width: 0.14, span: [-0.07, 0.07],
    rim: 'groove', groove: 'round', bottom: 0.578, outer: 0.64
  });

  // ── 우리(케이지): 뒤·앞 판 + 핀 6 + 롤러 6 ──
  const cage = new THREE.Group();
  cage.name = `cage${S}`;
  const backMat = darkSteel();
  const frontMat = darkSteel();
  if (o.cover === 'glass') {
    // 판화 오른쪽: 앞판을 뗀 모습 — 투명 앞판으로 롤러를 보인다
    frontMat.transparent = true;
    frontMat.opacity = 0.25;
    frontMat.depthWrite = false;
  }
  const back = mesh(cagePlate270(), backMat);
  back.name = `cageBack${S}`;
  back.position.z = -0.0905;
  const front = mesh(cagePlate270(), frontMat);
  front.name = `cageFront${S}`;
  front.position.z = 0.0905;
  cage.add(back, front);
  for (let k = 0; k < 6; k++) {
    const a = PIN_ANGLE[k]!;
    const px = Math.cos(a) * K270.RC;
    const py = Math.sin(a) * K270.RC;
    // 핀: 몸통 + 앞뒤 머리 원판(우리판 면 ±0.098 과 틈 0.001)
    const pinGeo = merge(
      [
        lathe(rodProfile(0.02, -0.108, 0.108, 0.002, 0.002), 20),
        lathe(rodProfile(0.032, 0.099, 0.108, 0, 0.004), 24),
        lathe(rodProfile(0.032, -0.108, -0.099, 0.004, 0), 24)
      ].map((gg) => {
        gg.rotateX(Math.PI / 2);
        return gg;
      })
    );
    const pin = mesh(pinGeo, steel());
    pin.name = `pin${S}${k}`;
    pin.position.set(px, py, 0);
    cage.add(pin);
    // 롤러: 우리 자식 — 자전각은 모델이 매 프레임 식으로 준다
    const rollerGeo = lathe(tubeProfile(0.022, K270.B_DRAW, -0.078, 0.078, 0.004), 40);
    rollerGeo.rotateX(Math.PI / 2);
    const roller = mesh(rollerGeo, steel());
    roller.name = `roller${S}${k}`;
    roller.position.set(px, py, 0);
    const rmark = mesh(new THREE.BoxGeometry(0.06, 0.012, 0.004), paint(0xf2b619));
    rmark.name = `roller${S}${k}Mark`;
    rmark.position.set(0.07, 0, 0.08);
    roller.add(rmark);
    cage.add(roller);
  }
  setMM(cage, { kind: 'cage', fn: 'rollerPulley270' });

  return { stud, pulley, cage };
}
