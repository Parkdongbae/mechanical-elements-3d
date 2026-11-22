// 홈 화면: 학습 모드(도감·퀴즈) + 미션 카드 그리드 + 전체 진행도

import { MACHINES, MACHINE_GROUPS, type MachineDef } from '../data/machines';
import { getCategory, getPart, PARTS } from '../data/elements';
import type { ProgressData } from '../state/progress';
import { ICON } from './icons';

export interface HomeCallbacks {
  onOpenMission: (id: string) => void;
  onOpenMode: (mode: 'enc' | 'quiz' | 'lab/bike' | 'lab/car' | 'lab/power') => void;
  onOpenSettings: () => void;
  onToggleTheme: () => void;
}

export interface HomeStats {
  progress: ProgressData;
  seenParts: number;
  quizBest: number;
  quizPlays: number;
  theme: 'light' | 'dark';
}

function isDone(progress: ProgressData, id: string): boolean {
  return progress.machines[id]?.completedOnce === true;
}

function stepProgress(progress: ProgressData, def: MachineDef): { done: number; total: number } {
  const entry = progress.machines[def.id];
  if (def.steps.length === 0) {
    // 드래그 조립형(기어의 종류): 부품 개수 기준
    const total = 7;
    return { done: entry?.completedOnce ? total : Math.min(entry?.huntFound ?? 0, total), total };
  }
  const total = def.steps.length;
  return { done: entry?.completedOnce ? total : Math.min(entry?.installed ?? 0, total), total };
}

/** 미션에 쓰이는 대분류를 중복 없이 — 카드에 색 점으로 표시(정답 이름은 노출하지 않는다) */
function categoriesOf(def: MachineDef): string[] {
  const ids = def.steps.length > 0 ? def.steps.map((s) => getPart(s.partId).category) : ['power'];
  return [...new Set(ids)];
}

export class HomeScreen {
  private el: HTMLElement;

  constructor(private cb: HomeCallbacks) {
    const el = document.querySelector<HTMLElement>('#home');
    if (!el) throw new Error('#home not found');
    this.el = el;
  }

  show(stats: HomeStats): void {
    this.render(stats);
    this.el.classList.remove('hidden');
    this.el.scrollTop = 0;
  }

  hide(): void {
    this.el.classList.add('hidden');
  }

  get visible(): boolean {
    return !this.el.classList.contains('hidden');
  }

