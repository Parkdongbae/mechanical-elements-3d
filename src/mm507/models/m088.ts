// 088 연속 회전을 간헐 회전으로 — 달팽이 캠 A 가 어긋난 중심에서 도는 멈춤쇠 원판 B 를 한 바퀴에 반 바퀴씩 민다 (판화 88번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, tag } from '../kit';
import { D88, K88, eccentricBoss88, snailCam88, state88, stopDisc88, type State88 } from '../kit/k086';
import { STAGE } from '../kit/stand';

const OX = 0;
const OY = 1.65;
const BX = OX + K88.e; // 원판 B 중심(캠 축에서 +x 로 0.08)
const D2R = Math.PI / 180;

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM088(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // 치우친 보스(판화에 없음): 뒤판 앞면에서 z = 0 까지, 원판 B 의 중심에 선다
  const boss = eccentricBoss88(STAGE.backZ, 0, 0.05);
  boss.name = 'eccentricBoss';
  boss.position.set(BX, OY, 0);
  g.add(boss);

  // 캠 축: 보스의 치우친 구멍을 지나 앞으로
  const shaft = shaftZ(OX, OY, 0.2, 0.05);
  shaft.name = 'camShaft';
  // shaftZ 의 뒤판 쪽 베어링 보스(반지름 0.12)는 치우친 보스 안에 묻히므로 뺀다 — 치우친 보스가 축받이 구실을 한다
  const bearing = shaft.children[1];
  if (bearing) shaft.remove(bearing);
  g.add(shaft);

  // 원판 B(멈춤쇠 C·D 는 자식)
  const disc = stopDisc88(0.08, 0.12);
  disc.name = 'discB';
  disc.position.set(BX, OY, 0);
  g.add(disc);

  // 캠 A(구동)
  const cam = snailCam88(0.1);
  cam.name = 'camA';
  cam.position.set(OX, OY, 0.07);
  g.add(cam);

  // 회전 화살표 — 캠·원판 모두 시계
  const arrCam = rotArrow(0.3, false);
  arrCam.position.set(OX, OY, 0.16);
  const arrDisc = rotArrow(0.86, false);
  arrDisc.position.set(BX, OY, 0.01);
  g.add(arrCam, arrDisc);

  // 이름표: 고정 둘 + 부품을 따라가는 셋
  const tagC = tag('멈춤쇠 C', v(0, 0, 0.2));
  const tagD = tag('멈춤쇠 D', v(0, 0, 0.2));
  const tagJaw = tag('턱', v(0, 0, 0.2));
  g.add(tag('캠 A(구동)', v(-1.25, 2.55, 0.15)), tag('원판 B', v(1.35, 2.5, 0.05)), tagC, tagD, tagJaw);

  let st: State88 = state88(0);
  const apply = (): void => {
    st = state88(theta);
    cam.rotation.z = st.cam;
    disc.rotation.z = st.disc;
    // 멈춤쇠 C(로컬 180°)·D(로컬 0°), 반지름 1.04 자리(원판 테 밖 — 멈춤쇠를 가리지 않게)
    const cd = Math.cos(st.disc);
    const sd = Math.sin(st.disc);
    tagC.position.set(BX - 1.04 * cd, OY - 1.04 * sd, 0.2);
    tagD.position.set(BX + 1.04 * cd, OY + 1.04 * sd, 0.2);
    // 턱: 캠 로컬 (−0.42, −0.24) — 턱 안쪽 캠 면(턱·멈춤쇠 맞닿는 곳을 가리지 않게)
    const cc = Math.cos(st.cam);
    const sc = Math.sin(st.cam);
    const lx = -0.42;
    const ly = -0.24;
    tagJaw.position.set(OX + lx * cc - ly * sc, OY + lx * sc + ly * cc, 0.2);
  };
  apply();

  return {
    group: g,
    view: { pos: [0.3, 2.0, 6.4], target: [0, 1.65, 0] },
    notes: () => [
      { label: '상태', value: st.phase === 'drive' ? '밀기(턱이 멈춤쇠를 민다)' : '쉼(캠만 돈다)' },
      { label: '이번 주기 원판 회전', value: `${st.advDeg.toFixed(1)} / 180°` },
      { label: '원판 반 바퀴 수', value: (-st.disc / Math.PI).toFixed(2) },
      {
        label: '설명',
        value: `캠 한 바퀴에 원판은 반 바퀴 — 캠이 ${D88.spanDeg.toFixed(1)}° 도는 동안 돌고 ${(360 - D88.spanDeg).toFixed(1)}° 쉰다. 원판 중심이 캠 축에서 ${K88.e} 어긋나 있어 멈춤쇠가 먼 쪽에서 턱을 벗어난다`
      },
      { label: '캠 각', value: `${((((theta / D2R) % 360) + 360) % 360).toFixed(0)}°` }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
