// 162 물레방아 조속기 1 — 위 수평축이 베벨 기어로 공 조속기를 돌리고, 속도가 빠르면 클러치 핀이 올라가 위 헐거운 기어를,
//  느리면 내려가 아래 헐거운 기어를 붙잡아 아래 수평축을 서로 반대로 돌려 수문(셔틀)을 올리거나 내린다 (판화 162번)
//  설계표 docs/mm507-sheets/162.md · 부품은 kit/k162 + 공용 키트
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { castIron } from '../../models/materials';
import { displayStand, rotArrow, spurGear, tag } from '../kit';
import { wallBearing } from '../kit/gear6';
import { CL162, K162, STUD162, bevelShaft162, frame162, gate162, gov162, looseGear162, setPose162, spin162 } from '../kit/k162';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const DEG = 180 / Math.PI;
const SX = K162.sx;
const ZC = K162.zc;
const R = K162.R;
const PH = Math.PI / 12; // 피니언 이골이 접점에 오는 위상(12이의 반 피치)

export default function buildM162(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());
  g.add(frame162());

  // 도는 한 몸(스핀들·구동 기어·조속기·클러치 고리)
  const spin = spin162();
  spin.position.set(SX, 0, ZC);
  g.add(spin);

  // 헐거운 베벨 기어 둘(돌기 달림)
  const gearUp = looseGear162(true, STUD162.up);
  gearUp.name = 'gearUp';
  gearUp.position.set(SX, K162.yLow + R, ZC);
  const gearLow = looseGear162(false, STUD162.low);
  gearLow.name = 'gearLow';
  gearLow.position.set(SX, K162.yLow - R, ZC);
  g.add(gearUp, gearLow);

  // 위 수평축(구동) + 피니언 — 구동 기어 아래 왼쪽
  const drive = bevelShaft162(-1.3);
  drive.name = 'driveShaft';
  drive.position.set(SX - R, K162.yDrive, ZC);
  g.add(drive);
  // 아래 수평축 + 피니언(두 헐거운 기어 사이) + 수문 피니언
  const lower = bevelShaft162(K162.gateX - 0.07 - (SX - R));
  lower.name = 'lowerShaft';
  lower.position.set(SX - R, K162.yLow, ZC);
  g.add(lower);
  const gatePinion = new THREE.Group();
  gatePinion.name = 'gatePinion';
  gatePinion.position.set(K162.gateX, K162.yLow, ZC);
  g.add(gatePinion);
  // 수문 피니언(16이 × 0.01) — 공용 spurGear, 로컬 Z → +X
  const gp = spurGear(16, 0.01, { width: 0.05 });
  gp.rotation.y = Math.PI / 2;
  gatePinion.add(gp);

  // 수평축 받침(뒤판 벽걸이)
  for (const x of [-0.2, -0.8]) {
    g.add(wallBearing(x, K162.yDrive, ZC, 'x', 0.032));
    g.add(wallBearing(x, K162.yLow, ZC, 'x', 0.032));
  }

  // 수문(셔틀) + 안내
  const gate = gate162();
  g.add(gate);
  // 문판 왼쪽 안내 기둥(뒤판에서) · 랙 뒤 받침판(랙이 그 앞면을 미끄러진다) — 판화에 없는 보충
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.2, 0.5), castIron());
  post.position.set(-1.98, 0.85, -0.05);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.27, 0.448), castIron());
  back.position.set(K162.gateX, 1.065, -0.076);
  g.add(post, back);

  // 회전 화살표 — 스핀들(위에서 반시계), 위 수평축(+X 축 둘레)
  const arrowSpin = rotArrow(0.2, true);
  arrowSpin.rotation.x = -Math.PI / 2;
  arrowSpin.position.set(SX, 1.86, ZC);
  const arrowDrive = rotArrow(0.13, true);
  arrowDrive.rotation.y = Math.PI / 2;
  arrowDrive.position.set(-0.5, K162.yDrive, ZC);
  g.add(arrowSpin, arrowDrive);

  // 이름표 6개
  const tagBall = tag('공', v(0, 0, 0.6));
  const tagClutch = tag('클러치 핀', v(0, 0, 0.6));
  const tagGate = tag('수문(셔틀)', v(0, 0, 0.6));
  g.add(
    tag('구동 축', v(-0.5, 1.78, 0.6)),
    tag('아래 수평축', v(-0.3, 0.62, 0.6)),
    tag('헐거운 베벨 기어', v(1.5, 0.55, 0.6)),
    tagBall,
    tagClutch,
    tagGate
  );

  const pose = (th: number): void => {
    const p = gov162(th);
    setPose162(spin, p);
    gearUp.rotation.y = p.psi;
    gearLow.rotation.y = -p.psi;
    drive.rotation.x = p.phiS + PH;
    lower.rotation.x = p.psi + PH;
    gatePinion.rotation.x = p.psi;
    gate.position.set(K162.gateX, K162.yLow + K162.rpGate * p.psi, ZC);
    tagBall.position.set(SX + p.ballR * Math.cos(p.phiS) + 0.35, p.ballY + 0.22, 0.6);
    tagClutch.position.set(1.4, K162.yLow + p.h, 0.6);
    tagGate.position.set(K162.gateX - 0.385, K162.yLow + K162.rpGate * p.psi + 0.15, 0.6);
  };
  pose(0);

  const stateText = (s: 'up' | 'low' | 'idle'): string =>
    s === 'up' ? '빠름 — 위 기어 물림, 수문 올림' : s === 'low' ? '느림 — 아래 기어 물림, 수문 내림' : '알맞음 — 두 기어 쉼';

  return {
    group: g,
    view: { pos: [0, 1.7, 6.4], target: [0, 1.55, 0] },
    notes: () => {
      const p = gov162(theta);
      return [
        { label: '속도 인자', value: `${p.w.toFixed(2)} (느림 2.5 ~ 빠름 5.5)` },
        { label: '팔 각', value: `${(p.alpha * DEG).toFixed(1)}° (24~55°)` },
        { label: '상태', value: stateText(p.state) },
        { label: '수문 높이', value: `${(K162.rpGate * p.psi).toFixed(2)} (0 ~ ${(K162.rpGate * CL162.H).toFixed(2)})` },
        { label: '설명', value: '두 헐거운 기어는 늘 아래 수평축 피니언과 물려 서로 반대로 돈다 — 핀이 붙잡은 쪽이 스핀들과 함께 돌아 수평축의 방향을 정한다' }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      pose(theta);
    }
  };
}
