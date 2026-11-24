// 126 벨 크랭크 레버 — 풀리 줄을 아래로 당기면 ㄱ자 레버가 돌아 가로 줄을 수평으로 끌어당긴다 (판화 126번)
// 모든 자세는 theta 의 닫힌 식 bell126(theta) 에서 나온다. 줄 두 개는 프레임마다 ropeAround 로 다시 놓는다.
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { Rope, displayStand, pulley, ropeAround, ropeEnd, rotArrow, shaftZ, tag } from '../kit';
import { K126, bell126, bellCrank126, pullSpring126, setSpring126 } from '../kit/k125';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM126(): MovementModel {
  const g = new THREE.Group();
  let theta = K126.theta0;
  const [CX, CY] = K126.C;
  const [PX, PY] = K126.P;
  const [SX, SY] = K126.S;
  const { ZP, ZL } = K126;

  g.add(displayStand());

  // 풀리와 축
  const pl = pulley(K126.r, { width: 0.16, spokes: 0 });
  pl.name = 'pulley';
  pl.position.set(CX, CY, ZP);
  g.add(pl);
  g.add(shaftZ(CX, CY, 0.22, 0.06));

  // 벨 크랭크와 받침점 핀
  const crank = bellCrank126();
  crank.name = 'crank';
  crank.position.set(PX, PY, ZL);
  g.add(crank);
  g.add(shaftZ(PX, PY, 0.075, 0.04));

  // 스프링과 고정 못
  const spring = pullSpring126(0.735);
  spring.name = 'spring';
  spring.position.set(SX, SY, ZP);
  g.add(spring);
  g.add(shaftZ(SX, SY, 0.16, 0.028));

  // 줄 둘과 손잡이
  const rope = new Rope(0.045);
  rope.group.name = 'rope';
  g.add(rope.group);
  const cord = new Rope(0.03);
  cord.group.name = 'cord';
  g.add(cord.group);
  const handle = ropeEnd();
  handle.name = 'handle';
  // 기본 매듭(반지름 0.02)은 줄(0.045)보다 가늘고 줄 끝에서 0.02 떨어져 떠 보인다 →
  // 매듭을 줄 끝(원점)까지 늘이고, 전체를 2.2 배로 키워 줄 굵기와 맞춘다(원점 = 줄 끝은 그대로).
  const knot = handle.children[0];
  if (knot) {
    knot.scale.y = 1.75;
    knot.position.y = -0.035;
  }
  handle.scale.setScalar(2.2);
  g.add(handle);

  // 회전 화살표 둘(지금 도는 방향 것만 보인다)
  const arrCw = rotArrow(0.2, false);
  const arrCcw = rotArrow(0.2, true);
  arrCw.position.set(PX, PY, 0.2);
  arrCcw.position.set(PX, PY, 0.2);
  g.add(arrCw, arrCcw);

  g.add(
    tag('풀리', v(CX, 3.1, 0.3)),
    tag('벨 크랭크 레버', v(0.95, 1.75, 0.3)),
    tag('되돌림 스프링', v(1.3, 1.05, 0.3))
  );
  const tagRope = tag('당기는 줄', v(-1.85, 1.6, 0.3));
  g.add(tagRope);

  let pose = bell126(theta);

  function apply(): void {
    pose = bell126(theta);
    crank.rotation.z = pose.phi;
    pl.rotation.z = pose.pulley;
    handle.position.set(CX - K126.Rr, pose.yL, ZP);
    rope.setPath(
      ropeAround(
        { p: [CX - K126.Rr, pose.yL], w: ZP },
        [{ c: [CX, CY], r: K126.Rr, ccw: false, w: ZP }],
        { p: pose.A, w: ZP },
        { seg: 24 }
      )
    );
    cord.setPath(ropeAround({ p: pose.B, w: ZP }, [], { p: pose.H, w: ZP }));
    spring.rotation.z = pose.springAngle;
    setSpring126(spring, pose.springLen);
    tagRope.position.set(-1.85, pose.yL + 0.15, 0.3);
  }
  apply();

  return {
    group: g,
    view: { pos: [0, 1.75, 6.4], target: [0, 1.65, 0] },
    notes: () => [
      { label: '방향', value: '세로로 당김 → 가로로 끌림 (풀리 180° + 레버 90°)' },
      { label: '팔 길이', value: '가로 팔 0.91 : 세로 팔 0.76 → 이동 1.2 : 1, 힘 1 : 1.2' },
      { label: '당긴 길이', value: (1.706 - pose.yL).toFixed(2) },
      { label: '레버 각', value: ((pose.phi * 180) / Math.PI).toFixed(0) + '°' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
      const w = -Math.cos(theta - K126.theta0) * speed;
      arrCw.visible = w < 0;
      arrCcw.visible = w > 0;
    }
  };
}
