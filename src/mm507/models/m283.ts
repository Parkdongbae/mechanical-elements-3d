// 283 손잡이로 구동하는 두 개의 랙 — 손잡이를 흔들면 피니언이 같이 흔들리고,
// 피니언 왼쪽·오른쪽에 물린 두 랙이 서로 반대로 오르내려 유리 실린더 속 두 피스톤을 번갈아 밀고 당긴다 (판화 283번)
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, setMM, shaftZ, spurGear, tag } from '../kit';
import { K283, handle283, rack283, rackGuide283, state283 } from '../kit/k283';
import { brass, castIron, glass, glow, steel } from '../../models/materials';
import { extrude, lathe, merge, mesh, rodProfile, tubeProfile } from '../../models/parts/geom';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM283(): MovementModel {
  const g = new THREE.Group();
  const [CX, CY] = K283.C;
  let t = 0;
  g.add(displayStand());

  // 피니언 축(돌지 않음) + 뒤 칼라(피니언 뒷면과 틈 0.002)
  const shaft = shaftZ(CX, CY, 0.17, 0.06);
  shaft.name = 'pinionShaft';
  const collarGeo = lathe(tubeProfile(0.06, 0.095, -0.2, -0.052, 0.004), 32);
  collarGeo.rotateX(Math.PI / 2);
  shaft.add(mesh(collarGeo, steel()));
  g.add(shaft);

  // 피니언 묶음: 피니언 + 손잡이가 한 몸으로 θ 만큼 흔들린다
  const spin = new THREE.Group();
  spin.name = 'pinionSpin';
  spin.position.set(CX, CY, 0);
  const pinion = spurGear(K283.N, K283.M, { width: 0.1, spokes: 0, driver: true });
  pinion.name = 'pinion';
  spin.add(pinion);
  const handle = handle283();
  handle.name = 'handle';
  spin.add(handle);
  g.add(spin);

  // 랙 둘(피스톤 막대·피스톤 포함) — 위치는 apply() 에서
  const rackL = rack283(1);
  rackL.position.set(-K283.RP, CY, 0);
  g.add(rackL);
  const rackR = rack283(-1);
  rackR.position.set(K283.RP, CY, 0);
  g.add(rackR);

  // 받침판: 막대 구멍 2 뚫린 판 + 다리 2 + 뒤판 팔(한 메시)
  // 판은 (x, z) 평면 윤곽을 Y 로 압출 — 구멍이 막대가 지나는 세로 구멍이 된다
  const plate = new THREE.Shape();
  plate.moveTo(-1.3, -0.25);
  plate.lineTo(1.3, -0.25);
  plate.lineTo(1.3, 0.2);
  plate.lineTo(-1.3, 0.2);
  plate.closePath();
  for (const sx of [-1, 1]) {
    const hole = new THREE.Path();
    hole.absarc(sx * 0.58, 0, 0.04, 0, Math.PI * 2, true); // 막대(0.03) 통과 구멍 — 틈 0.01
    plate.holes.push(hole);
  }
  const plateGeo = extrude(plate, 0.08, 0.008);
  plateGeo.rotateX(Math.PI / 2); // 압출축 → 세로, 윤곽 (x, z) 그대로
  plateGeo.translate(0, 0.89, 0); // 판: x ±1.3, y 0.85 ~ 0.93, 깊이 −0.25 ~ 0.20
  const legGeoL = new THREE.BoxGeometry(0.15, 0.68, 0.45);
  legGeoL.translate(-1.225, 0.52, -0.025); // 다리: x −1.30~−1.15, y 0.18~0.86(판에 0.01 박음)
  const legGeoR = new THREE.BoxGeometry(0.15, 0.68, 0.45);
  legGeoR.translate(1.225, 0.52, -0.025);
  const backGeo = new THREE.BoxGeometry(2.6, 0.08, 0.055);
  backGeo.translate(0, 0.89, -0.2725); // 뒤판 팔: 깊이 −0.30 ~ −0.245(판에 0.005 겹침)
  const table = mesh(merge([plateGeo, legGeoL, legGeoR, backGeo]), castIron());
  table.name = 'table';
  g.add(table);

  // 실린더 둘(유리) + 마개 + 공기 관 이음
  const cylGeo = lathe(tubeProfile(0.14, 0.17, 0.244, 0.854, 0.004), 48); // 양 끝 0.004씩 마개·받침판에 박아 붙임
  const capGeo = lathe(rodProfile(0.19, 0.18, 0.24, 0.012, 0.006), 40);
  const fitGeo = lathe(rodProfile(0.025, 0.175, 0.29, 0.004, 0.004), 20); // 마개에 0.015 박힌 관 이음
  fitGeo.rotateX(Math.PI / 2);
  for (const sx of [-1, 1]) {
    const cyl = mesh(cylGeo, glass());
    cyl.name = sx < 0 ? 'cylL' : 'cylR';
    cyl.position.set(sx * 0.58, 0, 0);
    g.add(cyl);
    const cap = mesh(capGeo, castIron());
    cap.name = sx < 0 ? 'capL' : 'capR';
    cap.position.set(sx * 0.58, 0, 0);
    cap.add(posOf(mesh(fitGeo, brass()), 0, 0.21, 0));
    g.add(cap);
  }

  // 안내 고리 넷(랙 단면을 틈 0.003 으로 가둠)
  const guides: [string, number, number, number][] = [
    ['guideL1', -0.653, -0.397, 1.43],
    ['guideL2', -0.653, -0.397, 1.66],
    ['guideR1', 0.397, 0.653, 1.43],
    ['guideR2', 0.397, 0.653, 1.66]
  ];
  for (const [name, x0, x1, y0] of guides) {
    const gd = rackGuide283(x0, x1, y0);
    gd.name = name;
    g.add(gd);
  }

  // 회전 화살표 2개(방향에 따라 하나만 보임) — 피니언 둘레
  const arrCcw = rotArrow(0.62, true);
  const arrCw = rotArrow(0.62, false);
  arrCcw.position.set(CX, CY, 0.12);
  arrCw.position.set(CX, CY, 0.12);
  g.add(arrCcw, arrCw);

  // 랙 방향 세로 화살(길이 0.18, 노랑) — 위쪽을 보고 만들고 내려갈 때 뒤집는다
  const mkRackArrow = (x: number): THREE.Group => {
    const a = new THREE.Group();
    const mat = glow(0xf2b619, 0.85);
    a.add(mesh(lathe(rodProfile(0.012, -0.09, 0.03, 0.002, 0.002), 10), mat));
    const headGeo = new THREE.ConeGeometry(0.03, 0.06, 14);
    headGeo.translate(0, 0.06, 0);
    a.add(mesh(headGeo, mat));
    a.position.set(x, CY, 0.1);
    a.traverse((o) => {
      o.layers.set(1);
      o.userData.noAO = true;
    });
    setMM(a, { kind: 'arrow', vertical: true });
    return a;
  };
  const arrowL = mkRackArrow(-0.85);
  const arrowR = mkRackArrow(0.85);
  g.add(arrowL, arrowR);

  // 이름표 6 개 — 이름표 표대로
  g.add(
    leaderTo(tag('피니언', v(1.25, 2.75, 0.3)), 'pinion'),
    leaderTo(tag('왼쪽 랙', v(-1.45, 2.55, 0.3)), 'rackL'),
    leaderTo(tag('오른쪽 랙', v(1.35, 1.75, 0.3)), 'rackR'),
    leaderTo(tag('손잡이', v(-1.25, 3.0, 0.3)), 'handle'),
    leaderTo(tag('안내 고리', v(-1.35, 1.25, 0.3)), 'guideL1'),
    leaderTo(tag('펌프 실린더', v(1.35, 0.55, 0.3)), 'cylR')
  );

  // 모든 부품 자세 = t 의 닫힌 식
  const apply = (): void => {
    const st = state283(t);
    spin.rotation.z = st.theta;
    rackL.position.y = CY + st.yL;
    rackR.position.y = CY + st.yR;
  };
  const setArrows = (speed: number): void => {
    const w = K283.AMP * K283.W * Math.cos(K283.W * t) * speed; // θ'
    const up = w > 0; // θ 가 늘 때 왼쪽 랙은 내려가고 오른쪽은 올라간다
    arrCcw.visible = up;
    arrCw.visible = !up;
    arrowL.rotation.x = up ? Math.PI : 0;
    arrowR.rotation.x = up ? 0 : Math.PI;
  };
  apply();
  setArrows(1);

  return {
    group: g,
    view: { pos: [0.0, 1.95, 5.6], target: [0.0, 1.85, 0.0] },
    notes: () => {
      const st = state283(t);
      return [
        { label: '손잡이 각', value: ((st.theta * 180) / Math.PI).toFixed(1) + '°' },
        { label: '왼쪽 랙', value: st.yL.toFixed(3) },
        { label: '오른쪽 랙', value: st.yR.toFixed(3) },
        {
          label: '원리',
          value: '피니언 한쪽은 내려가고 반대쪽은 올라가므로 두 랙이 같은 거리만큼 서로 반대로 움직인다 — 한 실린더가 빨아들일 때 다른 실린더가 밀어낸다'
        },
        { label: '메모', value: '판화의 바깥 기둥 대신 랙 안내 고리를 그렸고, 피스톤이 보이도록 실린더를 유리로 그렸다' }
      ];
    },
    update(dt: number, speed: number): void {
      t += dt * speed;
      apply();
      setArrows(speed);
    }
  };
}

const posOf = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number): T => {
  o.position.set(x, y, z);
  return o;
};
