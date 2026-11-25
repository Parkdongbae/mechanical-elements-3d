// 121 디스크 휠과 클릭 — 막대의 오르내림이 디스크를 흔들고, 디스크에 달린 걸쇠(클릭)가 코그휠을 한 방향으로 간헐 회전시킨다 (판화 121번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, tag, leaderTo } from '../kit';
import { K121, cogWheel121, click121, diskWheel121, feed121 } from '../kit/k119';
import { connectingRod, crosshead, guideFrame } from '../kit/k092';

const CX = -0.3; // 축 중심 x
const CY = 1.3; // 축 중심 y
const ZD = -0.05; // 디스크 가운데 평면
const ZG = 0.04; // 코그휠·걸쇠 평면
const ZL = 0.05; // 막대 평면
const GX = CX + K121.guideX; // 안내틀 가운데선
const ZS = -0.16; // 안내틀·블록 가운데 평면
const DEG = 180 / Math.PI;

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM121(): MovementModel {
  const g = new THREE.Group();
  let theta = 1.6; // 시작 = 판화 자세(미는 행정의 끝)

  g.add(displayStand());

  // 디스크 휠(흔들림) — 앞면에 걸쇠 못과 막대 못
  const disk = diskWheel121();
  disk.name = 'disk';
  disk.position.set(CX, CY, ZD);
  g.add(disk);

  // 걸쇠 — 디스크의 자식, 못 자리에 둔다
  const click = click121();
  click.name = 'click';
  const cp = disk.getObjectByName('clickPivot');
  if (cp) click.position.copy(cp.position);
  click.position.z = ZG - ZD;
  disk.add(click);

  // 코그휠 + 이송 축(한 몸)
  const cog = cogWheel121();
  cog.name = 'cog';
  cog.position.set(CX, CY, ZG);
  g.add(cog);
  const shaft = shaftZ(CX, CY, 0.17, 0.06);
  shaft.name = 'feedShaft';
  g.add(shaft);

  // 막대 — 원점 = 막대 못
  const rod = connectingRod(K121.rod);
  rod.name = 'rod';
  g.add(rod);

  // 미끄럼 블록(판화에 없음) + 세로 안내틀
  const slider = crosshead(0.3, 0.374, { pinZ: 0.21, pinTop: 0.27 });
  slider.name = 'slider';
  slider.rotation.z = Math.PI / 2;
  g.add(slider);
  const guide = guideFrame(0.8, 0.38, { back: 0.14 });
  guide.name = 'guide';
  guide.rotation.z = Math.PI / 2;
  guide.position.set(GX, 2.17, ZS);
  g.add(guide);

  const arrow = rotArrow(0.3, false);
  arrow.position.set(CX, CY, 0.17);
  g.add(arrow);

  const rodTag = tag('막대', v(1.2, 1.6, 0.3));
  g.add(
    tag('디스크', v(-1.6, 0.45, 0.3)),
    leaderTo(tag('코그휠', v(0.95, 0.45, 0.3)), 'cog'),
    leaderTo(tag('걸쇠(클릭)', v(-0.9, 2.78, 0.3)), 'click'),
    rodTag,
    tag('미끄럼 블록', v(1.5, 2.6, 0.3))
  );

  let cur = feed121(theta);
  const apply = (): void => {
    cur = feed121(theta);
    disk.rotation.z = cur.disk;
    click.rotation.z = cur.click;
    cog.rotation.z = cur.cog;
    shaft.rotation.z = cur.cog;
    rod.position.set(CX + cur.pin[0], CY + cur.pin[1], ZL);
    rod.rotation.z = cur.rodAngle;
    slider.position.set(GX, CY + cur.top, ZS);
    arrow.visible = cur.driving;
    rodTag.position.set(1.2, CY + (cur.pin[1] + cur.top) / 2 - 0.2, 0.3); // 막대를 따라 오르내린다
  };
  apply();

  return {
    group: g,
    view: { pos: [0, 1.75, 6.4], target: [0, 1.6, 0] },
    notes: () => {
      const tooth = ((-(cur.cog - feed121(1.6).cog) * DEG) / (360 / K121.teeth)) | 0;
      const lift = ((cur.click - feed121(1.6).click) * DEG);
      return [
        { label: '상태', value: cur.v <= Math.PI ? '미는 중(막대 내려감)' : '돌아가는 중(걸쇠가 이를 타 넘음)' },
        { label: '디스크 흔들림', value: '30° = 이 2개(27.7°) + 헛걸음 2.3°' },
        { label: '코그휠', value: `${K121.teeth}개 중 ${(((tooth % K121.teeth) + K121.teeth) % K121.teeth) + 1}번째 이, 한 번에 2개씩` },
        { label: '걸쇠 들림', value: `${Math.abs(Math.round(lift))}°` },
        { label: '방향', value: '걸쇠를 반대로 넘기면 회전 방향이 바뀐다(모형은 한 방향만)' }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
