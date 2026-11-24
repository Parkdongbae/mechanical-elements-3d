// 003 안내 풀리로 직각 전동 — 안내 풀리 2개를 거쳐 Z축 풀리에서 X축 드럼으로 평벨트 전동 (판화 3번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { Belt, displayStand, pillow, pulley, rod, shaftZ, tag } from '../kit';
import { brass, castIron, darkSteel, paint, steel } from '../../models/materials';
import { mesh } from '../../models/parts/geom';

// 풀리 P(구동): 중심 (1.0, 2.6), 축 Z, z = 0.2
const CPX = 1.0;
const CPY = 2.6;
const RP = 0.42; // P 반지름 (동작 비의 기준)
const RB = 0.43; // 벨트가 P 림 위를 도는 반지름 (r + 띠 두께 절반)
// 안내 풀리 G1·G2: 공통 중심 (-0.75, 2.75), 축 Z, z = 0.10 / 0.30
const CGX = -0.75;
const CGY = 2.75;
const RG = 0.16;
const RGB = 0.17; // 벨트가 G 둘레를 도는 반지름
const ZP = 0.2;
const ZG1 = 0.1;
const ZG2 = 0.3;
// 드럼 D(종동): 중심 (-0.85, 1.05, 0.20), 축 = X (P와 직각)
const DX = -0.85;
const DY = 1.05;
const DZ = 0.2;
const RD = 0.38;
const RDB = 0.39; // 벨트가 드럼을 감는 반지름 (안면 접촉)
const ZF = DZ + RDB; // 드럼 앞쪽 벨트면
const ZB = DZ - RDB; // 드럼 뒤쪽 벨트면
const GX = CGX - RGB; // 수직 가닥의 x (= G 왼쪽 접점)
const BOW = 0.08; // 두 수직 가닥이 엇갈리게 주는 x 볼록(sin² 창, 양끝 0)

// P→G 위쪽 외부 접선의 법선 m (단위) — 윗가닥이 P·G1에 동시 접함
const DDX = CGX - CPX;
const DDY = CGY - CPY;
const DLEN = Math.hypot(DDX, DDY);
const AX = DDX / DLEN;
const AY = DDY / DLEN;
const LX = -AY;
const LY = AX;
const SS = (RB - RGB) / DLEN;
const CC = Math.sqrt(1 - SS * SS);
let MX = SS * AX - CC * LX;
let MY = SS * AY - CC * LY;
if (MY < 0) {
  MX = -MX;
  MY = -MY; // 위쪽 해
}
const PT = Math.atan2(MY, MX); // 윗면 접점각 (P·G 공통)
const PBX = CPX - RB * MX; // P 아랫면 접점 (뒷가닥이 돌아오는 자리)
const PBY = CPY - RB * MY;
const U2X = MY; // 아랫가닥 진행 방향(P 접선)
const U2Y = -MX;
const SJ = (0.3 - PBX) / U2X; // 굽은 구간 종점 J: L2 위의 점
const JX = PBX + U2X * SJ;
const JY = PBY + U2Y * SJ;

const v3 = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const sm = (t: number): number => t * t * (3 - 2 * t); // smoothstep
const WZ = v3(0, 0, 1); // Z축 풀리 면 위의 폭 방향
const WX = v3(1, 0, 0); // X축 드럼 면 위의 폭 방향
const mixW = (k: number): THREE.Vector3 => WX.clone().lerp(WZ, k).normalize(); // 0=X → 1=Z

