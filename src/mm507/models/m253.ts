// 253 원심 안전 갈고리 — 광산 승강기 드럼이 빨리 돌면 갈고리가 펴져 스터드에 걸려 드럼을 세운다.
// 설계표 docs/mm507-sheets/253.md · 부품·시간표는 kit/k253
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, tag } from '../kit';
import { D2R, K253, hook253, state253 } from '../kit/k253';
import { coilSpring } from '../kit/gear2';
import { lathe, mesh, rodProfile, tubeProfile } from '../../models/parts/geom';
import { castIron, darkSteel, paint, steel, wood } from '../../models/materials';

const K = K253;
const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const [CX, CY] = K.C;

/** Y축 회전체를 Z축으로 눕혀 z0 에서 시작(프로파일 y → z) */
function zRot(profile: [number, number][], z0: number, material: THREE.Material, name?: string): THREE.Mesh {
  const geo = lathe(profile, 48);
  geo.rotateX(Math.PI / 2);
  const m = mesh(geo, material);
  m.position.z = z0;
  if (name) m.name = name;
  return m;
}

export default function buildM253(): MovementModel {
  const g = new THREE.Group();
  g.add(displayStand());

  // ── 고정부 ──
  const plateShape = new THREE.Shape();
  plateShape.absarc(0, 0, 1.38, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.061, 0, Math.PI * 2, true);
  plateShape.holes.push(hole);
  const plateGeo = new THREE.ExtrudeGeometry(plateShape, { depth: 0.04, bevelEnabled: false, curveSegments: 96 });
  const frameA = mesh(plateGeo, paint(0xd8d2c4));
  frameA.name = 'frameA';
  frameA.position.set(CX, CY, -0.3);
  g.add(frameA);
  const frameRim = zRot(tubeProfile(1.33, 1.38, 0, 0.01, 0.002), -0.26, castIron(), 'frameRim');
  frameRim.position.set(CX, CY, -0.26);
  g.add(frameRim);

  const boss = zRot(tubeProfile(0.061, 0.11, 0, 0.035, 0.003), -0.26, castIron(), 'axleBoss');
  boss.position.set(CX, CY, -0.26);
  g.add(boss);

  for (let j = 0; j < 3; j++) {
    const s = (j * 2 * Math.PI) / 3;
    const stud = zRot(rodProfile(K.STUD_r, 0, 0.115, 0, 0.004), -0.265, darkSteel(), `studD${j}`);
    stud.position.set(CX + K.STUD_R * Math.cos(s), CY + K.STUD_R * Math.sin(s), -0.265);
    g.add(stud);
  }

  const mouth = mesh(new THREE.BoxGeometry(1.0, 0.04, 0.2), paint(0x2b2622));
  mouth.name = 'shaftMouth';
  mouth.position.set(0, 0.2, 0);
  g.add(mouth);

  // ── 밧줄(돌지 않음) ──
  const rope = new THREE.Group();
  rope.name = 'rope';
  const ropeMat = paint(0x6b5a3a);
  const arc = mesh(new THREE.TorusGeometry(0.295, 0.025, 10, 32, Math.PI), ropeMat);
  arc.position.set(CX, CY, 0);
  rope.add(arc);
  const strandGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.55, 16);
  const left = mesh(strandGeo, ropeMat);
  left.position.set(-0.295, 0.975, 0);
  const right = mesh(strandGeo, ropeMat);
  right.position.set(0.295, 0.975, 0);
  rope.add(left, right);
  const bandGeo = new THREE.CylinderGeometry(0.027, 0.027, 0.05, 16);
  const bandMat = paint(0x2a2018);
  const bandsL: THREE.Mesh[] = [];
  const bandsR: THREE.Mesh[] = [];
  for (let k = 0; k < 6; k++) {
    const bl = mesh(bandGeo, bandMat);
    const br = mesh(bandGeo, bandMat);
    bl.position.x = -0.295;
    br.position.x = 0.295;
    rope.add(bl, br);
    bandsL.push(bl);
    bandsR.push(br);
  }
  g.add(rope);

  // ── 드럼(중심 C, rotation.z = φ) ──
  const drum = new THREE.Group();
  drum.name = 'drum';
  drum.position.set(CX, CY, 0);
  g.add(drum);

  drum.add(zRot(rodProfile(0.06, 0, 0.44, 0.003, 0.004), -0.3, steel(), 'axle'));
  drum.add(zRot(rodProfile(0.7, 0, 0.03, 0.003, 0.003), -0.22, steel(), 'flangeB'));
  drum.add(zRot(rodProfile(0.09, 0, 0.08, 0, 0), -0.2, steel(), 'hub'));
  drum.add(zRot(rodProfile(0.27, 0, 0.24, 0, 0), -0.12, wood(), 'barrel'));
  drum.add(zRot(rodProfile(0.33, 0, 0.01, 0.0015, 0.0015), -0.13, castIron(), 'rimFront'));
  drum.add(zRot(rodProfile(0.33, 0, 0.01, 0.0015, 0.0015), 0.12, castIron(), 'rimBack'));

  const yellow = paint(0xf2b619);
  const mk1 = mesh(new THREE.BoxGeometry(0.1, 0.02, 0.004), yellow);
  mk1.position.set(0.62, 0, -0.19);
  mk1.name = 'flangeMark';
  const mk2 = mesh(new THREE.BoxGeometry(0.08, 0.02, 0.004), yellow);
  mk2.position.set(0.3, 0, -0.132);
  mk2.name = 'barrelMark';
  drum.add(mk1, mk2);

  const hooks: THREE.Group[] = [];
  const springs: THREE.Mesh[] = [];
  const posts: [number, number][] = [];
  for (let i = 0; i < 3; i++) {
    const th = (90 + 120 * i) * D2R;
    const px = K.PIN_R * Math.cos(th);
    const py = K.PIN_R * Math.sin(th);
    const place = (obj: THREE.Object3D, x: number, y: number): void => {
      obj.position.x = x;
      obj.position.y = y;
      drum.add(obj);
    };
    // 갈고리 핀 + 머리
    place(zRot(rodProfile(0.02, 0, 0.062, 0, 0.002), -0.21, steel(), `hookPin${i}`), px, py);
    place(zRot(rodProfile(0.03, 0, 0.007, 0.002, 0.002), -0.15, steel(), `hookHead${i}`), px, py);
    // 멈춤 핀(바깥·안)
    const so: [number, number] = [px + Math.cos(th) * 0.13 + Math.sin(th) * 0.045, py + Math.sin(th) * 0.13 - Math.cos(th) * 0.045];
    const th2 = th + K.PSI_IN;
    const si: [number, number] = [px + Math.cos(th2) * 0.13 - Math.sin(th2) * 0.045, py + Math.sin(th2) * 0.13 + Math.cos(th2) * 0.045];
    place(zRot(rodProfile(0.015, 0, 0.058, 0, 0.002), -0.21, darkSteel(), `stopOut${i}`), so[0], so[1]);
    place(zRot(rodProfile(0.015, 0, 0.058, 0, 0.002), -0.21, darkSteel(), `stopIn${i}`), si[0], si[1]);
    // 스프링 기둥
    const pa = th + 150 * D2R;
    const post: [number, number] = [px + 0.22 * Math.cos(pa), py + 0.22 * Math.sin(pa)];
    posts.push(post);
    place(zRot(rodProfile(0.012, 0, 0.085, 0, 0.002), -0.21, steel(), `springPost${i}`), post[0], post[1]);
    // 갈고리
    const h = hook253();
    h.name = `hook${i}`;
    h.position.set(px, py, 0);
    drum.add(h);
    hooks.push(h);
    // 스프링
    const sp = coilSpring(0.01, 0.003, 8);
    sp.name = `spring${i}`;
    drum.add(sp);
    springs.push(sp);
  }

  // 회전 화살표
  const arrCcw = rotArrow(0.4, true);
  const arrCw = rotArrow(0.4, false);
  arrCcw.position.set(CX, CY, 0.18);
  arrCw.position.set(CX, CY, 0.18);
  g.add(arrCcw, arrCw);
  const arrMats: THREE.MeshStandardMaterial[] = [];
  arrCcw.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (m && 'emissiveIntensity' in m) arrMats.push(m);
  });

  g.add(
    leaderTo(tag('A 고정 틀(갱도 벽)', v(1.85, 2.95, 0.4)), 'frameA'),
    leaderTo(tag('B 드럼 플랜지', v(-1.85, 2.45, 0.4)), 'flangeB'),
    leaderTo(tag('D 스터드', v(1.85, 1.75, 0.4)), 'studD0'),
    leaderTo(tag('원심 갈고리', v(-1.85, 3.0, 0.4)), 'hook0'),
    leaderTo(tag('밧줄 드럼', v(-1.85, 1.05, 0.4)), 'barrel'),
    leaderTo(tag('밧줄(갱도로)', v(1.85, 0.55, 0.4)), 'rope')
  );

  let t = 0;
  let st = state253(0);
  const pose = (): void => {
    st = state253(t);
    drum.rotation.z = st.phi;
    for (let i = 0; i < 3; i++) {
      const th = (90 + 120 * i) * D2R;
      const h = hooks[i]!;
      h.rotation.z = th + st.psi;
      const hx = h.position.x + 0.22 * Math.cos(th + st.psi);
      const hy = h.position.y + 0.22 * Math.sin(th + st.psi);
      const [qx, qy] = posts[i]!;
      const dx = hx - qx;
      const dy = hy - qy;
      const sp = springs[i]!;
      sp.position.set(qx, qy, -0.137);
      sp.rotation.z = Math.atan2(dy, dx);
      sp.scale.x = Math.hypot(dx, dy);
    }
    const s = (0.295 * (st.phi - K.PHI0)) % 0.25;
    const ss0 = s < 0 ? s + 0.25 : s;
    for (let k = 0; k < 6; k++) {
      const yl = 1.7 - 0.25 * k - ss0;
      const yr = 0.27 + 0.25 * k + ss0;
      bandsL[k]!.position.y = yl;
      bandsL[k]!.visible = yl - 0.025 >= 0.22 && yl + 0.025 <= 1.75;
      bandsR[k]!.position.y = yr;
      bandsR[k]!.visible = yr - 0.025 >= 0.22 && yr + 0.025 <= 1.75;
    }
    arrCcw.visible = st.omega > 0.001;
    arrCw.visible = st.omega < -0.001;
    const danger = st.omega > 2;
    for (const m of arrMats) m.emissiveIntensity = danger ? 2.4 : 0.85;
  };
  pose();

  const phaseName: Record<string, string> = {
    normal: '정상 하강',
    runaway: '달아남(갈고리 펴지는 중)',
    deployed: '갈고리 펴짐',
    caught: '스터드에 걸려 멈춤',
    rewind: '감아 올려 풂',
    fold: '스프링이 갈고리를 접음',
    restart: '다시 하강'
  };

  return {
    group: g,
    view: { pos: [0, 1.75, 5.8], target: [0, 1.75, 0] },
    notes: () => [
      { label: '단계', value: phaseName[st.phase] ?? '' },
      { label: '드럼 속도', value: st.omega.toFixed(2) + ' rad/s' },
      { label: '갈고리 각', value: (st.psi / D2R).toFixed(0) + '°(100 접힘 · 0 펴짐)' },
      { label: '원리', value: '원심력이 스프링을 이기는 속도(1.6~2.4 rad/s)에서 갈고리가 펴짐' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      pose();
    }
  };
}
