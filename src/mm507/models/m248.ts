// 248 유니언 이음 — 너트 B 를 돌리면 한 바퀴에 0.04 씩 오르내려 턱이 관 A 의 플랜지를 관 C 끝에 눌러 붙인다
// 세로 단면(B·C 는 뒤 반쪽, A 는 겉모양 통째) — 설계표 docs/mm507-sheets/248.md
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, tag } from '../kit';
import { K248, PROFILE_A_LOW248, PROFILE_A_UP248, PROFILE_B248, PROFILE_C248, halfLathe248, state248, threadHalf248 } from '../kit/k248';
import { lathe, mesh } from '../../models/parts/geom';
import { aluminum, brass, glow, paint, steel } from '../../models/materials';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const K = K248;

export default function buildM248(): MovementModel {
  const g = new THREE.Group();
  let t = 0;
  g.add(displayStand());

  // 관 C(고정, 단면) + 수나사
  const pipeC = halfLathe248(PROFILE_C248, 48, steel(), paint(0xc8553d));
  pipeC.name = 'pipeC';
  pipeC.position.set(0, K.Y0, K.ZC);
  const threadC = threadHalf248({ r0: 0.448, depth: K.DEPTH, pitch: K.PITCH, y0: -0.4, y1: -0.008, side: 'ext' }, steel(), paint(0xc8553d));
  threadC.name = 'threadC';
  threadC.position.set(0, K.Y0, K.ZC);
  g.add(pipeC, threadC);

  // 관 A(고정, 통째): 설계표의 한 윤곽을 플랜지 윗면(y 0.12)에서 둘로 나눠 플랜지를 따로 가리킬 수 있게 했다
  const pipeA = new THREE.Group();
  pipeA.name = 'pipeA';
  pipeA.position.set(0, K.Y0, K.ZC);
  const flange = mesh(lathe(PROFILE_A_LOW248, 64), aluminum());
  flange.name = 'flange';
  const pipeUp = mesh(lathe(PROFILE_A_UP248, 64), aluminum());
  pipeUp.name = 'pipeAUp';
  pipeA.add(flange, pipeUp);
  g.add(pipeA);

  // 너트 B(단면): 몸은 돌리지 않고 오르내리기만
  const nut = new THREE.Group();
  nut.name = 'nut';
  nut.add(halfLathe248(PROFILE_B248, 48, brass(), paint(0xe8a33d)));
  const marks = new THREE.Group();
  marks.name = 'nutMarks';
  const markMat = paint(0xf2b619);
  const bars: THREE.Mesh[] = [];
  for (let k = 0; k < 6; k++) {
    const b = mesh(new THREE.BoxGeometry(0.16, 0.012, 0.03), markMat);
    const phi = (k * Math.PI) / 3;
    b.position.set(0.48 * Math.cos(phi), 0.254, -0.48 * Math.sin(phi));
    b.rotation.y = phi;
    marks.add(b);
    bars.push(b);
  }
  nut.add(marks);
  nut.position.set(0, K.Y0, K.ZC);
  g.add(nut);

  // 너트 암나사(세계 고정, 덮는 높이만 다시 만든다)
  const nutThreadHolder = new THREE.Group();
  nutThreadHolder.name = 'nutThread';
  nutThreadHolder.position.set(0, K.Y0, K.ZC);
  g.add(nutThreadHolder);
  const nutThreadBody = brass();
  const nutThreadCut = paint(0xe8a33d);
  let builtLf = -1;
  const rebuildThread = (Lf: number): void => {
    if (Math.abs(Lf - builtLf) <= 0.0005) return;
    builtLf = Lf;
    for (const c of [...nutThreadHolder.children]) {
      nutThreadHolder.remove(c);
      c.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    }
    nutThreadHolder.add(
      threadHalf248({ r0: 0.451, depth: K.DEPTH, pitch: K.PITCH, y0: -0.372 + K.RISE * Lf, y1: -0.008 + K.RISE * Lf, side: 'int', rBase: 0.491 }, nutThreadBody, nutThreadCut)
    );
  };

  // 조임 표시 고리(뒤 반쪽)
  const clampGeo = new THREE.TorusGeometry(0.329, 0.006, 8, 48, Math.PI);
  clampGeo.rotateX(-Math.PI / 2);
  const clampMark = mesh(clampGeo, glow(0xd8362f, 0.9));
  clampMark.name = 'clampMark';
  clampMark.position.set(0, 1.626, K.ZC);
  g.add(clampMark);

  // 회전 화살표: 시계(조임)·반시계(풀림)
  const mkArrow = (ccw: boolean, name: string): THREE.Group => {
    const outer = new THREE.Group();
    outer.name = name;
    const inner = rotArrow(0.4, ccw);
    inner.rotation.x = -Math.PI / 2;
    outer.add(inner);
    outer.rotation.y = ccw ? 0.225 * Math.PI : -0.4555 * Math.PI;
    return outer;
  };
  const arrowCW = mkArrow(false, 'arrowCW');
  const arrowCCW = mkArrow(true, 'arrowCCW');
  g.add(arrowCW, arrowCCW);

  // 이름표 5개(z 0.6)
  const tNut = leaderTo(tag('B 너트', v(1.4, 0, 0.6)), 'nut');
  g.add(
    leaderTo(tag('A 플랜지 관', v(-1.35, 2.4, 0.6)), 'pipeA'),
    leaderTo(tag('C 나사 끝 관', v(-1.45, 0.7, 0.6)), 'pipeC'),
    tNut,
    leaderTo(tag('플랜지(A)', v(1.25, 2.25, 0.6)), 'flange'),
    leaderTo(tag('나사(C 바깥)', v(1.4, 0.8, 0.6)), 'threadC')
  );

  let st = state248(0);
  const apply = (): void => {
    st = state248(t);
    nut.position.y = st.nutY;
    marks.rotation.y = st.alpha;
    // 윗면 표지는 뒤 반쪽 윗면에 있는 것만 보인다(세계 각 φ 가 0.15~π−0.15)
    bars.forEach((b, k) => {
      const w = (((st.alpha + (k * Math.PI) / 3) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      b.visible = w > 0.15 && w < Math.PI - 0.15;
    });
    rebuildThread(st.Lf);
    clampMark.visible = st.Lf < 0.01;
    arrowCW.visible = st.tightening;
    arrowCCW.visible = st.loosening;
    arrowCW.position.set(0, st.nutY + 0.3, K.ZC);
    arrowCCW.position.set(0, st.nutY + 0.3, K.ZC);
    tNut.position.y = st.nutY - 0.05;
  };
  apply();

  return {
    group: g,
    view: { pos: [0.9, 2.5, 5.8], target: [0.0, 1.45, 0.095] },
    notes: () => [
      { label: '너트', value: st.tightening ? '조이는 중(시계)' : st.loosening ? '푸는 중(반시계)' : st.Lf < 0.01 ? '조여 있음' : '풀려 있음' },
      { label: '너트 돈 바퀴 수(풀린 쪽)', value: (K.TURNS * st.Lf).toFixed(2) },
      { label: '턱–플랜지 틈', value: (K.RISE * st.Lf).toFixed(3) },
      { label: '원리', value: '한 바퀴에 피치 0.04 만큼 내려가 턱이 플랜지를 C 끝에 누름' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      apply();
    }
  };
}
