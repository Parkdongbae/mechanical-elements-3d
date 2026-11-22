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
import { DrivetrainAWD } from '../machines/DrivetrainAWD';
import { DrivetrainEVSingle } from '../machines/DrivetrainEVSingle';
import { DrivetrainEVDual } from '../machines/DrivetrainEVDual';
import { CamAutomata } from '../machines/CamAutomata';
import { DiscBrakeRig } from '../machines/DiscBrakeRig';
import { Wiper } from '../machines/Wiper';
import { HandDrill } from '../machines/HandDrill';
import { SewingMachine } from '../machines/SewingMachine';
import { BikeBrake } from '../machines/BikeBrake';
import { DynamoLight } from '../machines/DynamoLight';
import { HandCart } from '../machines/HandCart';
import { CarEngine } from '../machines/CarEngine';
import { Gearbox } from '../machines/Gearbox';
import { Lathe } from '../machines/Lathe';
import { Winch } from '../machines/Winch';
import { Conveyor } from '../machines/Conveyor';
import { Microwave } from '../machines/Microwave';
import { DrumWasher } from '../machines/DrumWasher';
import type { CameraView } from '../scene/SceneSetup';

export interface StepDef {
  partId: string;
  label: string;
}

/** 홈 화면 미션 묶음 */
export type MachineGroupId = 'life' | 'car' | 'drivetrain' | 'build';

export const MACHINE_GROUPS: { id: MachineGroupId; name: string; desc: string }[] = [
  { id: 'life', name: '생활 속 기계', desc: '매일 쓰는 물건 속 기계요소' },
  { id: 'car', name: '자동차 장치', desc: '조향·제동·와이퍼의 원리' },
  { id: 'drivetrain', name: '자동차 구동방식', desc: '엔진·모터의 힘이 바퀴까지' },
  { id: 'build', name: '기어와 구조물', desc: '기어 장치와 철골 구조' }
];