  private render(stats: HomeStats): void {
    const { progress } = stats;
    const doneCount = MACHINES.filter((m) => isDone(progress, m.id)).length;
    const pct = Math.round((doneCount / MACHINES.length) * 100);
    const lastDef = MACHINES.find((m) => m.id === progress.last && progress.machines[m.id]);
    const nextDef = MACHINES.find((m) => !isDone(progress, m.id));
    const resume = lastDef && !isDone(progress, lastDef.id) ? lastDef : nextDef;

    const groups = MACHINE_GROUPS.map((g) => {
      const items = MACHINES.filter((m) => m.group === g.id);
      const cards = items.map((m) => this.missionCard(m, progress)).join('');
      const done = items.filter((m) => isDone(progress, m.id)).length;
      return `
        <section class="home-group">
          <header class="home-group-head">
            <h2>${g.name}</h2>
            <p>${g.desc}</p>
            <span class="home-group-count">${done} / ${items.length}</span>
          </header>
          <div class="home-grid">${cards}</div>
        </section>`;
    }).join('');

    this.el.innerHTML = `
      <div class="home-inner">
        <header class="home-top">
          <div class="home-brand">
            <span class="home-logo" aria-hidden="true">${ICON.gear}</span>
            <div>
              <h1>기계요소 3D 실험실</h1>
              <p>중학교 기술·가정 — 기계의 구성과 동력 전달</p>
            </div>
          </div>
          <div class="home-tools">
            <button type="button" class="tool-btn" data-act="theme" aria-label="화면 테마 전환">${stats.theme === 'dark' ? ICON.sun : ICON.moon}<span>${stats.theme === 'dark' ? '밝게' : '어둡게'}</span></button>
            <button type="button" class="tool-btn" data-act="settings" aria-label="설정">${ICON.gear}<span>설정</span></button>
          </div>
        </header>

        <section class="home-hero">
          <div class="home-hero-text">
            <h2>빠진 부품을 찾아 기계를 완성해 보세요</h2>
            <p>고장 난 기계를 살펴보고 알맞은 기계요소를 골라 조립하면, 동력이 전달되는 모습을 3D로 볼 수 있어요.</p>
            ${resume ? `<button type="button" class="btn-primary" data-mission="${resume.id}">${ICON.play}<span>${lastDef && resume.id === lastDef.id ? '이어서 하기' : '시작하기'} · ${resume.name}</span></button>` : `<p class="home-alldone">${ICON.check} 모든 미션을 완료했어요!</p>`}
          </div>
          <div class="home-progress" aria-label="전체 진행도">
            <div class="home-progress-row">
              <span>미션</span><strong>${doneCount}<small> / ${MACHINES.length}</small></strong>
            </div>
            <div class="bar"><i style="width:${pct}%"></i></div>
            <div class="home-progress-row">
              <span>도감</span><strong>${stats.seenParts}<small> / ${PARTS.length}</small></strong>
            </div>
            <div class="bar"><i style="width:${Math.round((stats.seenParts / PARTS.length) * 100)}%"></i></div>
            <div class="home-progress-row">
              <span>퀴즈 최고 점수</span><strong>${stats.quizPlays > 0 ? `${stats.quizBest}<small> / 10</small>` : '<small>아직 없음</small>'}</strong>
            </div>
          </div>
        </section>

        <section class="home-group">
          <header class="home-group-head">
            <h2>학습 모드</h2>
            <p>미션 전후로 개념을 다져요</p>
          </header>
          <div class="home-modes">
            <button type="button" class="mode-card" data-mode="enc">
              <span class="mode-icon mode-enc">${ICON.book}</span>
              <span class="mode-text"><strong>기계요소 도감</strong><small>22가지 부품을 돌려 보며 역할과 쓰임새 익히기</small></span>
              <span class="mode-meta">${stats.seenParts} / ${PARTS.length}</span>
            </button>
            <button type="button" class="mode-card" data-mode="quiz">
              <span class="mode-icon mode-quiz">${ICON.quiz}</span>
              <span class="mode-text"><strong>단원 퀴즈</strong><small>10문제로 분류·이름·쓰임새 점검하기</small></span>
              <span class="mode-meta">${stats.quizPlays > 0 ? `최고 ${stats.quizBest}점` : '도전!'}</span>
            </button>
          </div>
        </section>

        <section class="home-group">
          <header class="home-group-head">
            <h2>탐구 실험실</h2>
            <p>직접 조작하며 변속과 동력 전달의 원리를 알아봐요</p>
          </header>
          <div class="home-labs">
            <button type="button" class="mode-card lab-card" data-mode="lab/bike">
              <span class="mode-icon mode-lab-bike">${ICON.bike}</span>
              <span class="mode-text"><strong>자전거 기어 변속</strong><small>앞·뒤 기어를 바꿔 보며 언제 어떤 단을 쓰는지 알아보기</small></span>
            </button>
            <button type="button" class="mode-card lab-card" data-mode="lab/car">
              <span class="mode-icon mode-lab-car">${ICON.shift}</span>
              <span class="mode-text"><strong>자동차 기어 변속</strong><small>수동 5단·자동 변속기를 직접 조작하고 속도 확인하기</small></span>
            </button>
            <button type="button" class="mode-card lab-card" data-mode="lab/power">
              <span class="mode-icon mode-lab-power">${ICON.flow}</span>
              <span class="mode-text"><strong>자동차의 동력 전달</strong><small>엔진에서 바퀴까지, 후륜구동(FR)으로 전체 과정 따라가기</small></span>
            </button>
          </div>
        </section>

        ${groups}

        <footer class="home-foot">2022 개정 교육과정 기술·가정② '기계의 구성과 동력 전달' 단원 학습용</footer>
      </div>`;

    this.el.querySelectorAll<HTMLElement>('[data-mission]').forEach((b) => {
      b.addEventListener('click', () => this.cb.onOpenMission(b.dataset.mission ?? ''));
    });
    this.el.querySelectorAll<HTMLElement>('[data-mode]').forEach((b) => {
      b.addEventListener('click', () => this.cb.onOpenMode((b.dataset.mode ?? 'enc') as Parameters<HomeCallbacks['onOpenMode']>[0]));
    });
    this.el.querySelector('[data-act="theme"]')?.addEventListener('click', () => this.cb.onToggleTheme());
    this.el.querySelector('[data-act="settings"]')?.addEventListener('click', () => this.cb.onOpenSettings());
    // 썸네일이 아직 없으면(로드 실패) 아이콘 대체 화면을 보여 준다
    this.el.querySelectorAll<HTMLImageElement>('.card-thumb img').forEach((img) => {
      img.addEventListener('error', () => img.remove());
    });
  }

  private missionCard(def: MachineDef, progress: ProgressData): string {
    const done = isDone(progress, def.id);
    const sp = stepProgress(progress, def);
    const started = !done && sp.done > 0;
    const dots = categoriesOf(def)
      .map((c) => {
        const cat = getCategory(c as Parameters<typeof getCategory>[0]);
        return `<span class="cat-dot" style="--c:var(--cat-${cat.id})">${cat.name}</span>`;
      })
      .join('');
    const badge = done
      ? `<span class="card-badge done">${ICON.check}완료</span>`
      : started
        ? `<span class="card-badge going">${sp.done} / ${sp.total} 단계</span>`
        : '';
    return `
      <button type="button" class="mission-card${done ? ' is-done' : ''}" data-mission="${def.id}">
        <span class="card-thumb">
          <span class="card-fallback" aria-hidden="true">${def.icon}</span>
          <img src="/thumbs/${def.id}.jpg" alt="" loading="lazy" draggable="false" />
          ${badge}
        </span>
        <span class="card-body">
          <strong>${def.name}</strong>
          <small>${def.summary}</small>
          <span class="card-cats">${dots}<span class="card-steps">${sp.total}단계</span></span>
        </span>
      </button>`;
  }
}
