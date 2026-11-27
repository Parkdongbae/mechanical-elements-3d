// 235 태핏 팔 래칫 — 팔이 올라갈 때 태핏이 별 이를 밀어 바퀴를 60° 돌리고, 내려올 때는 태핏이 접혀 이를 넘는다 (판화 235번)
//  설계표 docs/mm507-sheets/235.md · 부품·운동식은 kit/k235 + kit/k092(크랭크 원판·연결봉) 조립만 한다
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, shaftZ, tag } from '../kit';
import { K235, click235, crankShaft235, springCurve235, starWheel235, state235, tappet235, tappetArm235 } from '../kit/k235';
import { connectingRod, crankDisc } from '../kit/k092';
import { paint, steel } from '../../models/materials';
import { extrude, shapeFrom } from '../../models/parts/geom';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const ACTIVE = 0x7a4a00;
const D2R = Math.PI / 180;

export default function buildM235(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  const [WX, WY] = K235.W;
  const [AX, AY] = K235.A;
  const [KX, KY] = K235.K;
  const [CX, CY] = K235.Ck;

  g.add(displayStand());

  // 축 넷(고정, 뒤판에서 나옴)
  const axle = shaftZ(WX, WY, 0.09, 0.05);
  axle.name = 'axle';
  g.add(axle);
  g.add(shaftZ(AX, AY, 0, 0.04));
  g.add(crankShaft235(KX, KY));
  const clickPin = shaftZ(CX, CY, 0.045, 0.02);
  clickPin.name = 'clickPin';
  g.add(clickPin);

  const wheel = starWheel235();
  wheel.name = 'wheel';
  wheel.position.set(WX, WY, 0);
  g.add(wheel);

  // 태핏 팔(+ 태핏·스프링은 팔의 자식)
  const arm = tappetArm235();
  arm.name = 'tappetArm';
  arm.position.set(AX, AY, 0);
  g.add(arm);

  const tap = tappet235();
  tap.name = 'tappet';
  tap.position.set(K235.Pt[0], K235.Pt[1], 0);
  arm.add(tap);
  const matTap = tap.userData.mat as THREE.MeshStandardMaterial;

  const springMat = steel();
  const spring = new THREE.Group();
  spring.name = 'spring';
  let tube = new THREE.Mesh(new THREE.TubeGeometry(springCurve235(0), 24, 0.008, 8, false), springMat);
  tube.castShadow = true;
  spring.add(tube);
  const curl = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 8, 24, 1.5 * Math.PI), springMat);
  curl.position.set(0.71, 0.13, 0);
  curl.castShadow = true;
  spring.add(curl);
  arm.add(spring);
  let lastFold = 0;

  const click = click235();
  click.name = 'click';
  click.position.set(CX, CY, 0);
  g.add(click);
  const matClick = click.userData.mat as THREE.MeshStandardMaterial;

  const crank = crankDisc(0.2125, K235.rk, { thick: 0.06, boreR: 0.042, pinR: 0.03, pinTop: 0.1, pinZ: 0.075 });
  crank.name = 'crank';
  crank.position.set(KX, KY, -0.21);
  g.add(crank);

  const link = connectingRod(K235.Lk, { thick: 0.04, holeR: 0.031, eyeR: 0.06, barHalf: 0.025 });
  link.name = 'link';
  g.add(link);

  // 표시: 바퀴 반시계 화살표, 팔 위·아래 화살표
  const arrow = rotArrow(0.25, true);
  arrow.position.set(WX, WY, 0.1);
  g.add(arrow);
  // 납작한 노란 화살표를 팔 판 앞면(z -0.05)에 붙여 팔과 함께 움직인다(팔 로컬 -y = 세계 위쪽)
  const mkCone = (name: string, down: boolean): THREE.Mesh => {
    const shape = shapeFrom([[-0.008, -0.045], [0.008, -0.045], [0.008, 0.005], [0.032, 0.005], [0, 0.05], [-0.032, 0.005], [-0.008, 0.005]]);
    const m = new THREE.Mesh(extrude(shape, 0.008, 0.001, 4), paint(0xffcc00));
    m.name = name;
    m.castShadow = true;
    m.position.set(0.35, 0, -0.046);
    m.rotation.z = down ? 0 : Math.PI;
    arm.add(m);
    return m;
  };
  const upArrow = mkCone('upArrow', false);
  const downArrow = mkCone('downArrow', true);

  // 이름표 6개(자리는 기구 바깥, 지시선은 이름으로)
  g.add(
    leaderTo(tag('래칫 바퀴(6이)', v(-1.45, 3.0, 0.3)), 'wheel'),
    leaderTo(tag('태핏(올라갈 때 이를 밂)', v(-1.2, 0.75, 0.3)), 'tappet'),
    leaderTo(tag('태핏 팔(오른쪽 받침)', v(1.25, 2.3, 0.3)), 'tappetArm'),
    leaderTo(tag('작은 스프링', v(1.55, 0.95, 0.3)), 'spring'),
    leaderTo(tag('멈춤 폴(거꾸로 못 돌게)', v(0.45, 3.0, 0.3)), 'click'),
    leaderTo(tag('크랭크(구동)', v(1.6, 0.48, 0.3)), 'crank')
  );

  const pose = (th: number): void => {
    const s = state235(th);
    wheel.rotation.z = s.wheel;
    arm.rotation.z = s.zeta;
    tap.rotation.z = K235.lt0 - s.fold;
    click.rotation.z = s.clickLam;
    if (Math.abs(s.fold - lastFold) > 1e-5) {
      const old = tube.geometry;
      tube.geometry = new THREE.TubeGeometry(springCurve235(s.fold), 24, 0.008, 8, false);
      old.dispose();
      lastFold = s.fold;
    }
    matTap.emissive.setHex(s.pushing ? ACTIVE : 0x000000);
    matClick.emissive.setHex(0x000000);
    springMat.emissive.setHex(s.fold > 0 ? 0x203060 : 0x000000);
    crank.rotation.z = K235.thF + th;
    link.position.set(s.P[0], s.P[1], -0.135);
    link.rotation.z = Math.atan2(s.E[1] - s.P[1], s.E[0] - s.P[0]);
    upArrow.visible = s.rising;
    downArrow.visible = !s.rising;
  };
  pose(0);

  return {
    group: g,
    view: { pos: [-0.05, 1.65, 6.0], target: [-0.05, 1.6, 0] },
    notes: () => {
      const s = state235(theta);
      return [
        { label: '팔', value: s.rising ? '올라감 → 태핏이 이를 밀어 올림' : s.fold > 0 ? '내려옴 → 태핏이 접혀 이를 넘음' : '내려옴' },
        { label: '바퀴', value: '늘 반시계, 한 번 왕복에 1이(60°)' },
        { label: '태핏 접힘', value: `${(s.fold / D2R).toFixed(1)}°` },
        { label: '멈춤 폴', value: '바퀴가 거꾸로 도는 것을 막음(판화 왼쪽 위)' }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      pose(theta);
    }
  };
}
