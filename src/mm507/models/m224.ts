// 224 지름이 변하는 풀리 — 피니언 d 를 왕복으로 돌리면 바퀴 c 의 나선 홈이 스터드를 밀어 팔 6개와 테 조각이 함께 바깥·안으로 미끄러진다.
// 설계표 docs/mm507-sheets/224.md
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, spurGear, tag } from '../kit';
import { K224, RIM_OFFSET224, arm224, slottedWheel224, spider224, state224 } from '../kit/k224';
import { darkSteel, paint, steel } from '../../models/materials';
import { hexPrism, lathe, mesh } from '../../models/parts/geom';

const K = K224;
const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const [OX, OY] = K.O;
const DEG = 180 / Math.PI;
const TAG_Z = 0.3;

/** z 축 원기둥(중심 (x, y), z0 ~ z1) */
function cylZ(r: number, z0: number, z1: number, mat: THREE.Material, x = 0, y = 0): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(r, r, z1 - z0, 32);
  geo.rotateX(Math.PI / 2);
  const m = mesh(geo, mat);
  m.position.set(x, y, (z0 + z1) / 2);
  return m;
}

export default function buildM224(): MovementModel {
  const g = new THREE.Group();
  let tm = 0;
  g.add(displayStand());

  // 뒤판 축받이(고정)
  const wallBearing = new THREE.Group();
  wallBearing.name = 'wallBearing';
  wallBearing.position.set(OX, OY, 0);
  wallBearing.add(cylZ(0.16, -0.3, -0.27, darkSteel()), cylZ(0.09, -0.27, -0.12, darkSteel()));
  g.add(wallBearing);

  // 가운데 축(고정) + 앞 너트
  const mainShaft = new THREE.Group();
  mainShaft.name = 'mainShaft';
  mainShaft.position.set(OX, OY, 0);
  mainShaft.add(cylZ(0.05, -0.3, 0.2, steel()));
  const nutGeo = hexPrism(0.15, 0.03, true, true, 0.05);
  nutGeo.rotateX(Math.PI / 2);
  const nut = mesh(nutGeo, darkSteel());
  nut.position.z = 0.175;
  mainShaft.add(nut);
  g.add(mainShaft);

  // 거미판(고정)
  const spider = spider224();
  spider.name = 'spider';
  spider.position.set(OX, OY, 0);
  g.add(spider);

  // 안내 핀 6(고정) — 팔 홈 속
  for (let k = 0; k < 6; k++) {
    const ps = K.PSI(k);
    const pinGeo = lathe(
      [
        [0, 0.04],
        [0.018, 0.04],
        [0.018, 0.09],
        [0.03, 0.09],
        [0.03, 0.102],
        [0, 0.102]
      ],
      24
    );
    pinGeo.rotateX(Math.PI / 2);
    const pin = mesh(pinGeo, steel());
    pin.name = `pin${k}`;
    pin.position.set(OX + K.PIN_R * Math.cos(ps), OY + K.PIN_R * Math.sin(ps), 0);
    g.add(pin);
  }

  // 팔 6
  const arms: THREE.Group[] = [];
  for (let k = 0; k < 6; k++) {
    const a = arm224(k);
    a.rotation.z = K.PSI(k);
    arms.push(a);
    g.add(a);
  }

  // 바퀴 c
  const wheelC = slottedWheel224();
  wheelC.name = 'wheelC';
  wheelC.position.set(OX, OY, 0.1);
  g.add(wheelC);

  // 피니언 d: 중심 = 바퀴 중심 + K.PINION (한 변수)
  const px = OX + K.PINION[0];
  const py = OY + K.PINION[1];
  const pinionD = spurGear(K.TEETH_D, K.M, { width: 0.04, spokes: 0, driver: true });
  pinionD.name = 'pinionD';
  pinionD.position.set(px, py, 0.12);
  g.add(pinionD);

  // 피니언 축(θd 로 돎) + 뒤 칼라
  const pinionAxle = new THREE.Group();
  pinionAxle.name = 'pinionAxle';
  pinionAxle.position.set(px, py, 0);
  pinionAxle.add(cylZ(0.02, 0.04, 0.22, steel()), cylZ(0.035, 0.04, 0.1, steel()));
  g.add(pinionAxle);

  // 손잡이 원판 + 노란 표시
  const knob = new THREE.Group();
  knob.name = 'knob';
  knob.position.set(px, py, 0);
  knob.add(cylZ(0.06, 0.18, 0.22, darkSteel()));
  const knobMark = mesh(new THREE.BoxGeometry(0.05, 0.012, 0.006), paint(0xf2b619));
  knobMark.position.set(0.03, 0, 0.223);
  knob.add(knobMark);
  g.add(knob);

  g.add(
    leaderTo(tag('d 피니언', v(-0.95, 3.0, TAG_Z)), 'pinionD'),
    leaderTo(tag('c 굽은 홈 바퀴', v(1.4, 2.85, TAG_Z)), 'wheelC'),
    leaderTo(tag('b 팔', v(-1.65, 2.15, TAG_Z)), 'arm3'),
    leaderTo(tag('a 안내 핀', v(-1.75, 1.15, TAG_Z)), 'pin3'),
    leaderTo(tag('스터드', v(1.6, 1.45, TAG_Z)), 'stud0'),
    leaderTo(tag('테 조각', v(1.35, 0.45, TAG_Z)), 'rim5')
  );

  let rs: number = K.RS0;
  let thetaD = 0;
  const apply = (): void => {
    const s = state224(tm);
    rs = s.rs;
    thetaD = s.thetaD;
    wheelC.rotation.z = s.delta;
    pinionD.rotation.z = s.thetaD;
    pinionAxle.rotation.z = s.thetaD;
    knob.rotation.z = s.thetaD;
    for (let k = 0; k < 6; k++) {
      const ps = K.PSI(k);
      arms[k]!.position.set(OX + s.rs * Math.cos(ps), OY + s.rs * Math.sin(ps), 0);
    }
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '풀리 지름', value: (2 * (rs + RIM_OFFSET224)).toFixed(3) + ' (1.770~2.090)' },
      { label: '스터드 반지름', value: rs.toFixed(3) },
      { label: '피니언 d 각', value: (thetaD * DEG).toFixed(0) + '°' },
      { label: '원리', value: 'd 를 돌리면 c 가 돌고, c 의 나선 홈이 스터드를 밀어 팔 6개가 함께 바깥·안으로 미끄러진다' }
    ],
    update(dt: number, speed: number): void {
      tm += dt * speed;
      apply();
    },
    view: { pos: [0.4, 1.9, 5.6], target: [0, 1.62, 0.07] }
  };
}
