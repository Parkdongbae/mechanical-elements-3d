// 160 스프링 발판과 띠 — 발판 왕복이 띠를 통해 도르래의 앞뒤 원운동으로 바뀐다(판화 160번)
//  설계표 docs/mm507-sheets/160.md · 부품은 전부 kit/k158(공용) + 공용 키트(배치·treadle160 결과 대입만 한다)
import * as THREE from 'three';
import { castIron, darkSteel } from '../../models/materials';
import { annularSector, extrude, mesh } from '../../models/parts/geom';
import { OMEGA, type MovementModel } from '../types';
import { Belt, displayStand, pulley, rotArrow, shaftZ, tag } from '../kit';
import { setMM } from '../kit/mm';
import { K160, PoleSpring160, bandPath160, bandStaple158, bellStandard158, pivotPin158, treadle160, treadleBar158 } from '../kit/k158';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const DEG = 180 / Math.PI;

// 층(판화·설계표 배치): 발판 평면 0.10, 도르래 가운데 0.13, 띠 윗가닥(스프링 앞면) 0.16, 아랫가닥 0.10
const ZB = 0.10;
const ZD = 0.13;
const ZS = 0.16;
const ZA = 0.10;

// 스프링 물림쇠(고정, 판화에 없는 보충) — k158 springClamp160 의 곧은 물림 판이 호 장대에 파묻혀
//  자동검사(부품 박힘)에 걸린다. 공용 키트를 고치지 않기 위해 이 모델에서 장대 호(반지름 K160.sR)를
//  따라가는 부채꼴 물림 판 두 장 + 뒤 벽 + 조임 볼트로 만든다.
function clampArc160(zc: number): THREE.Group {
  const K = K160;
  const hh = K.sH / 2; // 장대 반두께
  const cl = 0.002; // 장대와의 틈
  const pt = 0.035; // 물림 판 두께
  const back = -0.3; // 뒤판 앞면
  const a0 = (K.sA0 * Math.PI) / 180; // 장대 시작점의 호 각(호 중심 기준)
  const f = (s: number): number => a0 - s / K.sR; // 끝에서 잰 호 길이 s → 각
  const fA = f(-0.005); // 판 범위: 장대 왼 끝 조금 지나서
  const fB = f(K.grip + 0.06); // 물리는 구간 0.3 + 여유
  const zT = zc + K.sD / 2;
  const zMid = (zT + back) / 2;
  const g = new THREE.Group();
  // 안쪽·바깥쪽 물림 판(부채꼴 고리, 장대 면에서 cl 떨어 뜸)
  const plate = (r0: number, r1: number): THREE.Mesh => {
    const p = mesh(extrude(annularSector(r0, r1, fB, fA), zT - back, 0.008), castIron());
    p.position.set(K.sc[0], K.sc[1], zMid);
    return p;
  };
  g.add(plate(K.sR - hh - pt - cl, K.sR - hh - cl), plate(K.sR + hh + cl, K.sR + hh + pt + cl));
  // 뒤 벽 — 장대 뒷면 0.002 뒤부터 뒤판까지
  const ang = (fA + fB) / 2;
  const wall = mesh(new THREE.BoxGeometry(0.42, K.sH + 2 * pt, zc - K.sD / 2 - 0.002 - back), castIron());
  wall.position.set(K.sc[0] + K.sR * Math.cos(ang), K.sc[1] + K.sR * Math.sin(ang), (zc - K.sD / 2 - 0.002 + back) / 2);
  wall.rotation.z = ang - Math.PI / 2;
  g.add(wall);
  // 조임 볼트 머리 둘(바깥 판 밖으로 rad 방향)
  const rb = K.sR + hh + pt + cl + 0.01;
  for (const s of [0.08, 0.27]) {
    const bA = f(s);
    const bolt = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 6), darkSteel());
    bolt.position.set(K.sc[0] + rb * Math.cos(bA), K.sc[1] + rb * Math.sin(bA), zc);
    bolt.rotation.z = bA - Math.PI / 2;
    g.add(bolt);
  }
  setMM(g, { kind: 'clamp' });
  return g;
}