/** 벨트 3D 경로(닫힌 점열)와 점마다 폭 방향. 모든 구간이 접선 연속 */
function beltPath(): { pts: THREE.Vector3[]; wds: THREE.Vector3[] } {
  const pts: THREE.Vector3[] = [];
  const wds: THREE.Vector3[] = [];
  const push = (x: number, y: number, z: number, w: THREE.Vector3): void => {
    pts.push(v3(x, y, z));
    wds.push(w.clone());
  };
  // ① P 둘레 오른쪽 반 바퀴 (아랫 접점 → 윗 접점)
  const PA = PT - Math.PI;
  for (let i = 0; i <= 24; i++) {
    const a = PA + ((PT - PA) * i) / 24;
    push(CPX + Math.cos(a) * RB, CPY + Math.sin(a) * RB, ZP, WZ);
  }
  // ② P→G1 직선 가닥 (z 0.2 → 0.10)
  const TPX = CPX + Math.cos(PT) * RB;
  const TPY = CPY + Math.sin(PT) * RB;
  const TGX = CGX + Math.cos(PT) * RGB;
  const TGY = CGY + Math.sin(PT) * RGB;
  for (let i = 1; i <= 8; i++) {
    const t = i / 8;
    push(TPX + (TGX - TPX) * t, TPY + (TGY - TPY) * t, ZP + (ZG1 - ZP) * t, WZ);
  }
  // ③ G1 둘레 1/4 호 (수평 → 수직)
  for (let i = 1; i <= 10; i++) {
    const a = PT + ((Math.PI - PT) * i) / 10;
    push(CGX + Math.cos(a) * RGB, CGY + Math.sin(a) * RGB, ZG1, WZ);
  }
  // ④ 앞가닥 수직 하강 — z 를 0.10→0.59 로 벌리고 폭 Z→X 비틀림.
  //  x 를 왼쪽으로 살짝 볼록게: 뒷가닥(⑥)과 같은 평면에서 서로 통과하지 않게 엇갈림
  for (let i = 1; i <= 12; i++) {
    const t = i / 12;
    const k = sm(Math.min(1, t / 0.3));
    push(GX - BOW * Math.sin(Math.PI * t) ** 2, CGY + (DY - CGY) * t, ZG1 + (ZF - ZG1) * sm(t), mixW(1 - k));
  }
  // ⑤ 드럼 아래쪽 반원 (YZ 평면, x = GX 고정, 앞→아래→뒤). 폭 = 드럼 축 방향 X
  for (let i = 1; i <= 16; i++) {
    const ps = (Math.PI * i) / 16;
    push(GX, DY - Math.sin(ps) * RDB, DZ + Math.cos(ps) * RDB, WX);
  }
  // ⑥ 뒷가닥 수직 상승 — z 를 −0.19→0.30 으로 벌리고 폭 X→Z 비틀림, x 는 오른쪽으로 볼록
  for (let i = 1; i <= 12; i++) {
    const t = i / 12;
    const k = sm(Math.min(1, Math.max(0, (t - 0.45) / 0.3)));
    push(GX + BOW * Math.sin(Math.PI * t) ** 2, DY + (CGY - DY) * t, ZB + (ZG2 - ZB) * sm(t), mixW(k));
  }
  // ⑦ G2 넘는 굽은 구간: 왼쪽 접점에서 감돌아 L2 접선에 합류 (3차 베지어, z = 0.30)
  const C1X = GX;
  const C1Y = CGY + 0.6;
  const C2X = JX - 0.45 * U2X;
  const C2Y = JY - 0.45 * U2Y;
  for (let i = 1; i <= 24; i++) {
    const t = i / 24;
    const u = 1 - t;
    const bx = u * u * u * GX + 3 * u * u * t * C1X + 3 * u * t * t * C2X + t * t * t * JX;
    const by = u * u * u * CGY + 3 * u * u * t * C1Y + 3 * u * t * t * C2Y + t * t * t * JY;
    push(bx, by, ZG2, WZ);
  }
  // ⑧ L2 접선 가닥: J → P 아랫 접점 (z 0.30 → 0.20)
  for (let i = 1; i < 10; i++) {
    const t = i / 10;
    push(JX + (PBX - JX) * t, JY + (PBY - JY) * t, ZG2 + (ZP - ZG2) * t, WZ);
  }
  return { pts, wds };
}

