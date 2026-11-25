// 137 팽창 편심(프랑스식) — 크랭크축에 고정된 편심이 갈라진 진동 팔을 흔들고, 팔 아래 끝의 밸브 막대가 세로 왕복 (판화 137번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, STAGE, tag, leaderTo } from '../kit';
import { castIron } from '../../models/materials';
import { mesh } from '../../models/parts/geom';
import { K137, Y_TIP137, eccentric137, forkArm137, rock137, valveRod137 } from '../kit/k137';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const DEG = 180 / Math.PI;
const Y_MIN = K137.OY - Y_TIP137 - K137.rodLen; // 막대끝 최저 y = 0.897
const STROKE = 0.1; // 밸브 막대 행정

export default function buildM137(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 두 축(고정) — 판화에 없는 뒤판 보스 받침은 shaftZ 안에 있다
  const shaft = shaftZ(K137.OX, K137.OY, K137.crankZ1, K137.shaftR);
  shaft.name = 'shaft';
  const pivot = shaftZ(K137.PX, K137.PY, K137.pivotZ1, K137.shaftR);
  pivot.name = 'pivot';
  g.add(shaft, pivot);

  // 편심 원판(축에 고정, 원점 = 축) + 갈라진 진동 팔(원점 = 피벗 눈 축, 굴른·핀은 자식) + 밸브 막대(원점 = 위 눈 중심)
  const eccentric = eccentric137();
  eccentric.name = 'eccentric';
  eccentric.position.set(K137.OX, K137.OY, 0);
  const fork = forkArm137();
  fork.name = 'fork';
  fork.position.set(K137.PX, K137.PY, 0);
  const rod = valveRod137();
  rod.name = 'rod';
  g.add(eccentric, fork, rod);

  // 밸브 막대 안내(판화에 없음 — 막대가 떠 있지 않게, 사용자 지적): 막대 아래쪽을 좌우 두 뺨 사이로 지나게 하고 뒤판에 붙인다.
  // 막대는 팔이 흔들리며 x 로 조금 움직이므로 뺨 사이를 넉넉히(막대 지름 0.064, 틈 0.115) 둔다.
  {
    const iron = castIron();
    const gy = K137.OY - Y_TIP137 - K137.rodLen + 0.2;
    const zc = K137.zRod0 + K137.rodT / 2;
    const box = (w: number, h: number, d: number, x: number, y: number, z: number): THREE.Mesh => {
      const m = mesh(new THREE.BoxGeometry(w, h, d), iron);
      m.position.set(x, y, z);
      return m;
    };
    const guide = new THREE.Group();
    guide.name = 'rodGuide';
    for (const sx of [-1, 1]) guide.add(box(0.025, 0.14, 0.07, K137.OX + sx * 0.07, gy, zc));
    guide.add(box(0.165, 0.14, 0.025, K137.OX, gy, zc - 0.0475)); // 뒤판(두 뺨을 잇는다)
    guide.add(box(0.07, 0.07, zc - 0.06 - STAGE.backZ, K137.OX, gy, (STAGE.backZ + zc - 0.06) / 2)); // 뒤판까지 기둥
    g.add(guide);
  }

  const child = (name: string): THREE.Object3D => {
    const o = fork.getObjectByName(name);
    if (o === undefined) throw new Error(`fork 자식 누락: ${name}`);
    return o;
  };
  const rollTop = child('rollTop');
  const rollBot = child('rollBot');

  // 회전 방향 화살표(반시계 — 크랭크축 너트 앞)
  const arrow = rotArrow(0.2, true);
  arrow.position.set(K137.OX, K137.OY, 0.34);
  g.add(arrow);

  // 이름표 4개 — 밸브 막대 이름표만 막대를 따라간다
  g.add(tag('편심(크랭크축에 고정)', v(-1.6, 2.55, 0.3)));
  g.add(tag('갈라진 진동 팔(오른쪽 눈 축)', v(1.55, 2.5, 0.3)));
  g.add(tag('위 굴른 — 편심 테에 맞물림', v(-1.45, 2.75, 0.3)));
  const tagRod = leaderTo(tag('밸브 막대(팔 아래 끝에 붙음)', v(0, 0, 0.3)), rod);
  g.add(tagRod);

  let A = rock137(0);
  const apply = (): void => {
    A = rock137(theta);
    eccentric.rotation.z = A.phi;
    fork.rotation.z = A.psi;
    // 굴른 굴름: 끝 눈의 오르내림을 반지름으로 나눈 간(위 맞물림, 아래 미끄럼 — 표시 점용)
    rollTop.rotation.z = A.spin;
    rollBot.rotation.z = -(A.tipB[1] - (K137.OY - Y_TIP137)) / K137.rB;
    rod.position.set(A.tipB[0], A.tipB[1], K137.zRod0);
    tagRod.position.set(A.tipB[0] - 0.85, A.tipB[1] - K137.rodLen + 0.12, 0.3);
  };
  apply();

  return {
    group: g,
    view: { pos: [0.2, 1.9, 6.4], target: [-0.1, 1.6, 0.1] },
    notes: () => {
      const degPhi = (((A.phi * DEG) % 360) + 360) % 360;
      const degPsi = A.psi * DEG;
      const pct = (((A.tipB[1] - K137.rodLen - Y_MIN) / STROKE) * 100).toFixed(0);
      return [
        { label: '편심각', value: `${degPhi.toFixed(0)}°` },
        { label: '팔 기울기', value: `${degPsi >= 0 ? '+' : '−'}${Math.abs(degPsi).toFixed(2)}° (최대 2.15°)` },
        { label: '밸브 막대 위치', value: `행정의 ${pct} %` },
        { label: '굴른 접촉', value: '위 굴른이 테에 맞물리고 아래 굴른은 0.008 안의 틈으로 붙어 미끄러진다(두 접촉은 동시에 맞물릴 수 없다)' },
        { label: '구동 회전수', value: `${(A.phi / (2 * Math.PI)).toFixed(2)}` }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
