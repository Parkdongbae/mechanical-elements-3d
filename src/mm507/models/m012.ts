// 012 고정 도르래 — 줄이 도르래 위를 넘어 1:1 (방향만 바뀜). 손이 줄을 당기면 추가 같은 길이만큼 오른다 (판화 12번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { Rope, displayStand, pulley, rod, ropeAround, rotArrow, tag, weight } from '../kit';
import { castIron, glow, steel, wood } from '../../models/materials';
import { mesh } from '../../models/parts/geom';

const CX = 0.15; // 도르래 중심 x
const CY = 2.35; // 도르래 중심 y
const Z = 0.25; // 줄·도르래 면
const R = 0.36; // 줄 중심 반지름
const ALPHA = (35 * Math.PI) / 180; // 왼쪽 줄이 수직에서 기운 각
const WX = 0.51; // 추 x (오른쪽 줄은 수직)
const TAU_MAX = 1.8; // d=0 일 때 접점 T→손 거리

// 왼쪽 줄: 접점 T 에서 단위벡터 u 방향의 같은 직선 위에 손이 항상 있다
const U = new THREE.Vector2(-Math.sin(ALPHA), -Math.cos(ALPHA));
const T = new THREE.Vector2(CX - R * Math.cos(ALPHA), CY + R * Math.sin(ALPHA));

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM012(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  let dNow = 0; // notes() 가 읽는 현재 줄당김·추 상승량

  g.add(displayStand());

  // 가로 들보 (뒤판 앞면에 거의 붙음)
  const beam = mesh(new THREE.BoxGeometry(2.1, 0.12, 0.65), castIron());
  beam.position.set(0.15, 3.02, 0.05);
  g.add(beam);

  // 도르래 바퀴 (위치 고정, 이것만 회전)
  const sheave = pulley(0.34, { width: 0.1, grooved: true, spokes: 4 });
  sheave.position.set(CX, CY, Z);
  g.add(sheave);

  // 매달이: 축 막대 + 양쪽 옆판 + 위 고리 + 들보 아래 고정 핀 (모두 고정)
  g.add(rod(v(CX, CY, 0.13), v(CX, CY, 0.37), 0.03));
  for (const sz of [-1, 1]) {
    const plate = mesh(new THREE.BoxGeometry(0.03, 0.555, 0.03), steel());
    plate.position.set(CX, 2.6275, Z + sz * 0.1); // y 2.35 ~ 2.905
    g.add(plate);
  }
  // 옆판 두 장을 잇는 윗 가로대 — 고리 구멍(y 2.872~2.948)을 지나 매달이 전체가 고리에 걸린다
  // (전에는 옆판 위끝 2.87 과 고리 사이가 z 로 0.07 떨어져 도르래·추 무리가 떠 있었다)
  const cap = mesh(new THREE.BoxGeometry(0.03, 0.03, 0.23), steel());
  cap.position.set(CX, 2.89, Z); // y 2.875 ~ 2.905, z 0.135 ~ 0.365
  g.add(cap);
  const hook = mesh(new THREE.TorusGeometry(0.05, 0.012, 12, 24), steel());
  hook.position.set(CX, 2.91, Z);
  g.add(hook);
  g.add(rod(v(CX, 2.945, 0.2), v(CX, 2.945, 0.3), 0.013)); // 핀이 고리 구멍을 지난다

  // 추 (위 고리 중심 = 중심 + 0.234)
  const load = weight(0.34, 0.4);
  load.position.set(WX, 0.62, Z);
  load.add(tag('추', v(0.5, 0.1, 0.1)));
  g.add(load);

  // 줄 (매 프레임 setPath)
  const rope = new Rope(0.018);
  g.add(rope.group);

  // 손잡이(짙은 나무) + 당기는 방향 화살표 — u 가 고정이라 내부 배치도 고정, 그룹만 E 로 이동
  const hand = new THREE.Group();
  const u3 = v(U.x, U.y, 0);
  const alongU = new THREE.Quaternion().setFromUnitVectors(v(0, 1, 0), u3);
  const gripMat = wood(0x4a2f1d);
  const grip = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 16), gripMat);
  grip.position.copy(u3).multiplyScalar(0.08);
  grip.quaternion.copy(alongU);
  const knob = mesh(new THREE.SphereGeometry(0.06, 20, 16), wood(0x4a2f1d));
  knob.position.copy(u3).multiplyScalar(0.16);
  const arrowMat = glow(0xd8362f, 0.85);
  const arrowShaft = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 10), arrowMat);
  arrowShaft.position.copy(u3).multiplyScalar(0.25);
  arrowShaft.quaternion.copy(alongU);
  const arrowHead = mesh(new THREE.ConeGeometry(0.045, 0.1, 14), glow(0xd8362f, 0.85));
  arrowHead.position.copy(u3).multiplyScalar(0.37);
  arrowHead.quaternion.copy(alongU);
  hand.add(grip, knob, arrowShaft, arrowHead);
  hand.add(tag('당기는 손(힘 = 무게)', v(0.45, 0.25, 0.1)));
  g.add(hand);

  // 회전 방향 화살표(반시계) + 이름표
  const arrow = rotArrow(0.55, true);
  arrow.position.set(CX, CY, 0.36);
  g.add(arrow);
  g.add(tag('고정 도르래', v(0.95, 2.85, 0.35)));

  return {
    group: g,
    notes: () => [
      { label: '힘의 이득', value: '1 : 1 (방향만 바뀜)' },
      { label: '당긴 줄 길이', value: dNow.toFixed(2) },
      { label: '추 올라간 높이', value: dNow.toFixed(2) }
    ],
    update(dt: number, speed: number): void {
      // 절대 각도에서 전체 자세를 다시 계산 — 역회전·누적 오차 없음
      theta += OMEGA * speed * dt;
      const d = 0.3 * (1 - Math.cos(0.5 * theta)); // 추 올림 높이 0~0.6
      dNow = d;
      sheave.rotation.z = d / R; // 왼쪽 줄 내려감·오른쪽 올라감 = 반시계
      load.position.set(WX, 0.62 + d, Z);
      const ex = T.x + U.x * (TAU_MAX + d); // 손도 d 만큼 더 내려간다 (1:1)
      const ey = T.y + U.y * (TAU_MAX + d);
      hand.position.set(ex, ey, Z);
      rope.setPath(
        ropeAround({ p: [ex, ey], w: Z }, [{ c: [CX, CY], r: R, ccw: false, w: Z }], { p: [WX, 0.62 + d + 0.234], w: Z }, { seg: 24 })
      );
    }
  };
}
