// 미션 기계 정의: 자전거 / 시계 / 러닝머신 / 자동차 조향 장치

import type { Machine } from '../machines/types';
import { Bicycle } from '../machines/Bicycle';
import { Clock } from '../machines/Clock';
import { Treadmill } from '../machines/Treadmill';
import { Steering } from '../machines/Steering';
import { GearHunt } from '../machines/GearHunt';
import { SteelFrame } from '../machines/SteelFrame';
import { MerryGoRound } from '../machines/MerryGoRound';
import { DrivetrainFF } from '../machines/DrivetrainFF';
import { DrivetrainFR } from '../machines/DrivetrainFR';

export interface StepDef {
  partId: string;
  label: string;
}

export interface MachineDef {
  id: string;
  name: string;
  icon: string;
  missionText: string;
  hint: string;
  completeText: string;
  steps: StepDef[];
  /** 이 머신에서만 부품 표시 이름을 바꿈 (예: 전동축 → 구동축) */
  nameOverrides?: Record<string, string>;
  create(): Machine;
}

export const MACHINES: MachineDef[] = [
  {
    id: 'bicycle',
    name: '자전거',
    icon: '🚲',
    missionText: '차축 → 크랭크축 → 스프로킷 → 체인 → 평행 핀 → 스프링 순서로 자전거를 조립하세요!',
    hint: '축용 차축을 양쪽 바퀴 자리에 장착하면 바퀴가 자동으로 올라가요! 크랭크축을 장착하면 앞 스프로킷도 함께 장착되고, 이어서 전동용 스프로킷·체인, 평행 핀, 마지막엔 안장 밑 스프링(제어용)이 들어가요!',
    completeText: '페달을 밟으면 동력이 전달돼요 🚲💨',
    steps: [
      { partId: 'axle', label: '차축' },
      { partId: 'crankShaft', label: '크랭크축' },
      { partId: 'sprocket', label: '스프로킷' },
      { partId: 'chain', label: '체인' },
      { partId: 'pinParallel', label: '평행 핀' },
      { partId: 'spring', label: '스프링' }
    ],
    create: () => new Bicycle()
  },
  {
    id: 'clock',
    name: '시계',
    icon: '⏰',
    missionText: '태엽(스프링)과 기어가 빠진 시계를 고쳐 보세요!',
    hint: '태엽 드럼에는 동력의 원천이 들어가고, 시계 중앙에는 분침을 돌리는 가장 기본적인 기어가 필요해요!',
    completeText: '태엽이 풀리며 바늘이 돌아가요 ⏰',
    steps: [
      { partId: 'spring', label: '스프링(태엽)' },
      { partId: 'spurGear', label: '평 기어' }
    ],
    create: () => new Clock()
  },
  {
    id: 'treadmill',
    name: '러닝머신',
    icon: '🏃',
    missionText: '베어링과 벨트가 빠진 러닝머신을 고쳐 보세요!',
    hint: '모터 롤러는 마찰을 줄이는 부품이 필요하고, 두 롤러 사이는 조용히 동력을 전달하는 전동용 부품으로 연결해요!',
    completeText: '모터가 롤러를 돌려 벨트가 달려요 🏃💨',
    steps: [
      { partId: 'bearing', label: '볼 베어링' },
      { partId: 'beltPulley', label: '벨트와 풀리' }
    ],
    create: () => new Treadmill()
  },
  {
    id: 'steering',
    name: '자동차 핸들',
    icon: '🚗',
    missionText: '래크와 피니언, 링크가 빠진 자동차 핸들을 고쳐 보세요!',
    hint: '핸들의 회전 운동을 직선 운동으로 바꾸는 기어와, 래크의 움직임을 바퀴에 전달하는 연결 막대가 필요해요!',
    completeText: '핸들이 돌아가면 바퀴가 방향을 바꿔요 🚗',
    steps: [
      { partId: 'rackPinion', label: '래크와 피니언' },
      { partId: 'link', label: '링크' }
    ],
    create: () => new Steering()
  },
  {
    id: 'gearhunt',
    name: '기어의 종류',
    icon: '🔍',
    missionText: '부품을 동력이 전달되는 순서대로 드래그해서 조립하세요!',
    hint: '구동 평기어가 이미 돌고 있어요! 평기어1 → 베벨 기어 → 웜 → 웜휠 → 피니언 → 래크 순서로 동력이 흘러가요.',
    completeText: '기어 장치가 완성됐어요 ⚙️',
    steps: [],
    create: () => new GearHunt()
  },
  {
    id: 'steelframe',
    name: '철골공사',
    icon: '🏗️',
    missionText: '기둥과 들보가 놓여 있는 철골 구조물! 부재들을 튼튼하게 연결할 기계요소를 아래에서 찾아 선택하세요!',
    hint: '철골 부재를 힘 있게 묶으려면 수나사(볼트)와 암나사(너트)가 맞물린 결합용 기계요소가 필요해요!',
    completeText: '볼트와 너트로 기둥과 들보가 튼튼하게 체결됐어요 🏗️',
    steps: [{ partId: 'bolt', label: '나사(볼트와 너트)' }],
    create: () => new SteelFrame()
  },
  {
    id: 'drivetrain-ff',
    name: 'FF 전륜구동',
    icon: '🚙',
    missionText: '전륜구동(FF) 자동차예요! 엔진의 동력을 앞바퀴에 전달하는 축과, 바퀴를 받쳐 주는 축을 순서대로 찾아 선택하세요!',
    hint: '모터(엔진)와 맞물려 회전하며 동력을 전달하는 축은 구동축, 바퀴의 회전 중심을 받쳐 주는 축은 차축이에요! 구동축을 먼저 찾으세요.',
    completeText: '구동축과 모든 바퀴가 함께 회전해요 🚙💨',
    nameOverrides: { driveShaft: '구동축' },
    steps: [
      { partId: 'driveShaft', label: '구동축' },
      { partId: 'axle', label: '차축' }
    ],
    create: () => new DrivetrainFF()
  },
  {
    id: 'drivetrain-fr',
    name: 'FR 후륜구동',
    icon: '🚗',
    missionText: '후륜구동(FR) 자동차예요! 엔진의 동력이 지나가는 축과, 바퀴를 받쳐 주는 축을 순서대로 찾아 선택하세요!',
    hint: '모터(엔진)와 맞물려 회전하며 동력을 전달하는 축은 구동축, 바퀴의 회전 중심을 받쳐 주는 축은 차축이에요! 앞 차축(차축)을 먼저 찾으세요.',
    completeText: '프로펠러 샤프트와 반축을 타고 뒷바퀴가 힘차게 회전해요 🚗💨',
    nameOverrides: { driveShaft: '구동축' },
    steps: [
      { partId: 'axle', label: '차축' },
      { partId: 'driveShaft', label: '구동축' },
      { partId: 'driveShaft', label: '구동축' }
    ],
    create: () => new DrivetrainFR()
  },
  {
    id: 'merryround',
    name: '회전놀이기구',
    icon: '🎠',
    missionText: '회전 놀이기구가 빙글빙글 돌아가려면 축을 부드럽게 받쳐 주는 기계요소가 필요해요! 아래에서 찾아 선택하세요!',
    hint: '회전판과 축 사이에서 구슬(볼)이 굴러가며 마찰을 줄이는 축용 기계요소가 필요해요!',
    completeText: '볼 베어링 덕분에 회전 놀이기구가 부드럽게 돌아가요 🎠',
    steps: [{ partId: 'bearing', label: '볼 베어링' }],
    create: () => new MerryGoRound()
  }
];

export function getMachineDef(id: string): MachineDef {
  const found = MACHINES.find((m) => m.id === id);
  if (!found) throw new Error(`Unknown machine: ${id}`);
  return found;
}
