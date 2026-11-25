// 147 공기 날개 조속기 — 세로축의 둥근 경사면이 십자머리를 끌고 돌고, 날개가 받는 공기 저항으로
//  뒤처진 십자머리의 마찰 롤러가 경사면을 타고 올라 목 고리·레버를 들어 밸브를 조인다
//  (판화 147번, 설계표 docs/mm507-sheets/147.md, 키트 kit/k146.ts 의 147 공용 부품 — 새 부품 없음)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, tag, leaderTo } from '../kit';
import {
  K147,
  camShaft147,
  crossHead147,
  footstep147,
  governor147,
  leverPost147,
  neckCollar147,
  rollerLift147,
  stemGuide146,
  valveLever147
} from '../kit/k146';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const DEG = 180 / Math.PI;

/** 배치 상수: 세로축의 z, 경사면 낮은 곳의 높이, 레버가 수평인 lift(최대의 절반), 레버 받침 핀 높이 */
const ZC = 0.275;
const Y0 = 1.2;
const MID = rollerLift147(K147.dMax) / 2;
const YP = Y0 + K147.rollR + K147.neckUp + MID;

/** child 이름으로 찾는다. 없으면 예외 */
function child(o: THREE.Object3D, name: string): THREE.Object3D {
  const c = o.getObjectByName(name);
  if (c === undefined) throw new Error(`child ${name} 없음`);
  return c;
}

export default function buildM147(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 경사면 통 + 세로축(구동, 회전축 Y) — 원점 = 경사면 낮은 곳의 높이
  const camShaft = camShaft147(0.99, 0.36);
  camShaft.name = 'camShaft';
  camShaft.position.set(0, Y0, ZC);

  // 십자머리(축에 헐겁게 — 돌고 오르내린다) — 원점 = 팔 축 높이
  const head = crossHead147();
  head.name = 'head';
  const rollerA = child(head, 'rollerA');
  const rollerB = child(head, 'rollerB');

  // 목 고리(돌지 않고 십자머리와 함께 오르내린다)
  const collar = neckCollar147();
  collar.name = 'collar';

  // 밸브 레버(원점 = 받침 핀 구멍) + 받침 기둥(판화에 없음 — 보충)
  const lever = valveLever147();
  lever.name = 'lever';
  lever.position.set(K147.leverL, YP, ZC + K147.leverZ);
  const post = leverPost147(K147.leverL, YP, ZC);
  post.name = 'post';

  // 발 받침 컵 + 가운데 축받이(146 키트의 뒤판 고리 재사용) — 판화에 없음 — 보충
  const footstep = footstep147(0, ZC, K147.shaftR);
  footstep.name = 'footstep';
  const midBearing = stemGuide146(0, 0.7, ZC, K147.shaftR);
  midBearing.name = 'midBearing';

  // 회전 방향 화살표 — 눕혀서(위에서 보아 반시계 = rotation.y 가 느는 방향)
  const arrow = rotArrow(0.2, true);
  arrow.rotation.x = -Math.PI / 2;
  arrow.position.set(0, 0.95, ZC);

  // 이름표 5개 — 십자머리 이름표는 함께 오르내린다
  const tagShaft = tag('세로축(구동)', v(-0.75, 0.55, 0.3));
  const tagCam = tag('둥근 경사면(축에 고정)', v(-1.15, 1.05, 0.3));
  const tagHead = leaderTo(tag('날개 달린 십자머리(축에 헐겁게)', v(-1.35, 1.6, 0.3)), head);
  const tagRoller = leaderTo(tag('마찰 롤러', v(0.95, 1.2, 0.3)), rollerA);
  const tagLever = tag('밸브 레버', v(1.35, 2.0, 0.36));

  g.add(camShaft, head, collar, lever, post, footstep, midBearing, arrow, tagShaft, tagCam, tagHead, tagRoller, tagLever);

  /** theta 의 닫힌 식으로 전체 자세를 다시 계산(누적 오차·역회전 없음) */
  const pose = (s: ReturnType<typeof governor147>): void => {
    camShaft.rotation.y = s.shaft;
    head.position.set(0, Y0 + K147.rollR + s.lift, ZC);
    head.rotation.y = s.head;
    collar.position.set(0, Y0 + K147.rollR + s.lift + K147.neckUp, ZC);
    lever.rotation.z = s.lever;
    rollerA.rotation.x = s.roll;
    rollerB.rotation.x = s.roll;
    tagHead.position.set(-1.35, 1.6 + s.lift, 0.3);
  };
  pose(governor147(0));

  return {
    group: g,
    view: { pos: [1.0, 2.5, 6.3], target: [0, 1.25, 0.2] },
    notes: () => {
      const s = governor147(theta);
      return [
        { label: '축 속도', value: `기준의 ${s.speed.toFixed(1)}배` },
        { label: '십자머리가 뒤처진 각', value: `${(s.delta * DEG).toFixed(0)}°(날개의 공기 저항)` },
        { label: '올라간 높이', value: `${s.lift.toFixed(3)} (0 ~ 0.099)` },
        {
          label: '밸브 레버',
          value:
            s.lever < -0.001
              ? '왼쪽 끝이 위 — 밸브를 조인다'
              : s.lever > 0.001
                ? '왼쪽 끝이 아래 — 밸브를 연다'
                : '수평 — 밸브 그대로'
        },
        { label: '경사면', value: '한 바퀴에 오르막 둘, 높이 0.125' }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      pose(governor147(theta));
    }
  };
}
