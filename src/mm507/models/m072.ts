// 072 틸트 해머 — 날개 4개 캠(와이퍼 바퀴) B 가 돌면서 해머 A 를 한 바퀴에 네 번 들어 올리고, 떨어진 해머가 모루 위의 쇠를 친다 (판화 72번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, tag } from '../kit';
import { K72, tiltHammer, tiltHammerBed, tiltLift, tiltPeak, wiperCam } from '../kit/k071';

const D2R = Math.PI / 180;
const CAM_Z = 0.1;
const HAM_Z = 0.1;
const CAM_OFFSET = 6.173; // camDeg = theta(도) − 6.173 → t = 1 에서 85.5°(가장 들린 때)
const FALL_END = 9.5; // 접은 camDeg 가 이 값이면 떨어짐이 끝남
const REST_FROM = FALL_END;
const REST_TO = tiltPeak().startDeg; // 25.5
const PEAK = tiltPeak().deg; // 85.5

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM072(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // 고정부: 바닥 판·받침(공 자리)·모루·낮은 대·쇠(workpiece)
  g.add(tiltHammerBed());

  // 캠 B
  const camB = wiperCam(0.14);
  camB.name = 'camB';
  camB.position.set(K72.cam[0], K72.cam[1], CAM_Z);
  g.add(camB);

  // 해머 A — 원점 = 축(공 중심)
  const hammerA = tiltHammer(0.16);
  hammerA.name = 'hammerA';
  hammerA.position.set(K72.pivot[0], K72.pivot[1], HAM_Z);
  g.add(hammerA);

  // 캠 축(뒤판에 받쳐짐)
  g.add(shaftZ(K72.cam[0], K72.cam[1], 0.3));

  // 캠 시계 화살표
  const arr = rotArrow(0.32, false);
  arr.position.set(K72.cam[0], K72.cam[1], 0.22);
  g.add(arr);

  g.add(
    tag('해머 A', v(0.3, 2.6, 0.3)),
    tag('캠(와이퍼 바퀴) B — 날개 4개', v(0.75, 0.62, 0.5)),
    tag('돌기(날개가 밀어 올리는 곳)', v(0.55, 1.32, 0.4)),
    tag('축(공이 오목한 자리에 앉음)', v(1.75, 1.75, 0.3)),
    tag('모루와 벼리는 쇠', v(-1.5, 2.85, 0.3))
  );

  let camDeg = 0;
  let lift = 0;
  const apply = (): void => {
    camDeg = theta / D2R - CAM_OFFSET;
    camB.rotation.z = -camDeg * D2R;
    lift = tiltLift(camDeg);
    hammerA.rotation.z = -lift;
  };
  apply();

  return {
    group: g,
    view: { pos: [0.1, 1.6, 6.4], target: [0, 1.5, 0.1] },
    notes: () => {
      const f = ((((camDeg - 0) % 90) + 90) % 90);
      let state = '쇠 위에 쉼';
      if (f > REST_TO && f <= PEAK) state = '들어 올리는 중';
      else if (f > PEAK || f < REST_FROM) state = '떨어지는 중';
      const hits = Math.max(0, Math.floor((camDeg - FALL_END) / 90) + 1);
      return [
        { label: '날개 4개', value: '캠 한 바퀴에 네 번 침' },
        { label: '상태', value: state },
        { label: '해머 들림', value: `${(lift / D2R).toFixed(1)}° / ${(K72.lift0 / D2R).toFixed(1)}°` },
        { label: '친 횟수', value: `${hits}` },
        { label: '캠 회전수', value: (Math.max(0, camDeg) / 360).toFixed(2) }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
