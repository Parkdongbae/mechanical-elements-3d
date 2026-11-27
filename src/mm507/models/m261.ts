// 261 복합 운동 추 올리기 — 원판 B 가 돌면 막대 C 가 팔 A 를 G 둘레로 흔들고, 끝의 도르래 E 가 오르내린다.
// 줄 D 는 B 의 드럼에서 E 를 넘어 추 W 로 내려간다. 줄 길이 보존으로 W 높이를 정한다(올라가는 길이 > 내려가는 길이).
// 설계표 docs/mm507-sheets/261.md · 부품·시간표는 kit/k261
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { Rope, displayStand, leaderTo, pulley, ropeAround, shaftZ, tag, weight } from '../kit';
import { K261, armA261, axleB261, crankArm261, drum261, link261, state261 } from '../kit/k261';
import { brass, castIron, darkSteel, paint, wood } from '../../models/materials';
import { lathe, mesh, tubeProfile } from '../../models/parts/geom';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const [OX, OY] = K261.O;
const [GX, GY] = K261.G;
const ZR = K261.ZR;

export default function buildM261(): MovementModel {
  const g = new THREE.Group();
  g.add(displayStand());

  // ── 원판 축(돌지 않는 뒤판 보스 + 도는 축 막대) ──
  const axleB = axleB261();
  axleB.position.set(OX, OY, 0);
  const bossB = axleB.userData.boss as THREE.Mesh;
  axleB.remove(bossB);
  bossB.position.set(OX, OY, 0);

  // ── 원판 B (놋쇠, 노란 표시) ──
  const diskGeo = lathe(tubeProfile(0.041, 0.3, -0.2, -0.14, 0.006), 72);
  diskGeo.rotateX(Math.PI / 2);
  const diskB = mesh(diskGeo, brass());
  diskB.name = 'diskB';
  diskB.position.set(OX, OY, 0);
  const mark = mesh(new THREE.BoxGeometry(0.06, 0.016, 0.006), paint(0xf2b619));
  mark.position.set(-0.22, 0, -0.136);
  diskB.add(mark);

  // ── 드럼·크랭크 팔(핀·와셔·너트 포함) — 모두 원판과 한 몸으로 돈다 ──
  const drum = drum261();
  drum.position.set(OX, OY, 0);
  const crankArm = crankArm261();
  crankArm.position.set(OX, OY, 0);

  // ── 막대 C ──
  const rodC = link261(K261.LC);

  // ── 팔 A + G 받침(칼라는 이름표 대상 pivotG) ──
  const armA = armA261();
  armA.position.set(GX, GY, 0);
  const pivotAxle = shaftZ(GX, GY, 0.126, 0.04);
  pivotAxle.name = 'pivotGAxle';
  const collarGeo = lathe(tubeProfile(0.041, 0.07, -0.2, 0.049, 0.006), 36);
  collarGeo.rotateX(Math.PI / 2);
  const collar = mesh(collarGeo, castIron());
  collar.name = 'pivotG';
  collar.position.set(GX, GY, 0);

  // ── 도르래 E (림 children[0] 이름 pulleyERim) ──
  const pulleyE = pulley(0.24, { width: 0.1, grooved: true, spokes: 4, hub: 0.03 });
  pulleyE.name = 'pulleyE';
  pulleyE.children[0]!.name = 'pulleyERim';

  // ── 줄 D · 추 W ──
  const rope = new Rope(0.018);
  rope.group.name = 'ropeD';
  const weightW = weight(0.24, 0.3);
  weightW.name = 'weightW';

  // ── 눈금자(돌지 않음) — W 의 오르내림 거리를 읽는다 ──
  const ruler = new THREE.Group();
  ruler.name = 'ruler';
  const rulerBar = mesh(new THREE.BoxGeometry(0.06, 1.8, 0.015), wood(0xd9c27a));
  rulerBar.position.set(-0.85, 1.2, -0.2925);
  ruler.add(rulerBar);
  const tickGeo = new THREE.BoxGeometry(0.03, 0.006, 0.003);
  const tickMat = darkSteel();
  for (let i = 0; i <= 18; i++) {
    const tk = mesh(tickGeo, tickMat);
    tk.position.set(-0.85, 0.3 + 0.1 * i, -0.284);
    ruler.add(tk);
  }

  g.add(axleB, bossB, diskB, drum, crankArm, rodC, pivotAxle, collar, armA, pulleyE, rope.group, weightW, ruler);

  // ── 이름표 8개(고정 자리, W 만 W 를 따라 오르내림) ──
  const tagW = tag('추 W', v(-1.35, 0.52, 0.3));
  g.add(
    leaderTo(tag('받침점 G', v(1.8, 2.2, 0.3)), 'pivotG'),
    leaderTo(tag('팔 A', v(0.75, 2.95, 0.3)), 'armA'),
    leaderTo(tag('도르래 E', v(-1.35, 2.85, 0.3)), 'pulleyERim'),
    leaderTo(tag('줄 D', v(-1.3, 2.0, 0.3)), 'ropeDStrand'),
    leaderTo(tagW, 'weightW'),
    leaderTo(tag('원판 B', v(1.2, 0.5, 0.3)), 'diskB'),
    leaderTo(tag('드럼', v(1.15, 1.15, 0.3)), 'drumFlange'),
    leaderTo(tag('팔 C', v(1.1, 1.7, 0.3)), 'rodC')
  );

  let t = 0;
  let st = state261(0);
  let named = false;
  const pose = (): void => {
    st = state261(t);
    axleB.rotation.z = st.theta;
    diskB.rotation.z = st.theta;
    drum.rotation.z = st.theta;
    crankArm.rotation.z = st.theta;
    rodC.position.set(st.P[0], st.P[1], 0);
    rodC.rotation.z = Math.atan2(st.J[1] - st.P[1], st.J[0] - st.P[0]);
    armA.rotation.z = st.psi - Math.PI;
    pulleyE.position.set(st.E[0], st.E[1], ZR);
    pulleyE.rotation.z = st.phiE;
    const xRope = st.E[0] - K261.R_E;
    rope.setPath(
      ropeAround(
        { p: st.T1, w: ZR },
        [{ c: st.E, r: K261.R_E, ccw: true }],
        { p: [xRope, st.yRing], w: ZR },
        { seg: 24 }
      )
    );
    if (!named) {
      rope.group.children[0]!.name = 'ropeDStrand';
      named = true;
    }
    const wy = st.yRing - 0.2124;
    weightW.position.set(xRope, wy, ZR);
    tagW.position.y = wy;
  };
  pose();

  return {
    group: g,
    view: { pos: [0.6, 1.75, 5.8], target: [0.2, 1.65, 0] },
    notes: () => {
      const u = ((t % K261.PERIOD) + K261.PERIOD) % K261.PERIOD;
      const deg = (st.theta * 180) / Math.PI;
      return [
        { label: '단계', value: u < 11 ? '감는 중(0~11 s) / 푸는 중(11~22 s) — 지금 감는 중' : '감는 중(0~11 s) / 푸는 중(11~22 s) — 지금 푸는 중' },
        { label: '원판 B', value: deg.toFixed(0) + '° · ' + (deg / 360).toFixed(2) + ' 바퀴' },
        { label: '추 W 높이', value: (st.yRing - 0.2124).toFixed(3) },
        { label: '원리', value: '팔이 E 를 올리면 W 는 두 배로 오르고, 드럼이 줄을 감아 내려가는 거리가 짧아진다' },
        { label: '모델 메모', value: '드럼을 판화보다 작게(줄 중심 0.08): 판화 크기면 한 바퀴에 추가 1 넘게 올라 판을 벗어난다' }
      ];
    },
    update(dt: number, speed: number): void {
      t += dt * speed;
      pose();
    }
  };
}
