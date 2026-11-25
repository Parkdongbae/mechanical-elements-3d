// 155 래칫 이송 장치 — 블록의 왕복 → 엘보 레버의 흔들림 → 폴이 네모 이 톱니바퀴를 한 번 왕복에 2이씩 민다 (판화 155번)
//  설계표 docs/mm507-sheets/155.md · 부품은 kit/k155 + kit/k092(연결봉·안내틀·크로스헤드) 조립만 한다
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rod, rotArrow, shaftZ, tag, leaderTo } from '../kit';
import { K155, WHEEL_REF155, elbowLever155, guidedRod, pawl155, squareToothWheel, state155 } from '../kit/k155';
import { connectingRod, crosshead, guideFrame } from '../kit/k092';

const DEG = 180 / Math.PI;
const CX = -0.15; // 바퀴·레버의 동심 축 x
const CY = 1.3; // 바퀴·레버의 동심 축 y
const GX = 0.705; // 세로 안내틀 가운데선 x (CX + 0.855)
const ZG = 0.3; // 안내틀·블록의 가운데 평면
const ZR = 0.425; // 연결봉 평면(레버 핀·손목 핀 표식과 같은 z)

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM155(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 축(고정) — 뒤판 보스에서 나와 바퀴 구멍(풀리게)·레버 구멍(풀리게)을 꿴다
  const axle = shaftZ(CX, CY, 0.34, 0.085);
  axle.name = 'axle';
  g.add(axle);

  // 네모 이 톱니바퀴(종동, kind 'ratchet') — 축에 풀리게 끼워 따로 돈다
  const wheel = squareToothWheel();
  wheel.name = 'wheel';
  wheel.position.set(CX, CY, -0.005);
  g.add(wheel);

  // 엘보 레버 — 위 팔(+Y) 끝 핀에 폴, 옆 팔(+X) 끝 핀에 연결봉
  const lever = elbowLever155(0.15, 0.255);
  lever.name = 'lever';
  lever.position.set(CX, CY, 0.2);
  g.add(lever);

  // 폴(황동) — 레버 그룹의 자식으로 위 팔 핀에 매달려 들림각만큼 흔들린다
  const pawl = pawl155();
  pawl.name = 'pawl';
  pawl.position.set(0, K155.arm, -0.11);
  lever.add(pawl);

  // 연결봉 — 원점 = 옆 팔 핀, +X 를 블록 손목 핀 쪽으로
  const rodM = connectingRod(K155.rod, { barHalf: 0.055 });
  rodM.name = 'rod';
  g.add(rodM);

  // 세로 안내틀(고정) — ㄷ자 틀을 90° 세워 끝 막이가 아래, 두 가로대가 양옆 세로 레일
  const guide = guideFrame(0.95, 0.24, { barH: 0.13, depth: 0.12, back: 0 });
  guide.name = 'guide';
  guide.rotation.z = Math.PI / 2;
  guide.position.set(GX, 1.5, ZG);
  g.add(guide);

  // 크로스헤드(왕복 블록) — 안내틀 틈 속을 오르내린다. 손목 핀을 눈(0.455) 밖까지(0.65) 길게 해
  //  연결봉 막대 끝이 핀에 박히지 않게 한다(레버 핀과 같은 긴 핀)
  const block = crosshead(0.26, 0.234, { faceH: 0.31, faceT: 0.03, pinZ: 0.125, pinTop: 0.35 });
  block.name = 'block';
  block.rotation.z = Math.PI / 2;
  g.add(block);

  // 안내틀 받침 막대 셋(고정, 판화에 없는 보충) — 뒤판 앞면에서 틀 뒷면까지
  for (const [x, y] of [[0.89, 1.614], [0.89, 2.355], [GX, 1.43]] as const) {
    g.add(rod(v(x, y, -0.3), v(x, y, 0.24), 0.03));
  }

  // 회전 방향 화살표(시계) — 축 너트(0.34) 앞이라 레버·바퀴를 가리지 않는다
  const arrow = rotArrow(0.34, false);
  arrow.position.set(CX, CY, 0.38);
  g.add(arrow);

  // 이름표 5개 — 레버·폴·블록은 움직이는 부품을 따라간다
  const tagLever = tag('엘보 레버', v(0, 0, 0.4));
  const tagPawl = tag('폴', v(0, 0, 0.4));
  const tagBlock = leaderTo(tag('왕복 블록', v(0, 0, 0.4)), block);
  g.add(tag('톱니바퀴(22이)', v(-1.3, 2.15, 0.3)), tagLever, tagPawl, tagBlock, tag('안내틀(고정)', v(1.45, 2.72, 0.3)));

  /** theta 의 닫힌 식으로 전체 자세를 다시 계산(누적 오차·역회전 없음) */
  const pose = (th: number): void => {
    const A = state155(th);
    wheel.rotation.z = WHEEL_REF155 + A.wheel;
    lever.rotation.z = A.lever;
    pawl.rotation.z = A.lift;
    // 옆 팔 핀 P → 세로 안내에 묶인 연결봉 풀이(블록은 안내선 x = GX 위)
    const px = CX + K155.arm * Math.cos(A.lever);
    const py = CY + K155.arm * Math.sin(A.lever);
    const gr = guidedRod([px, py], GX, K155.rod, 1);
    rodM.position.set(px, py, ZR);
    rodM.rotation.z = gr.angle;
    block.position.set(GX, gr.end[1], ZG);
    // 위 팔 끝 = 레버 로컬 (0, arm) 회전 → (CX − arm·sin, CY + arm·cos)
    tagLever.position.set(CX - K155.arm * Math.sin(A.lever) - 0.4, CY + K155.arm * Math.cos(A.lever) + 0.12, 0.4);
    // 폴 꼭대기(손잡이 뿔) = 레버 → 폴 이중 회전
    const hx = K155.horn[0] * Math.cos(A.lift) - K155.horn[1] * Math.sin(A.lift);
    const hy = K155.arm + K155.horn[0] * Math.sin(A.lift) + K155.horn[1] * Math.cos(A.lift);
    // 폴 이름표는 뿔 왼쪽 위 — 오른쪽 +0.3 은 안내틀 상자에 들어가 가려진다
    tagPawl.position.set(
      CX + hx * Math.cos(A.lever) - hy * Math.sin(A.lever) - 0.3,
      CY + hx * Math.sin(A.lever) + hy * Math.cos(A.lever) + 0.16,
      0.4
    );
    tagBlock.position.set(GX + 0.45, gr.end[1], 0.4);
  };
  pose(0);

  return {
    group: g,
    view: { pos: [0, 1.7, 6.4], target: [0, 1.55, 0] },
    notes: () => {
      const A = state155(theta);
      const phase = A.phase === 'drive' ? '밀는 중' : A.phase === 'takeup' ? '헛걸음' : '되돌림';
      return [
        { label: '상태', value: phase },
        { label: '보낸 이 수', value: `${A.fed.toFixed(1)}개` },
        { label: '레버 기울기', value: `${(A.lever * DEG).toFixed(1)}°` },
        { label: '폴 들림', value: `${(A.lift * DEG).toFixed(1)}°` },
        { label: '설명', value: '폴이 되돌아갈 때 이 등을 넘어 다음 이골로 떨어진다 — 바퀴는 밀리는 반쪽에만 2이씩 돈다' }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      pose(theta);
    }
  };
}
