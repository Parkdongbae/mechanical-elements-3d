// 274 포물선 팔 조속기 — 스핀들 꼭대기 가로대에 사발 모양 포물선 팔 B 가 매달려 함께 돌고, 팔 안쪽 가장자리를 롤러 L 이 구른다.
// 롤러 축에 막대 F 와 공 K 가 한 몸으로 달려, 빨라지면 공이 벌어지며 롤러가 포물선을 올라 막대 F 가 슬리브를 끌어올린다.
// 설계표 docs/mm507-sheets/274.md · 키트 kit/k274.ts (왼쪽 묶음 = 오른쪽 묶음을 로컬 y 둘레 π 돌린 복사본)
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, tag } from '../kit';
import { glow } from '../../models/materials';
import { lathe, mesh, rodProfile } from '../../models/parts/geom';
import { setMM } from '../kit/mm';
import {
  K274,
  ballArm274,
  bolt274,
  parabolicArm274,
  pedestal274,
  rollerPin274,
  rollerWheel274,
  sleeve274,
  sleevePin274,
  spacer274,
  spindle274,
  state274,
  topBearing274,
  yoke274
} from '../kit/k274';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

interface Wing274 {
  group: THREE.Group;
  wheels: THREE.Mesh[];
  pin: THREE.Mesh;
  rod: THREE.Group;
}

/** 오른쪽 묶음(side 'R') 또는 그것을 π 돌린 왼쪽 묶음(side 'L'). 이름은 화면 앞쪽 몸통이 f·무접미가 되게 */
function makeWing(side: 'R' | 'L'): Wing274 {
  const g = new THREE.Group();
  g.name = `wing${side}`;
  const left = side === 'L';
  if (left) g.rotation.y = Math.PI;
  // 로컬 +z 판·바퀴가 오른쪽에서는 화면 앞, 왼쪽(π 돌림)에서는 뒤
  const plateHi = parabolicArm274();
  plateHi.name = left ? 'armB_Lb' : 'armB_Rf';
  plateHi.position.z = 0.045;
  const plateLo = parabolicArm274();
  plateLo.name = left ? 'armB_Lf' : 'armB_Rb';
  plateLo.position.z = -0.045;
  g.add(plateHi, plateLo);

  const wheelHi = rollerWheel274(1);
  wheelHi.name = left ? 'rollerL_Lb' : 'rollerL_R';
  const wheelLo = rollerWheel274(-1);
  wheelLo.name = left ? 'rollerL_L' : 'rollerL_Rb';
  const pin = rollerPin274();
  pin.name = `pinL_${side}`;
  const rod = ballArm274();
  rod.name = `rodBody_${side}`;
  (rod.getObjectByName('rodF') as THREE.Object3D).name = `rodF_${side}`;
  (rod.getObjectByName('ballK') as THREE.Object3D).name = `ballK_${side}`;
  g.add(wheelHi, wheelLo, pin, rod);

  // 가로대 볼트 둘과 두 판 사이 간격대
  const b1 = bolt274();
  b1.name = `boltY_${side}`;
  b1.position.set(K274.YOKE[0], K274.YOKE[1], 0);
  const b2 = bolt274();
  b2.name = `boltY2_${side}`;
  b2.position.set(K274.YOKE2[0], K274.YOKE2[1], 0);
  const sp = spacer274();
  sp.name = `spacer_${side}`;
  sp.position.set(K274.SPACER[0], K274.SPACER[1], 0);
  g.add(b1, b2, sp);
  return { group: g, wheels: [wheelHi, wheelLo], pin, rod };
}

/** 슬리브 옆 세로 화살(위를 가리킴) — 내릴 때는 모델이 뒤집는다 */
function liftArrow(): THREE.Group {
  const g = new THREE.Group();
  const mat = glow(0xf2b619, 0.9);
  const shaft = mesh(lathe(rodProfile(0.014, 0, 0.2, 0, 0), 16), mat);
  const head = mesh(new THREE.ConeGeometry(0.045, 0.1, 20), mat);
  head.position.y = 0.15;
  shaft.position.y = -0.1;
  g.add(shaft, head);
  g.traverse((o) => {
    o.layers.set(1);
    o.userData.noAO = true;
  });
  setMM(g, { kind: 'arrow', r: 0.1, ccw: true });
  return g;
}

