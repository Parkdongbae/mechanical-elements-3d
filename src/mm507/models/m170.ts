// 170 교차 팔 조속기 — 두 팔이 스핀들 위에서 가위처럼 엇갈려 꽂히고, 공이 벌어지면 팔 윗부분의 짧은 링크 둘이
//  밸브 막대(위 꼭짓점 T)를 끌어 내린다(슬라이드 없음). 판화 170번.
//  설계표 docs/mm507-sheets/170.md · 부품·식은 kit/k170 — 이 파일은 배치·자세 대입만 한다.
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, tag } from '../kit';
import { K170, drive170, frame170, gov170, setPose170, spin170 } from '../kit/k170';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const DEG = 180 / Math.PI;

export default function buildM170(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());
  g.add(frame170());

  const spin = spin170();
  spin.position.set(0, 0, K170.zc);
  g.add(spin);

  // 구동 피니언 + 수평축(왼쪽에서 크라운에 물림 — 판화의 왼쪽 수평축)
  const drive = drive170();
  drive.position.set(-K170.rm, K170.yp, K170.zc);
  drive.rotation.y = Math.PI;
  g.add(drive);

  const arrowSpin = rotArrow(0.2, true);
  arrowSpin.rotation.x = -Math.PI / 2;
  arrowSpin.position.set(0, 1.4, K170.zc);
  const arrowDrive = rotArrow(0.16, true);
  arrowDrive.rotation.y = -Math.PI / 2;
  arrowDrive.position.set(-0.9, K170.yp, K170.zc);
  g.add(arrowSpin, arrowDrive);

  const tagBall = tag('공', v(0, 0, 0.3));
  const tagRod = tag('밸브 막대', v(0, 0, 0.3));
  const tagArms = tag('엇갈린 팔', v(0.95, 2.0, 0.3));
  const tagArc = tag('곡선 막대', v(-1.25, 2.0, 0.3));
  const tagCrown = tag('크라운 기어', v(1.15, 0.72, 0.3));
  const tagDrive = tag('구동 축', v(-1.45, 1.4, 0.3));
  g.add(tagBall, tagRod, tagArms, tagArc, tagCrown, tagDrive);

  const pose = (th: number): void => {
    const p = gov170(th);
    setPose170(spin, p);
    const pinion = drive.getObjectByName('pinion');
    if (pinion) pinion.rotation.x = p.phiP + K170.pin0;
    tagBall.position.set(-p.ballR * Math.cos(p.psi) - 0.55, p.ballY + 0.25, 0.3);
    tagRod.position.set(0.8, p.ty + 0.12, 0.3);
  };
  pose(0);

  return {
    group: g,
    view: { pos: [0, 1.7, 6.4], target: [0, 1.65, 0] },
    notes: () => {
      const p = gov170(theta);
      return [
        { label: '기관 속도 인자', value: `${p.w.toFixed(2)} (느림 2.5~빠름 5.5)` },
        { label: '팔 각', value: `${(p.alpha * DEG).toFixed(1)}° (24~48°)` },
        { label: '밸브 막대 높이', value: `${p.ty.toFixed(3)} (공이 벌어지면 내려옴)` },
        { label: '설명', value: '두 팔이 엇갈려 있어 공이 벌어지면 팔 윗부분도 벌어지고, 짧은 링크 둘이 밸브 막대를 끌어 내린다' },
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      pose(theta);
    },
  };
}
