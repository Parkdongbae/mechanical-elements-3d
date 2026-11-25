// 149 캠 두 개와 지레 두 개 — 한 축의 달걀 꼴 캠 둘(115° 어긋남)이 지레 둘을 번갈아 올려
//  지레에 매달린 막대 둘이 번갈아 오르내린다 (판화 149번, 설계표 docs/mm507-sheets/149.md)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, tag, leaderTo } from '../kit';
import { wallBearing } from '../kit/gear6';
import { K149, camLevers149, hangRod, lobeCam, leverPoint, rodAim, rollerLever } from '../kit/k149';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const DEG = 180 / Math.PI;

/** child 이름으로 찾아 새 이름을 붙인다(검사 선언용 이름). 없으면 예외 */
function child(o: THREE.Object3D, name: string, as: string): THREE.Object3D {
  const c = o.getObjectByName(name);
  if (c === undefined) throw new Error(`child ${name} 없음`);
  c.name = as;
  return c;
}

export default function buildM149(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 받침 축(고정): 두 지레가 함께 꿰인다. 캠 축(구동): 뒤판 보스가 받친다
  g.add(shaftZ(K149.P[0], K149.P[1], 0.56, 0.05));
  const camShaft = shaftZ(K149.C[0], K149.C[1], 0.5, K149.shaftR);
  camShaft.name = 'camShaft';
  g.add(camShaft);

  // 같은 달걀 꼴 캠 둘 — 뒤 혹 85°(위), 앞 혹 200°(왼쪽 살짝 아래). 청동 + 꼭대기 노란 점(키트 내장)
  const camBack = lobeCam(K149.rb, K149.lift, K149.halfW, { thick: K149.camT, bore: K149.shaftR });
  camBack.name = 'camBack';
  camBack.position.set(K149.C[0], K149.C[1], K149.zCamBack);
  const camFront = lobeCam(K149.rb, K149.lift, K149.halfW, { thick: K149.camT, bore: K149.shaftR });
  camFront.name = 'camFront';
  camFront.position.set(K149.C[0], K149.C[1], K149.zCamFront);
  g.add(camBack, camFront);

  // 지레 둘(같은 길이·바퀴) — 뒤 = 판화의 위 지레, 앞 = 판화의 아래 지레
  const leverBack = rollerLever(K149.L, { pinAt: K149.pinBack, rollerR: K149.rr, rollerW: 0.08, rollerDz: 0.12, pinDz: 0.07 });
  leverBack.name = 'leverBack';
  leverBack.position.set(K149.P[0], K149.P[1], K149.zBarBack);
  const leverFront = rollerLever(K149.L, { pinAt: K149.pinFront, rollerR: K149.rr, rollerW: 0.08, rollerDz: -0.12, pinDz: 0.07 });
  leverFront.name = 'leverFront';
  leverFront.position.set(K149.P[0], K149.P[1], K149.zBarFront);
  const rollerBack = child(leverBack, 'roller', 'rollerBack'); // 뒤 캠 평면(z 0)
  const rollerFront = child(leverFront, 'roller', 'rollerFront'); // 앞 캠 평면(z 0.36)
  child(leverBack, 'rodPin', 'pinBack'); // 막대 눈이 걸리는 자리
  child(leverFront, 'rodPin', 'pinFront');
  g.add(leverBack, leverFront);

  // 매달린 막대 둘 — 원점 = 위 눈(지레 막대 핀). 뒤 막대는 앞 지레 뒤로 지나간다(판화 순서)
  const Z_PIN_BACK = K149.zBarBack + 0.07; // −0.05 (pinBack 층)
  const Z_PIN_FRONT = K149.zBarFront + 0.07; // 0.55 (pinFront 층)
  const rodBack = hangRod(K149.rodBack);
  rodBack.name = 'rodBack';
  const rodFront = hangRod(K149.rodFront);
  rodFront.name = 'rodFront';
  g.add(rodBack, rodFront);

  // 막대 안내 고리 둘(판화에 없음 — 최소 보충): 구멍이 세로, 뒤판 팔이 받친다
  g.add(wallBearing(K149.guideBack[0], K149.guideBack[1], Z_PIN_BACK, 'y', 0.04));
  g.add(wallBearing(K149.guideFront[0], K149.guideFront[1], Z_PIN_FRONT, 'y', 0.04));

  // 회전 방향 화살표(반시계, 캠 허브만 덮는 크기)
  const arrow = rotArrow(0.18, true);
  arrow.position.set(K149.C[0], K149.C[1], 0.6);
  g.add(arrow);

  // 이름표 4개 — '위 지레'·'아래 지레'는 움직이는 부품을 따라간다
  const tagCam = tag('캠 둘(구동)', v(1.45, 0.72, 0.5));
  const tagUpper = leaderTo(tag('위 지레', v(0, 0, 0.3)), leverBack);
  const tagLower = leaderTo(tag('아래 지레', v(0, 0, 0.6)), leverFront);
  const tagRod = tag('왕복 막대', v(-0.8, 0.95, 0.5));
  g.add(tagCam, tagUpper, tagLower, tagRod);

  /** theta 의 닫힌 식으로 전체 자세를 다시 계산(누적 오차·역회전 없음) */
  const pose = (th: number): void => {
    const s = camLevers149(th);
    camShaft.rotation.z = s.a;
    camBack.rotation.z = s.noseBack;
    camFront.rotation.z = s.noseFront;
    leverBack.rotation.z = s.alphaBack;
    leverFront.rotation.z = s.alphaFront;
    rollerBack.rotation.z = -2 * s.a; // 바퀴가 구르는 표시(돌아 보이게만)
    rollerFront.rotation.z = -2 * s.a;
    const pb = leverPoint(K149.P, s.alphaBack, K149.pinBack);
    rodBack.position.set(pb[0], pb[1], Z_PIN_BACK);
    rodBack.rotation.z = rodAim(pb, K149.guideBack);
    const pf = leverPoint(K149.P, s.alphaFront, K149.pinFront);
    rodFront.position.set(pf[0], pf[1], Z_PIN_FRONT);
    rodFront.rotation.z = rodAim(pf, K149.guideFront);
    const rc = leverPoint(K149.P, s.alphaBack, K149.L); // 뒤 굴림 바퀴 중심
    tagUpper.position.set(rc[0] - 0.75, rc[1] + 0.42, 0.3);
    const mid = leverPoint(K149.P, s.alphaFront, 0.75); // 앞 지레 가운데
    tagLower.position.set(mid[0], mid[1] - 0.38, 0.6);
  };
  pose(0);

  return {
    group: g,
    view: { pos: [0, 1.75, 6.4], target: [0, 1.6, 0.1] },
    notes: () => {
      const s = camLevers149(theta);
      return [
        { label: '캠', value: '달걀 꼴 둘, 115° 어긋남' },
        { label: '위 지레', value: `각 ${(s.alphaBack * DEG).toFixed(1)}°` },
        { label: '아래 지레', value: `각 ${(s.alphaFront * DEG).toFixed(1)}°` },
        { label: '막대 행정', value: '뒤 0.27 · 앞 0.31' },
        { label: '캠 축 회전수', value: '1.6 rad/s ≈ 15 rpm' }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      pose(theta);
    }
  };
}
