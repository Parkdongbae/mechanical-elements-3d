// 154 추를 올리는 벨 크랭크 — 원판의 스터드가 벨 크랭크 롤러를 스칠 때만 추가 도르래 너머로 올라간다 (판화 154번)
//  설계표 docs/mm507-sheets/154.md · 부품은 kit/k154(이미 구현) 조립만 한다. 모든 자세는 state154(theta) 의 닫힌 식.
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { Rope, displayStand, pulley, ropeAround, rotArrow, setMM, shaftZ, tag } from '../kit';
import { bellCrank154, cord154, K154, LA_LOW154, PHI0_154, standard154, state154, studdedDisk154, weightBall154 } from '../kit/k154';

const DEG = 180 / Math.PI;
const TAU = Math.PI * 2;

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM154(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 스터드 원판(구동) — 받침 축(0.043) 위에서 돈다. 스터드 0 = 로컬 +X, 시계로 diskRot 이 쌓인다
  const disk = studdedDisk154();
  disk.name = 'disk';
  disk.position.set(K154.D[0], K154.D[1], K154.zPlate);
  g.add(disk);

  // 원판 받침 표준(고정) — 목은 고리 뒷면에서 멈추고 축 너트가 원판 허브를 붙든다
  const standDisk = standard154(0.92, 0.046, 0.20);
  standDisk.name = 'standDisk';
  standDisk.position.set(K154.D[0], 0.18, 0);
  // 연결 기준점: 디스크 허브 중심(원판 판 가운데)의 표준 로컬 자리
  setMM(standDisk, { point: [0, K154.D[1] - 0.18, K154.zPlate] });
  g.add(standDisk);

  // 벨 크랭크 — 받침 핀(0.031) 위에서 흔들린다. 롤러는 자식이라 따로 자전시킨다
  const crank = bellCrank154();
  crank.name = 'crank';
  crank.position.set(K154.P[0], K154.P[1], K154.zCord);
  g.add(crank);
  const roller = crank.getObjectByName('roller');

  // 벨 크랭크 받침 표준(고정)
  const standCrank = standard154(0.75, 0.034, 0.36);
  standCrank.name = 'standCrank';
  standCrank.position.set(K154.P[0], 0.18, 0);
  // 연결 기준점: 크랭크 받침 구멍 중심의 표준 로컬 자리
  setMM(standCrank, { point: [0, K154.P[1] - 0.18, K154.zCord] });
  g.add(standCrank);

  // 도르래(둥근 로프 홈, 민판) + 축(뒤판 보스 — 판화에 없는 보충)
  const pl = pulley(K154.pulleyR, { width: K154.pulleyW, spokes: 0, hub: 0.043 });
  pl.name = 'pulley';
  pl.position.set(K154.C[0], K154.C[1], K154.zCord);
  const pulleyShaft = shaftZ(K154.C[0], K154.C[1], 0.36, 0.04);
  pulleyShaft.name = 'pulleyShaft';
  // 연결 기준점: 도르래 허브 중심의 축 로컬 자리
  setMM(pulleyShaft, { point: [0, 0, K154.zCord] });
  g.add(pl, pulleyShaft);

  // 줄(눈 → 도르래 위 시계 151° → 추 고리) — 양 끝이 움직이므로 프레임마다 다시 짓는다
  const cord = new Rope();
  cord.group.name = 'cord';
  g.add(cord.group);

  // 추 — 원점 = 고리(ballRing). hookY 를 따라간다
  const wt = weightBall154();
  wt.name = 'weight';
  g.add(wt);

  // 회전 화살표(시계) — 스터드 궤도 안쪽, 벨 크랭크 판 뒤라 부품을 가리지 않는다
  const arrow = rotArrow(0.42, false);
  arrow.position.set(K154.D[0], K154.D[1], 0.215);
  g.add(arrow);

  // 이름표 5개 — 벨 크랭크·롤러·추는 움직이는 부품을 따라간다
  g.add(tag('원판(구동)', v(-1.05, 1.98, 0.4)), tag('도르래', v(1.45, 2.78, 0.4)));
  const tagCrank = tag('벨 크랭크', v(0, 0, 0.4));
  const tagRoller = tag('롤러', v(0, 0, 0.4));
  const tagWeight = tag('추', v(0, 0, 0.4));
  g.add(tagCrank, tagRoller, tagWeight);

  /** theta 의 닫힌 식으로 전체 자세를 다시 계산(누적 오차·역회전 없음) */
  const pose = (th: number): void => {
    const A = state154(th);
    disk.rotation.z = A.diskRot;
    crank.rotation.z = A.phi;
    if (roller) roller.rotation.z = A.rollerRoll;
    pl.rotation.z = A.spin;
    wt.position.set(K154.hookX, A.hookY, K154.zCord);
    // 줄: 눈 → 도르래 위(시계) → 고리. cord154 가 접선·감긴 각·고리 높이를 다시 푼다
    const c = cord154(A.eye);
    cord.setPath(
      ropeAround(
        { p: A.eye, w: K154.zCord },
        [{ c: K154.C, r: K154.ropeR, ccw: false, w: K154.zCord }],
        { p: c.hook, w: K154.zCord },
        { seg: 24 }
      )
    );
    // 이름표: 눈 + (0.41, 0.24) / 롤러 끝 + (-0.10, -0.42) / 공 중심 + (0.42, -0.02)
    tagCrank.position.set(A.eye[0] + 0.41, A.eye[1] + 0.24, 0.4);
    tagRoller.position.set(
      K154.P[0] + LA_LOW154 * Math.cos(A.phi) - 0.10,
      K154.P[1] + LA_LOW154 * Math.sin(A.phi) - 0.42,
      0.4
    );
    tagWeight.position.set(K154.hookX + 0.42, A.hookY - K154.drop - 0.02, 0.4);
  };
  pose(0);

  return {
    group: g,
    view: { pos: [0.2, 1.6, 6.4], target: [0, 1.5, 0.1] },
    notes: () => {
      const A = state154(theta);
      return [
        { label: '원판 회전', value: `${(-A.diskRot / TAU).toFixed(2)} 바퀴(시계)` },
        { label: '벨 크랭크 눌림', value: `${((A.phi - PHI0_154) * DEG).toFixed(2)}° (최대 5.2°)` },
        { label: '추', value: `쉼에서 +${A.lift.toFixed(3)} (행정 0.046)` },
        { label: '오르내림', value: '원판 한 바퀴에 3번' },
        { label: '동작', value: A.mode === 'contact' ? '스터드가 지나갈 때 추가 올라간다' : '지나간 뒤 추 무게로 내려온다' }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      pose(theta);
    }
  };
}