export default function buildM160(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 장대 스프링(나무, 휨) — 그룹이 전시대 좌표 그대로, setBend 로 형상 갱신
  const spring = new PoleSpring160(ZB);
  spring.group.name = 'spring';
  g.add(spring.group);

  // 스프링 물림쇠(고정, 판화에 없는 보충) — 왼쪽 끝을 물리고 뒤판까지
  const clamp = clampArc160(ZB);
  clamp.name = 'clamp';
  g.add(clamp);

  // 도르래(황동, 민 원판·납작 림) — 종동. 표시점이 기본으로 있어 회전이 보인다
  const drum = pulley(K160.r, { flat: true, width: K160.w, spokes: 0, hub: 0.048 });
  drum.name = 'drum';
  drum.position.set(K160.C[0], K160.C[1], ZD);
  g.add(drum);

  // 도르래 축(고정, 판화에 없는 보충) — 뒤판 보스에서 나와 앞 너트까지
  const axle = shaftZ(K160.C[0], K160.C[1], 0.3, 0.045);
  axle.name = 'axle';
  g.add(axle);

  // 발판 막대(강철) — 원점 = 받침 핀 Q, 로컬 +X 로 뻗는다. rotation.z = P.up
  const treadle = treadleBar158(K160.bar, { dir: 1, h: K160.barH, depth: 0.1, holeR: 0.034 });
  treadle.name = 'treadle';
  treadle.position.set(K160.Q[0], K160.Q[1], ZB);
  g.add(treadle);

  // 띠 고리쇠 — 발판의 child 로 막대와 같이 기울어진다. 표식 child bandEye = 띠 끝 자리
  const staple = bandStaple158(K160.barH, K160.up);
  staple.name = 'staple';
  staple.position.set(K160.a, 0, 0);
  treadle.add(staple);

  // 받침 핀(고정) — 발판 허브를 꿰고 앞 머리가 막는다. 뒷 머리는 받침대 뒷면 바로 뒤에서 막는다
  //  (뒤 끝을 받침대에 0.01 박았더니 핀 아래 머리가 구멍 입구에 파묻힘 — 자동검사 박힘)
  const pin = pivotPin158(-0.09, 0.2, 0.032);
  pin.name = 'pin';
  pin.position.set(K160.Q[0], K160.Q[1], 0);
  g.add(pin);

  // 종 모양 받침대(주철, 고정) — 바닥(받침 윗면 0.18) 위, 핀 구멍이 Q 와 같은 축
  const pedestal = bellStandard158(0.38, { topR: 0.16, waist: 0.12, foot: 0.3, bore: 0.034, thick: 0.1, base: [-0.34, 0.34], baseH: 0.09 });
  pedestal.name = 'pedestal';
  pedestal.position.set(K160.Q[0], K160.floor, -0.02);
  g.add(pedestal);

  // 띠(가는 가죽띠, 열린 경로) — 매 프레임 bandPath160 으로 다시 만든다(점 개수 일정)
  const p0 = treadle160(0);
  const belt = new Belt(bandPath160(p0.S, p0.A, ZS, ZA), { style: 'rope', ropeR: K160.rho, closed: false });
  belt.group.name = 'band';
  g.add(belt.group);

  // 회전 방향 화살표 둘(겹쳐 둠) — 밟는 동안 시계만, 스프링이 올리는 동안 반시계만
  const arrowCw = rotArrow(0.5, false);
  const arrowCcw = rotArrow(0.5, true);
  arrowCw.position.set(K160.C[0], K160.C[1], 0.4);
  arrowCcw.position.copy(arrowCw.position);
  arrowCw.visible = false;
  arrowCcw.visible = false;
  g.add(arrowCw, arrowCcw);

  // 이름표 5개 — 발판 끝·고리쇠·띠 셋은 움직이는 부품을 따라간다
  const tagTreadle = tag('발판(구동)', v(0, 0, 0.4));
  const tagStaple = tag('띠 고리쇠', v(0, 0, 0.3));
  const tagBand = tag('띠(가죽)', v(0, 0, 0.3));
  const tagDrum = tag('도르래(종동)', v(1.5, 1.35, 0.3));
  const tagClamp = tag('스프링 물림쇠(고정)', v(-1.4, 1.95, 0.3));
  g.add(tagTreadle, tagStaple, tagBand, tagDrum, tagClamp);

  let prevDrum: number | null = null;

  /** theta 의 닫힌 식으로 전체 자세를 다시 계산(누적 오차·역회전 없음) */
  const pose = (th: number): void => {
    const p = treadle160(th);
    treadle.rotation.z = p.up;
    spring.setBend(p.kappa);
    drum.rotation.z = p.drum;
    belt.setPath(bandPath160(p.S, p.A, ZS, ZA));
    belt.setOffset(-K160.rc * p.drum); // 띠 표시가 도르래 표면과 함께 흐른다
    // 화살표 토글: drum 이 줄면 밟는 중(시계), 늘면 스프링이 올리는 중(반시계)
    if (prevDrum !== null) {
      if (p.drum < prevDrum - 1e-9) {
        arrowCw.visible = true;
        arrowCcw.visible = false;
      } else if (p.drum > prevDrum + 1e-9) {
        arrowCcw.visible = true;
        arrowCw.visible = false;
      }
    }
    prevDrum = p.drum;
    // 따라가는 이름표 셋
    const ex = K160.Q[0] + K160.bar * Math.cos(p.up);
    const ey = K160.Q[1] + K160.bar * Math.sin(p.up);
    tagTreadle.position.set(ex - 0.25, ey + 0.25, 0.4);
    tagStaple.position.set(p.A[0] + 0.32, p.A[1], 0.3);
    tagBand.position.set(p.S[0] + 0.42, (p.S[1] + 2.0) / 2, 0.3);
  };
  pose(0);

  return {
    group: g,
    view: { pos: [0, 1.7, 6.4], target: [0, 1.55, 0] },
    notes: () => {
      const p = treadle160(theta);
      return [
        { label: '발판 기울기', value: `${(p.up * DEG).toFixed(1)}° (−6° ~ +12°)` },
        { label: '도르래가 돌각', value: `${(p.drum * DEG).toFixed(1)}° (최대 80.9°, 밟으면 시계)` },
        { label: '스프링 끝이 내려온 높이', value: `${p.drop.toFixed(2)} (최대 0.52)` },
        { label: '설명', value: '띠가 도르래를 한 바퀴 감아 돌리고, 스프링이 다시 들어 올려 도르래가 앞뒤로 번갈아 돈다' }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      pose(theta);
    }
  };
}
