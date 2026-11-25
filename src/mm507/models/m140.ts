// 140 펀칭 기계의 토글 조인트 — ㄱ자 레버가 수평 연결 링크로 무릎을 누르면 두 토글 링크가 펴지며 램(펀치)이 내려찍는다 (판화 140번)
//  (설계표 docs/mm507-sheets/140.md, 키트 kit/k140.ts 공용 — 모델은 배치·toggle140 대입, 링크 셋은 공용 geom)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, setMM, tag } from '../kit';
import { K140, barLen140, kneePin140, pressFrame140, pressRam140, toggle140, toggleLever140 } from '../kit/k140';
import { extrude, lathe, mesh, stadiumShape, tubeProfile } from '../../models/parts/geom';
import { steel } from '../../models/materials';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM140(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 프레임(고정): 받침판·옆판·기둥·고스넥·A 핀·받침 핀 O·안내 레일 — child 'pinA'·'pivotO'
  const frame = pressFrame140();
  frame.name = 'frame';
  g.add(frame);

  // 램(펀치 슬라이드): 원점 = 램 핀 S, 뒷면이 옆판 앞면(z 0)에 닿는다 — child 'ramPin'
  const ram = pressRam140();
  ram.name = 'ram';
  g.add(ram);

  // ㄱ자 레버: 원점 = 받침 핀 O, 아래 링크 층 — child 'leverPin'
  const lever = toggleLever140();
  lever.name = 'lever';
  lever.position.set(K140.O[0], K140.O[1], K140.zLow);
  g.add(lever);

  // 무릎 핀: 세 링크를 한꺼번에 꿴다(키트가 이름 'knee')
  const knee = kneePin140();
  g.add(knee);

  // 링크 셋 — 공용 geom: 판 막대(폭 0.09·두께 0.05) + 양 끝 눈(바깥 0.055·구멍 0.03)
  const L = K140.link;
  const barLen = barLen140();
  const plate = extrude(stadiumShape(0, 0, L, 0, 0.045), 0.05, 0.006); // 0.74 링크 둘이 나눠 쓴다
  const plateBar = extrude(stadiumShape(0, 0, barLen, 0, 0.045), 0.05, 0.006);
  const eye = lathe(tubeProfile(0.03, 0.055, -0.025, 0.025, 0.005), 32);
  eye.rotateX(Math.PI / 2); // Y축 관 → Z축 관
  const mkLink = (name: string, len: number, pl: THREE.BufferGeometry): THREE.Group => {
    const link = new THREE.Group();
    link.name = name;
    link.add(mesh(pl, steel()));
    for (const x of [0, len]) {
      const e = mesh(eye, steel());
      e.position.x = x;
      link.add(e);
    }
    setMM(link, { kind: 'link', length: len, a: [0, 0, 0], b: [len, 0, 0] });
    return link;
  };
  const upLink = mkLink('upLink', L, plate); // A ↔ K
  const lowLink = mkLink('lowLink', L, plate); // K ↔ S
  const bar = mkLink('bar', barLen, plateBar); // K ↔ P
  g.add(upLink, lowLink, bar);

  // 회전 방향 화살표 2개(누름 = 시계, 복귀 = 반시계) — 받침 핀 O 자리에 겹치고 하나만 보인다
  const arrowPress = rotArrow(0.18, false);
  const arrowBack = rotArrow(0.18, true);
  arrowPress.position.set(K140.O[0], K140.O[1], 0.22);
  arrowBack.position.copy(arrowPress.position);
  g.add(arrowPress, arrowBack);

  // 이름표 6개 — 넷은 부품을 따라가고 둘은 고정(z 0.3)
  const tagLever = tag('ㄱ자 레버(구동)', v(1.5, 2.6, 0.3));
  const tagKnee = tag('토글 무릎', v(-1.0, 2.0, 0.3));
  const tagRam = tag('램·펀치', v(-1.0, 1.2, 0.3));
  const tagBar = tag('가로 링크', v(-0.2, 2.3, 0.3));
  g.add(
    tagLever,
    tagKnee,
    tagRam,
    tagBar,
    tag('안내 레일(고정)', v(0.15, 1.05, 0.3)),
    tag('프레임·받침판(고정)', v(0.6, 0.35, 0.3))
  );

  const [ax, ay] = K140.A;
  return {
    group: g,
    view: { pos: [0, 1.75, 6.4], target: [0, 1.55, 0] },
    notes: () => {
      const a = toggle140(theta);
      const deg = (a.lever * 180) / Math.PI;
      return [
        { label: '레버 각', value: `${deg >= 0 ? '+' : ''}${deg.toFixed(1)}° (누름 −52.5°까지)` },
        { label: '무릎 치우침', value: `${a.off.toFixed(3)} (0.104 ~ 0.390 — 0에 가까울수록 펴짐)` },
        { label: '램 내려간 거리', value: `${a.drop.toFixed(3)} (행정 0.208)` },
        { label: '토글의 힘', value: '무릎이 펴질수록 붙는다(끝에서 약 22배)' }
      ];
    },
    update(dt: number, speed: number): void {
      // 절대 자세를 theta 의 닫힌 식으로 — 역회전·누적 오차 없음
      theta += OMEGA * speed * dt;
      const a = toggle140(theta);
      lever.rotation.z = a.lever;
      knee.position.set(a.K[0], a.K[1], 0);
      ram.position.set(a.S[0], a.S[1], 0); // S 는 늘 A 의 세로선 위
      // 링크 셋: 두 핀 자리에 대입(눈 구멍이 핀 위에서 돈다)
      upLink.position.set(ax, ay, K140.zUp);
      upLink.rotation.z = a.upAng;
      lowLink.position.set(a.K[0], a.K[1], K140.zLow);
      lowLink.rotation.z = a.lowAng;
      bar.position.set(a.K[0], a.K[1], K140.zBar);
      bar.rotation.z = a.barAng;
      // 누름 반 주기(원! sin > 0)에만 시계 화살표
      const press = Math.sin(theta - 1.6) >= 0;
      arrowPress.visible = press;
      arrowBack.visible = !press;
      // 따라가는 이름표
      const hx = K140.O[0] + K140.handle * Math.cos(a.lever);
      const hy = K140.O[1] + K140.handle * Math.sin(a.lever);
      tagLever.position.set(hx + 0.22, hy + 0.1, 0.3);
      tagKnee.position.set(a.K[0] - 0.28, a.K[1] + 0.06, 0.3);
      tagRam.position.set(a.S[0] - 0.42, a.S[1] - 0.1, 0.3);
      tagBar.position.set((a.K[0] + a.P[0]) / 2, (a.K[1] + a.P[1]) / 2 + 0.22, 0.3);
    }
  };
}
