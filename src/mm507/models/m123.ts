// 123 크랭크 대용 이중 랙 — 랙의 왕복이 반쪽 이 부채꼴 둘을 번갈아 돌리고, 부채꼴 축의 평기어가 가운데 기어를 한 방향으로 계속 돌린다 (판화 123번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, spurGear, tag, leaderTo } from '../kit';
import { angles123, catchPiece, doubleRack, guideStud, K123, K123_D, studZ, toothSector } from '../kit/k122';

const TAU = Math.PI * 2;
const [CX, CY] = K123.C;
const XL = CX - K123_D; // 왼쪽 부채꼴 축 x
const XR = CX + K123_D; // 오른쪽 부채꼴 축 x
const ZK = K123.zRack; // 랙·부채꼴 평면
const ZG = K123.zGear; // 평기어·가운데 기어 평면

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM123(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 고정 축: 부채꼴 축 둘(뒤판 보스 → 앞 덮개 z 0.19), 가운데 안내 축(안내 블록·덮개판)
  g.add(studZ(XL, CY, K123.shaftR, 0.19, 0.06));
  g.add(studZ(XR, CY, K123.shaftR, 0.19, 0.06));
  g.add(guideStud(CX, CY));

  // 이 부채꼴 둘 — 로컬 +X 가 이 난 호의 한가운데, 허브 소매가 평기어 앞면까지
  const sectorL = toothSector(K123.zs, K123.m, K123.N, { sleeve: 0.15 });
  sectorL.name = 'sectorL';
  sectorL.position.set(XL, CY, ZK);
  const sectorR = toothSector(K123.zs, K123.m, K123.N, { sleeve: 0.15 });
  sectorR.name = 'sectorR';
  sectorR.position.set(XR, CY, ZK);
  g.add(sectorL, sectorR);

  // 평기어 둘(부채꼴과 한 몸) + 가운데 기어(1:1)
  const spurL = spurGear(K123.gz, K123.m, { width: K123.gearWidth, spokes: 0 });
  spurL.name = 'spurL';
  spurL.position.set(XL, CY, ZG);
  const spurR = spurGear(K123.gz, K123.m, { width: K123.gearWidth, spokes: 0 });
  spurR.name = 'spurR';
  spurR.position.set(XR, CY, ZG);
  const centreGear = spurGear(K123.gz, K123.m, { width: K123.gearWidth, spokes: 0 });
  centreGear.name = 'centreGear';
  centreGear.position.set(CX, CY, ZG);
  g.add(spurL, spurR, centreGear);

  // 걸림쇠 — 가운데 기어 앞면(z −0.10)에 붙은 굽은 조각
  const catchP = catchPiece(ZG + K123.gearWidth / 2, 0.035);
  catchP.name = 'catch';
  catchP.position.set(CX, CY, 0);
  g.add(catchP);

  // 이중 랙(멈춤쇠 2개 포함)
  const rack = doubleRack();
  rack.name = 'rack';
  rack.position.set(CX, CY, ZK);
  g.add(rack);

  // 회전 화살표 — 두 부채꼴 모두 시계
  for (const x of [XL, XR]) {
    const arrow = rotArrow(0.2, false);
    arrow.position.set(x, CY, 0.2);
    g.add(arrow);
  }

  // 이름표 — 기구가 작아(가로 ±0.96) 전시판 모서리에 두면 제 부품과 멀어진다. 기구 바로 옆으로 당기되
  // 랙이 오가는 띠(|x| ≤ 0.13, y 0.21 ~ 3.18)와 부채꼴 이끝원(반지름 0.442)은 비켜 둔다(검증 후 수정)
  g.add(
    tag('이중 랙', v(0.7, 3.0, 0.3)),
    tag('이 부채꼴', v(-0.8, 2.45, 0.3)),
    tag('평기어', v(-1.0, 1.05, 0.3)),
    leaderTo(tag('가운데 기어', v(0.85, 0.85, 0.3)), 'centreGear'),
    leaderTo(tag('멈춤쇠·걸림쇠', v(0.95, 2.6, 0.3)), 'catch')
  );

  const pose = (): void => {
    const A = angles123(theta);
    sectorL.rotation.z = A.sector;
    sectorR.rotation.z = A.sector;
    spurL.rotation.z = A.spurL;
    spurR.rotation.z = A.spurR;
    centreGear.rotation.z = A.centre;
    catchP.rotation.z = A.catchA;
    rack.position.y = CY + A.lift;
  };
  pose();

  const phaseText = (): string => {
    const psi = ((angles123(theta).psi % TAU) + TAU) % TAU;
    const a = K123.a;
    if (psi <= a || psi >= TAU - a) return '내려가는 중(왼쪽 부채꼴이 물림)';
    if (Math.abs(psi - Math.PI) <= a) return '올라가는 중(오른쪽 부채꼴이 물림)';
    return '사점 — 걸림쇠가 멈춤쇠를 받음';
  };

  return {
    group: g,
    view: { pos: [0, 1.75, 6.4], target: [0, 1.7, 0] },
    notes: () => {
      const A = angles123(theta);
      const sign = A.lift >= 0 ? '+' : '−';
      return [
        { label: '랙', value: phaseText() },
        { label: '랙 위치', value: `lift = ${sign}${Math.abs(A.lift).toFixed(2)} (행정 ±0.63)` },
        { label: '가운데 기어', value: `반시계로 계속 ${(Math.max(0, A.psi) / TAU).toFixed(1)} 바퀴(랙 뒤라 화살표 생략)` },
        { label: '부채꼴 이', value: '12개(135°) — 한 바퀴에 반쪽씩 번갈아' }
      ];
    },
    update(dt: number, speed: number): void {
      // 누적 theta 로 모든 자세를 닫힌 식에서 — 역회전·누적 오차 없음
      theta += OMEGA * speed * dt;
      pose();
    }
  };
}