export default function buildM274(): MovementModel {
  const g = new THREE.Group();
  let t = 0;
  g.add(displayStand());

  // 고정: 아래 받침, 위 베어링
  const pedestal = pedestal274();
  pedestal.name = 'pedestal';
  pedestal.position.set(0, 0, K274.ZC);
  const topBearing = topBearing274();
  topBearing.name = 'topBearing';
  topBearing.position.set(0, 0, K274.ZC);
  g.add(pedestal, topBearing);

  // 회전 묶음
  const spin = new THREE.Group();
  spin.name = 'govSpin';
  spin.position.set(0, 0, K274.ZC);
  g.add(spin);

  const spindle = spindle274();
  spindle.name = 'spindle';
  const yoke = yoke274();
  yoke.name = 'yoke';
  const sleeve = sleeve274();
  sleeve.name = 'sleeve';
  const pinSR = sleevePin274();
  pinSR.name = 'pinS_R';
  const pinSL = sleevePin274();
  pinSL.name = 'pinS_L';
  const wr = makeWing('R');
  const wl = makeWing('L');
  spin.add(spindle, yoke, sleeve, pinSR, pinSL, wr.group, wl.group);

  // 회전 화살표(위에서 보아 반시계 — 세로축 둘레) 와 슬리브 옆 세로 화살
  const arrCcw = rotArrow(0.2, true);
  const arrCw = rotArrow(0.2, false);
  for (const a of [arrCcw, arrCw]) {
    a.rotation.x = -Math.PI / 2;
    a.position.set(0, 0.85, K274.ZC);
  }
  const lift = liftArrow();
  g.add(arrCcw, arrCw, lift);

  // 이름표 6(이름표 표 그대로)
  g.add(
    leaderTo(tag('공 K', v(-0.85, 1.45, 0.3)), 'ballK_L'),
    leaderTo(tag('포물선 팔 B', v(-0.9, 2.6, 0.3)), 'armB_Lf'),
    leaderTo(tag('롤러 L', v(0.85, 2.3, 0.3)), 'rollerL_R'),
    leaderTo(tag('막대 F', v(0.8, 1.2, 0.3)), 'rodF_R'),
    leaderTo(tag('슬리브', v(-0.75, 0.95, 0.3)), 'sleeve'),
    leaderTo(tag('스핀들 C·D', v(0.75, 3.05, 0.3)), 'spindle')
  );

  let st = state274(0);
  const apply = (speed: number): void => {
    st = state274(t);
    spin.rotation.y = st.psi;
    for (const w of [wr, wl]) {
      for (const wh of w.wheels) {
        wh.position.set(st.L[0], st.L[1], 0);
        wh.rotation.z = st.roll;
      }
      w.pin.position.set(st.L[0], st.L[1], 0);
      w.rod.position.set(st.L[0], st.L[1], 0);
      w.rod.rotation.z = Math.atan2(st.S[1] - st.L[1], st.S[0] - st.L[0]) + Math.PI / 2;
    }
    sleeve.position.y = st.ys;
    pinSR.position.set(K274.AS, st.ys, 0);
    pinSL.position.set(-K274.AS, st.ys, 0);
    const rev = speed < 0;
    arrCcw.visible = !rev;
    arrCw.visible = rev;
    const dir = st.dir * (rev ? -1 : 1);
    lift.visible = dir !== 0;
    lift.rotation.z = dir < 0 ? Math.PI : 0;
    lift.position.set(-0.25, st.ys + (dir < 0 ? 0.05 : -0.05), 0.6);
  };
  apply(1);

  return {
    group: g,
    view: { pos: [0, 1.85, 4.4], target: [0, 1.8, 0.275] },
    notes: () => [
      { label: '스핀들 빠르기', value: (1.2 + 0.6 * st.s).toFixed(2) + ' rad/s' },
      { label: '슬리브 높이', value: st.ys.toFixed(3) },
      { label: '원리', value: '빨리 돌면 공이 바깥으로 쏠려 롤러가 포물선 팔을 타고 오르고, 막대 F 가 슬리브를 끌어올려 밸브를 조인다' },
      {
        label: '참고',
        value: '이상적인 포물선 조속기는 어느 높이에서나 같은 빠르기에서 평형이라(등시성) 아주 작은 빠르기 변화에도 크게 움직인다 — 모형은 빠르기와 높이를 함께 보여 줌'
      }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      apply(speed);
    }
  };
}