export interface MachineDef {
  id: string;
  group: MachineGroupId;
  /** 홈 카드에 표시할 한 줄 소개 */
  summary: string;
  /** 이 기계에 맞는 기본 카메라 시점 (없으면 DEFAULT_VIEW) */
  view?: CameraView;
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
    view: { pos: [3.4, 3, 6.2], target: [-0.2, 1.6, 0] },
    group: 'life',
    summary: '페달의 힘이 체인을 타고 뒷바퀴로',
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
    view: { pos: [1.5, 2.4, 4.7], target: [0, 1.55, -0.1] },
    group: 'life',
    summary: '태엽과 기어가 바늘을 돌려요',
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
    view: { pos: [3.5, 3.6, 6.2], target: [0.6, 1.15, 0] },
    group: 'life',
    summary: '모터와 벨트로 달리는 바닥',
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
    view: { pos: [2.8, 2.4, -2.2], target: [0.15, 0.5, 0.15] },
    group: 'car',
    summary: '핸들의 회전이 바퀴 방향으로',
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
    view: { pos: [3.7, 3.1, 5.7], target: [0, 0.9, 0] },
    group: 'build',
    summary: '다섯 가지 기어를 순서대로 조립',
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
    view: { pos: [3, 2.4, 4.6], target: [0, 1, 0] },
    group: 'build',
    summary: '기둥과 들보를 볼트로 체결',
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
    view: { pos: [2.7, 2.3, 3.9], target: [0, 0.4, 0] },
    group: 'drivetrain',
    summary: '엔진이 앞바퀴를 굴려요',
    name: 'FF 전륜구동',
    icon: '🚙',
    missionText: '전륜구동(FF) 자동차예요! 엔진의 동력을 앞바퀴에 전달하는 축과, 바퀴를 받쳐 주는 축을 순서대로 찾아 선택하세요!',
    hint: '모터(엔진)와 맞물려 회전하며 동력을 전달하는 축은 구동축, 바퀴의 회전 중심을 받쳐 주는 축은 차축이에요! 구동축을 먼저 찾으세요.',
    completeText: '구동축과 앞바퀴가 함께 회전해요 🚙💨',
    nameOverrides: { driveShaft: '구동축' },
    steps: [
      { partId: 'driveShaft', label: '구동축' },
      { partId: 'axle', label: '차축' }
    ],
    create: () => new DrivetrainFF()
  },
  {
    id: 'drivetrain-fr',
    view: { pos: [2.7, 2.3, 3.9], target: [0, 0.4, 0] },
    group: 'drivetrain',
    summary: '엔진의 힘을 뒷바퀴까지',
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
    id: 'drivetrain-awd',
    view: { pos: [2.7, 2.3, 3.9], target: [0, 0.4, 0] },
    group: 'drivetrain',
    summary: '네 바퀴 모두에 동력을',
    name: 'AWD 사륜구동',
    icon: '🚘',
    missionText: '사륜구동(AWD) 자동차예요! 엔진의 동력이 네 바퀴까지 전달되는 구동축들을 순서대로 찾아 선택하세요!',
    hint: '엔진의 동력을 전달하는 축은 모두 구동축이에요! 센터 디퍼렌셜에서 갈라져 앞바퀴로 가는 전동축을 먼저 찾으세요!',
    completeText: '센터 디퍼렌셜을 거쳐 네 바퀴가 힘차게 회전해요 🚘💨',
    nameOverrides: { driveShaft: '구동축' },
    steps: [
      { partId: 'driveShaft', label: '구동축' },
      { partId: 'driveShaft', label: '구동축' },
      { partId: 'driveShaft', label: '구동축' }
    ],
    create: () => new DrivetrainAWD()
  },
  {
    id: 'ev-single',
    view: { pos: [2.7, 2.3, 3.9], target: [0, 0.4, 0] },
    group: 'drivetrain',
    summary: '모터 하나로 달리는 전기차',
    name: '싱글 모터(2WD)',
    icon: '⚡',
    missionText: '싱글 모터(2WD) 전기차예요! 모터의 동력을 전달하는 축과 바퀴를 받쳐 주는 축을 순서대로 찾아 선택하세요!',
    hint: '모터의 동력을 전달하는 축은 구동축, 바퀴의 회전 중심을 받쳐 주는 축은 차축이에요! 구동축을 먼저 찾으세요.',
    completeText: '구동축과 앞바퀴가 함께 회전해요 ⚡',
    nameOverrides: { driveShaft: '구동축' },
    steps: [
      { partId: 'driveShaft', label: '구동축' },
      { partId: 'axle', label: '차축' }
    ],
    create: () => new DrivetrainEVSingle()
  },
  {
    id: 'ev-dual',
    view: { pos: [2.7, 2.3, 3.9], target: [0, 0.4, 0] },
    group: 'drivetrain',
    summary: '앞뒤 모터로 네 바퀴 구동',
    name: '듀얼 모터(AWD)',
    icon: '⚡',
    missionText: '듀얼 모터(AWD) 전기차예요! 네 바퀴에 동력을 전달하는 구동축들을 순서대로 찾아 선택하세요!',
    hint: '모터의 동력을 전달하는 축은 모두 구동축이에요! 앞바퀴로 가는 구동 반축을 먼저 찾으세요.',
    completeText: '두 모터의 힘으로 네 바퀴가 힘차게 회전해요 ⚡',
    nameOverrides: { driveShaft: '구동축' },
    steps: [
      { partId: 'driveShaft', label: '구동축' },
      { partId: 'driveShaft', label: '구동축' }
    ],
    create: () => new DrivetrainEVDual()
  },
  {
    id: 'merryround',
    view: { pos: [3, 2.6, 4.6], target: [0, 0.7, 0] },
    group: 'life',
    summary: '베어링으로 부드럽게 빙글빙글',
    name: '회전놀이기구',
    icon: '🎠',
    missionText: '회전 놀이기구가 빙글빙글 돌아가려면 축을 부드럽게 받쳐 주는 기계요소가 필요해요! 아래에서 찾아 선택하세요!',
    hint: '회전판과 축 사이에서 구슬(볼)이 굴러가며 마찰을 줄이는 축용 기계요소가 필요해요!',
    completeText: '볼 베어링 덕분에 회전 놀이기구가 부드럽게 돌아가요 🎠',
    steps: [{ partId: 'bearing', label: '볼 베어링' }],
    create: () => new MerryGoRound()
  },
  {
    id: 'automata',
    view: { pos: [2.9, 2.3, 4], target: [0.1, 0.85, 0] },
    group: 'life',
    summary: '손잡이를 돌리면 인형이 오르락내리락',
    name: '캠 오토마타',
    icon: '🎪',
    missionText: '손잡이를 돌려도 인형이 움직이지 않는 오토마타 장난감! 회전을 전달하는 축과, 회전을 위아래 움직임으로 바꾸는 기계요소를 찾아 조립하세요!',
    hint: '손잡이와 함께 회전하며 동력을 전달하는 축(축용)을 먼저 끼우고, 그 축에 달걀 모양으로 생긴 전동용 기계요소를 달아 주세요!',
    completeText: '캠이 회전하며 인형을 위아래로 움직여요 🎪',
    steps: [
      { partId: 'driveShaft', label: '전동축' },
      { partId: 'cam', label: '캠' }
    ],
    create: () => new CamAutomata()
  },
  {
    id: 'discbrake',
    view: { pos: [3.9, 3.2, 5.2], target: [-0.35, 1.8, 0.2] },
    group: 'car',
    summary: '달리는 바퀴를 패드로 꽉 잡아 멈춰요',
    name: '디스크 브레이크',
    icon: '🛞',
    missionText: '자동차 바퀴가 잘 돌고 잘 멈추게 해 주세요! 바퀴를 매끄럽게 돌게 하는 기계요소와, 바퀴를 멈추게 하는 기계요소를 찾아 조립하세요!',
    hint: '허브 안에서 구슬이 굴러 마찰을 줄이는 축용 기계요소를 먼저 끼우고, 회전하는 원판을 패드로 집어 멈추는 제어용 기계요소를 달아 주세요!',
    completeText: '브레이크를 밟으면 패드가 디스크를 잡아 바퀴가 멈춰요 🛞',
    steps: [
      { partId: 'bearing', label: '볼 베어링' },
      { partId: 'discBrake', label: '디스크 브레이크' }
    ],
    create: () => new DiscBrakeRig()
  },
  {
    id: 'wiper',
    view: { pos: [1.6, 4.4, 5.6], target: [0.1, 1.3, 0.2] },
    group: 'car',
    summary: '모터의 회전이 와이퍼의 왕복 운동으로',
    name: '와이퍼',
    icon: '🌧️',
    missionText: '비가 오는데 와이퍼가 움직이지 않아요! 모터의 빠른 회전을 크게 줄여 주는 기어와, 회전을 좌우 왕복 운동으로 바꾸는 기계요소를 찾아 조립하세요!',
    hint: '큰 감속비가 필요할 때 쓰는 나사 모양 기어(전동용)를 먼저 끼우고, 막대를 핀으로 이어 운동을 바꾸는 전동용 기계요소를 연결하세요!',
    completeText: '웜 기어가 속도를 줄이고 링크가 와이퍼를 좌우로 움직여요 🌧️',
    steps: [
      { partId: 'wormGear', label: '웜과 웜 기어' },
      { partId: 'link', label: '링크' }
    ],
    create: () => new Wiper()
  },
  {
    id: 'handdrill',
    group: 'life',
    summary: '손잡이의 회전이 직각으로 꺾여 드릴 날로',
    name: '핸드 드릴',
    icon: '🪛',
    missionText: '손잡이를 돌려도 드릴 날이 돌지 않는 핸드 드릴! 직각으로 만나는 두 축 사이에 동력을 전달하는 기어와, 드릴 날까지 회전을 전달하는 축을 찾아 조립하세요!',
    hint: '원뿔 모양으로 생겨 직각으로 만나는 두 축을 이어 주는 전동용 기어를 먼저 끼우고, 회전체와 함께 돌며 동력을 전달하는 축(축용)을 끼워 주세요!',
    completeText: '베벨 기어가 회전 방향을 직각으로 바꿔 드릴 날이 돌아요 🪛',
    steps: [
      { partId: 'bevelGear', label: '베벨 기어' },
      { partId: 'driveShaft', label: '전동축' }
    ],
    create: () => new HandDrill()
  },
  {
    id: 'sewing',
    group: 'life',
    summary: '모터의 회전이 바늘의 위아래 운동으로',
    name: '재봉틀',
    icon: '🧵',
    missionText: '바늘이 움직이지 않는 재봉틀! 멀리 떨어진 모터의 힘을 조용히 전달하는 기계요소와, 회전 운동을 바늘의 왕복 운동으로 바꾸는 축을 찾아 조립하세요!',
    hint: '두 축의 거리가 멀 때 마찰력으로 조용히 동력을 전달하는 전동용 기계요소를 먼저 걸고, 회전 운동과 왕복 운동을 서로 바꾸는 축(축용)을 끼워 주세요!',
    completeText: '벨트가 모터의 힘을 전하고 크랭크축이 바늘을 위아래로 움직여요 🧵',
    steps: [
      { partId: 'beltPulley', label: '벨트와 풀리' },
      { partId: 'crankShaft', label: '크랭크축' }
    ],
    create: () => new SewingMachine()
  },
  {
    id: 'bikebrake',
    group: 'life',
    summary: '레버를 쥐면 블록이 바퀴 테를 눌러요',
    name: '자전거 브레이크',
    icon: '🚴',
    missionText: '달리는 자전거 바퀴를 멈출 수 없어요! 바퀴 테를 눌러 멈추게 하는 기계요소와, 레버를 놓으면 브레이크가 제자리로 돌아오게 하는 기계요소를 찾아 조립하세요!',
    hint: '브레이크 블록을 바퀴 테에 눌러 마찰력으로 멈추는 제어용 기계요소를 먼저 달고, 눌렀다 놓으면 원래대로 돌아오는 제어용 기계요소를 끼워 주세요!',
    completeText: '블록이 바퀴 테를 눌러 멈추고, 스프링이 브레이크를 제자리로 돌려요 🚴',
    steps: [
      { partId: 'blockBrake', label: '블록 브레이크' },
      { partId: 'spring', label: '스프링' }
    ],
    create: () => new BikeBrake()
  },
  {
    id: 'dynamo',
    group: 'life',
    summary: '바퀴에 닿은 작은 바퀴가 발전기를 돌려요',
    name: '자전거 전조등',
    icon: '🔦',
    missionText: '자전거 전조등에 불이 들어오지 않아요! 타이어에 맞닿아 마찰력으로 회전을 전달받는 기계요소와, 발전기 축을 매끄럽게 받쳐 주는 기계요소를 찾아 조립하세요!',
    hint: '접촉면의 마찰력으로 회전을 전달하는 전동용 기계요소를 먼저 달고, 구슬이 굴러 마찰을 줄이는 축용 기계요소를 끼워 주세요!',
    completeText: '마찰차가 바퀴의 회전을 발전기로 전해 전조등이 켜져요 🔦',
    steps: [
      { partId: 'frictionWheel', label: '마찰차' },
      { partId: 'bearing', label: '볼 베어링' }
    ],
    create: () => new DynamoLight()
  },
  {
    id: 'cart',
    group: 'life',
    summary: '바퀴를 받치는 축과 빠짐을 막는 핀',
    name: '손수레',
    icon: '🛒',
    missionText: '바퀴가 빠진 손수레를 고쳐 주세요! 바퀴의 회전 중심을 받쳐 주는 축과, 바퀴가 축에서 빠지지 않도록 끝을 벌려 고정하는 기계요소를 찾아 조립하세요!',
    hint: '몸체에 고정되어 바퀴만 회전하게 하는 축(축용)을 먼저 끼우고, 끝이 두 갈래로 갈라진 결합용 핀으로 바퀴를 고정하세요!',
    completeText: '차축이 바퀴를 받치고 분할 핀이 바퀴가 빠지지 않게 잡아 줘요 🛒',
    steps: [
      { partId: 'axle', label: '차축' },
      { partId: 'pinSplit', label: '분할 핀' }
    ],
    create: () => new HandCart()
  },
  {
    id: 'engine',
    group: 'car',
    summary: '피스톤의 왕복이 회전으로, 캠이 밸브를 열어요',
    name: '자동차 엔진',
    icon: '🔥',
    missionText: '피스톤은 있는데 힘이 바퀴로 가지 못하는 엔진! 피스톤의 왕복 운동을 회전 운동으로 바꾸는 축과, 회전하며 밸브를 눌러 여닫는 기계요소를 찾아 조립하세요!',
    hint: '왕복 운동과 회전 운동을 서로 바꾸는 축(축용)을 먼저 끼우고, 회전 운동을 왕복 운동으로 바꾸는 달걀 모양의 전동용 기계요소를 달아 주세요!',
    completeText: '크랭크축이 피스톤의 왕복을 회전으로 바꾸고 캠이 밸브를 여닫아요 🔥',
    steps: [
      { partId: 'crankShaft', label: '크랭크축' },
      { partId: 'cam', label: '캠' }
    ],
    create: () => new CarEngine()
  },
  {
    id: 'gearbox',
    group: 'car',
    summary: '기어를 바꿔 물려 속도와 힘을 조절',
    name: '변속기',
    icon: '⚙️',
    missionText: '엔진의 힘을 바퀴 쪽으로 넘겨주지 못하는 변속기! 회전을 전달하는 축과, 이가 비스듬해 조용하게 맞물리는 기어를 찾아 조립하세요!',
    hint: '회전체에 고정되어 함께 돌며 동력을 전달하는 축(축용)을 먼저 끼우고, 이가 경사져 진동과 소음이 적은 전동용 기어를 맞물려 주세요!',
    completeText: '헬리컬 기어가 조용히 맞물려 속도를 바꿔 전달해요 ⚙️',
    steps: [
      { partId: 'driveShaft', label: '전동축' },
      { partId: 'helicalGear', label: '헬리컬 기어' }
    ],
    create: () => new Gearbox()
  },
  {
    id: 'lathe',
    group: 'build',
    summary: '공작물을 돌려 깎는 공작 기계',
    name: '선반',
    icon: '🏭',
    missionText: '공작물이 돌지 않는 선반! 모터의 힘을 주축대로 전달하는 기계요소와, 가깝고 평행한 두 축 사이에 정확하게 동력을 전달하는 기어를 찾아 조립하세요!',
    hint: '멀리 떨어진 모터와 주축대를 잇는 전동용 기계요소를 먼저 걸고, 평행한 두 축 사이에 쓰이는 가장 기본적인 기어를 끼워 주세요!',
    completeText: '벨트와 평 기어가 주축을 돌려 공작물을 깎아요 🏭',
    steps: [
      { partId: 'beltPulley', label: '벨트와 풀리' },
      { partId: 'spurGear', label: '평 기어' }
    ],
    create: () => new Lathe()
  },
  {
    id: 'winch',
    group: 'build',
    summary: '작은 힘으로 무거운 짐을 천천히 들어 올려요',
    name: '윈치 크레인',
    icon: '🏗️',
    missionText: '무거운 짐을 들어 올리지 못하는 윈치! 손잡이를 축에 고정하는 기계요소와, 큰 감속비로 힘을 키워 주는 기어를 찾아 조립하세요!',
    hint: '끝으로 갈수록 가늘어지는 결합용 핀으로 손잡이를 축에 고정하고, 큰 감속비가 필요할 때 쓰는 나사 모양의 전동용 기어를 끼워 주세요!',
    completeText: '웜 기어가 속도를 크게 줄여 무거운 짐도 천천히 들어 올려요 🏗️',
    steps: [
      { partId: 'pinTaper', label: '테이퍼 핀' },
      { partId: 'wormGear', label: '웜과 웜 기어' }
    ],
    create: () => new Winch()
  },
  {
    id: 'conveyor',
    group: 'build',
    summary: '체인이 상자를 일정한 속도로 날라요',
    name: '컨베이어',
    icon: '📦',
    missionText: '상자를 나르지 못하는 컨베이어! 체인과 맞물려 돌아가는 톱니바퀴와, 멀리 떨어진 두 축을 미끄럼 없이 이어 주는 기계요소를 찾아 조립하세요!',
    hint: '체인의 이와 맞물리는 전동용 톱니바퀴를 먼저 끼우고, 스프로킷에 걸려 정확하게 동력을 전달하는 전동용 기계요소를 걸어 주세요!',
    completeText: '스프로킷과 체인이 미끄러지지 않고 상자를 날라요 📦',
    steps: [
      { partId: 'sprocket', label: '스프로킷' },
      { partId: 'chain', label: '체인' }
    ],
    create: () => new Conveyor()
  },
  {
    id: 'microwave',
    group: 'life',
    summary: '작은 모터가 회전판을 천천히 돌려요',
    name: '전자레인지',
    icon: '🍲',
    missionText: '음식이 골고루 데워지지 않는 전자레인지! 모터의 빠른 회전을 느리게 줄여 주는 기어와, 회전판을 받치는 롤러가 돌 수 있게 해 주는 축을 찾아 조립하세요!',
    hint: '가깝고 평행한 두 축 사이에 정확하게 동력을 전달하는 전동용 기어를 먼저 끼우고, 몸체에 고정되어 롤러만 회전하게 하는 축(축용)을 끼워 주세요!',
    completeText: '기어가 속도를 줄여 회전판이 천천히 돌고, 음식이 골고루 데워져요 🍲',
    steps: [
      { partId: 'spurGear', label: '평 기어' },
      { partId: 'axle', label: '차축' }
    ],
    create: () => new Microwave()
  },
  {
    id: 'washer',
    group: 'life',
    summary: '모터와 벨트가 빨래통을 돌려요',
    name: '드럼 세탁기',
    icon: '🧺',
    missionText: '빨래통이 돌지 않는 드럼 세탁기! 모터의 힘을 멀리 떨어진 빨래통 축으로 조용히 전달하는 기계요소와, 탈수할 때 생기는 큰 진동을 줄여 주는 기계요소를 찾아 조립하세요!',
    hint: '두 축의 거리가 멀 때 마찰력으로 조용히 동력을 전달하는 전동용 기계요소를 먼저 걸고, 충격을 완화하는 제어용 기계요소로 빨래통을 매달아 주세요!',
    completeText: '벨트가 빨래통을 돌리고 스프링이 진동을 줄여 줘요 🧺',
    steps: [
      { partId: 'beltPulley', label: '벨트와 풀리' },
      { partId: 'spring', label: '스프링' }
    ],
    create: () => new DrumWasher()
  }
];

export function getMachineDef(id: string): MachineDef {
  const found = MACHINES.find((m) => m.id === id);
  if (!found) throw new Error(`Unknown machine: ${id}`);
  return found;
}
