// 099 나선 안내 홈(드릴 이송) — 나선 리브 원판이 돌면 종동 핀이 골을 따라 막대를 위아래로 민다 (판화 99번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, tag } from '../kit';
import { SPIRAL099, feedGuide, spiralDiskAngle, spiralFollower, spiralFollowerRadius, spiralGuideDisk } from '../kit/k098';

const CY = 2.25;
const PHASE = 2.817;

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM099(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  const disk = spiralGuideDisk();
  disk.name = 'disk';
  disk.position.set(0, CY, 0.04);
  g.add(disk);

  g.add(shaftZ(0, CY, 0.14, 0.07));

  const follower = spiralFollower();
  follower.name = 'follower';
  follower.position.set(0, CY - SPIRAL099.rf0, 0.18);
  g.add(follower);

  const guide = feedGuide();
  guide.name = 'guide';
  guide.position.set(0, 0.18, 0.18);
  g.add(guide);

  const arrFwd = rotArrow(0.4, true);
  arrFwd.position.set(0, CY, 0.16);
  const arrBack = rotArrow(0.4, false);
  arrBack.position.set(0, CY, 0.16);
  g.add(arrFwd, arrBack);

  g.add(
    tag('나선 안내 원판(구동)', v(-1.3, 3.1, 0.3)),
    tag('나선 리브', v(1.35, 2.6, 0.3)),
    tag('종동 핀과 이송 막대', v(1.0, 1.0, 0.45)),
    tag('안내 기둥(고정)', v(-0.95, 0.75, 0.3))
  );

  let psi = 0;
  let rf: number = SPIRAL099.rf0;
  let feeding = true;
  const apply = (): void => {
    const te = theta + PHASE;
    psi = spiralDiskAngle(te);
    const m = (2 * te) % (9 * Math.PI);
    feeding = (m + 9 * Math.PI) % (9 * Math.PI) < 4.5 * Math.PI;
    disk.rotation.z = psi;
    rf = spiralFollowerRadius(psi);
    follower.position.y = CY - rf;
    arrFwd.visible = feeding;
    arrBack.visible = !feeding;
  };
  apply();

  return {
    group: g,
    view: { pos: [0.4, 2.0, 6.4], target: [0, 1.75, 0.2] },
    notes: () => [
      { label: '원판 한 바퀴', value: '막대가 0.16 내려감(나선 한 칸)' },
      { label: '지금 상태', value: feeding ? '이송 중(반시계)' : '되돌리는 중(시계)' },
      { label: '막대가 내려간 거리', value: (rf - SPIRAL099.rf0).toFixed(3) },
      { label: '원판이 돈 바퀴 수', value: (psi / (2 * Math.PI)).toFixed(2) }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