export default function buildM003(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 풀리 P(구동, bronze) + 안내 풀리 G1·G2(자유 회전, 공통 축) — 평벨트용 민판 림
  const pP = pulley(RP, { driver: true, flat: true });
  pP.position.set(CPX, CPY, ZP);
  const g1 = pulley(RG, { spokes: 4, flat: true, hub: 0.055 });
  g1.position.set(CGX, CGY, ZG1);
  const g2 = pulley(RG, { spokes: 4, flat: true, hub: 0.055 });
  g2.position.set(CGX, CGY, ZG2);
  g.add(pP, g1, g2, shaftZ(CPX, CPY), shaftZ(CGX, CGY, 0.5));

  // 드럼 D: X축 원통 + 양끝 허브 + +X 끝면 스포크·표시점
  const drum = new THREE.Group();
  drum.position.set(DX, DY, DZ);
  const bodyGeo = new THREE.CylinderGeometry(RD, RD, 0.5, 48);
  bodyGeo.rotateZ(-Math.PI / 2); // Y축 → X축
  drum.add(mesh(bodyGeo, brass()));
  for (const sx of [-1, 1]) {
    const hubGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.06, 24);
    hubGeo.rotateZ(-Math.PI / 2);
    const hub = mesh(hubGeo, darkSteel());
    hub.position.x = sx * 0.26;
    drum.add(hub);
  }
  for (let i = 0; i < 3; i++) {
    const spGeo = new THREE.BoxGeometry(0.012, RD - 0.18, 0.024);
    spGeo.translate(0, 0.09 + (RD - 0.18) / 2, 0);
    spGeo.rotateX((i / 3) * Math.PI * 2);
    const sp = mesh(spGeo, steel());
    sp.position.x = 0.253;
    drum.add(sp);
  }
  const mkGeo = new THREE.BoxGeometry(0.014, 0.06, 0.02);
  mkGeo.translate(0, 0.3, 0);
  const mark = mesh(mkGeo, paint(0xf2b619));
  mark.position.x = 0.256;
  drum.add(mark);
  g.add(drum);

  // 드럼 축(관통) + 받침대에 세운 기둥 2개 + 필로 블록
  g.add(rod(v3(-1.24, DY, DZ), v3(-0.46, DY, DZ), 0.035));
  for (const cx of [-1.24, -0.46]) {
    const colGeo = new THREE.BoxGeometry(0.14, 0.84, 0.14);
    const col = mesh(colGeo, castIron());
    col.position.set(cx, 0.42, DZ); // 0~0.84, 받침에 약간 묻혀 심음
    g.add(col);
    g.add(pillow(cx, 0.84, DZ, 'x'));
  }

  // 평벨트(3D 경로, 폭 0.12, 점마다 폭 방향) + 이름표
  const bp = beltPath();
  const belt = new Belt(bp.pts, { width: 0.12, thickness: 0.02, style: 'flat', widthDirs: bp.wds });
  g.add(belt.group);
  g.add(tag('구동 풀리', v3(1.65, 3.1, 0.3)));
  g.add(tag('안내 풀리', v3(-1.5, 3.05, 0.35)));
  g.add(tag('종동 드럼(직각 축)', v3(-1.1, 0.45, 0.4)));

  return {
    group: g,
    notes: () => [
      { label: '축의 관계', value: '직각' },
      { label: '안내 풀리', value: '2개' }
    ],
    update(dt: number, speed: number): void {
      // 절대 각도로 자세 계산 — 역회전·누적 오차 없음
      theta += OMEGA * speed * dt;
      pP.rotation.z = theta;
      drum.rotation.x = (theta * RP) / RD; // 앞가닥이 내려가는 방향
      g1.rotation.z = (theta * RP) / RG;
      g2.rotation.z = (-theta * RP) / RG; // 서로 반대 방향
      belt.setOffset(theta * RP);
    }
  };
}
