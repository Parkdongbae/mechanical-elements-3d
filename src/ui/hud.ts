// 미션 화면 HUD: 상단 내비·미션 단계, 도구 버튼, 대분류 독/소분류 트레이, 수치 패널, 학습 카드, 토스트, 설정

import { CATEGORIES, PARTS, getCategory, type PartDef } from '../data/elements';
import type { MachineDisplayItem } from '../machines/types';
import { ThumbnailFactory } from '../models/thumbnails';
import { saveSettings, type AppSettings, type Difficulty } from '../state/settings';
import { ICON } from './icons';
import { CONGRATS_SVG, RESTART_SVG } from './modalArt';

export interface HudCallbacks {
  onSelectPart: (id: string) => void;
  onHint: () => void;
  onReset: () => void;
  onHome: () => void;
  onNextMission: () => void;
  onSettingsChange: (s: AppSettings) => void;
  onResetAll: () => void;
  onToggleLabels: (visible: boolean) => void;
}

export interface StepLabel {
  text: string;
  tip: string;
}

export class HUD {
  private root: HTMLElement;
  private categoryBar: HTMLElement;
  private partPanel: HTMLElement;
  private displayBox: HTMLElement;
  private infoCard: HTMLElement;
  private toastEl: HTMLElement;
  private missionChips: HTMLElement;
  private missionText: HTMLElement;
  private missionDone: HTMLElement;
  private settingsPanel: HTMLElement;
  private toastTimer: number | null = null;
  private speedChange: ((v: number) => void) | null = null;
  private partNameOverrides: Record<string, string> = {};
  private partNotes: Record<string, string> = {};
  private openCat: string | null = null;
  private nextName: string | null = null;

  constructor(
    private callbacks: HudCallbacks,
    private thumbs: ThumbnailFactory,
    private settings: AppSettings
  ) {
    this.root = this.require('#hud');
    this.categoryBar = this.require('#category-bar');
    this.partPanel = this.require('#part-panel');
    this.displayBox = this.require('#rpm-display');
    this.infoCard = this.require('#info-card');
    this.toastEl = this.require('#toast');
    this.missionChips = this.require('#mission-chips');
    this.missionText = this.require('#mission-text');
    this.missionDone = this.require('#mission-done');
    this.settingsPanel = this.require('#settings-panel');

    this.buildCategoryBar();
    this.renderSettings();

    const homeBtn = this.require('#home-btn');
    homeBtn.innerHTML = ICON.home;
    homeBtn.addEventListener('click', () => this.callbacks.onHome());

    const hintBtn = this.require('#hint-btn');
    hintBtn.innerHTML = `${ICON.hint}<span>힌트</span>`;
    hintBtn.addEventListener('click', () => this.callbacks.onHint());

    const resetBtn = this.require('#reset-btn');
    resetBtn.innerHTML = `${ICON.reset}<span>다시하기</span>`;
    resetBtn.addEventListener('click', () => this.callbacks.onReset());

    const settingsBtn = this.require('#settings-btn');
    settingsBtn.innerHTML = ICON.gear;
    settingsBtn.addEventListener('click', () => this.toggleSettings());

    const gearBtn = this.require('#gear-name-btn');
    gearBtn.innerHTML = `${ICON.tag}<span>기어 이름 보기</span>`;
    gearBtn.addEventListener('click', () => {
      this.openCategory('power');
      this.toast('씬에 조립된 기어들과 이름을 비교해 보세요!', 'info');
    });

    const labelsBtn = this.require('#labels-btn');
    labelsBtn.addEventListener('click', () => {
      this.settings.showLabels = !this.settings.showLabels;
      saveSettings(this.settings);
      this.updateLabelsButton();
      this.callbacks.onToggleLabels(this.settings.showLabels);
    });
    this.updateLabelsButton();

    this.require('#control-hint').innerHTML =
      `${ICON.mouse}<span class="hint-desktop">드래그 회전 · 휠 확대 · 우클릭 드래그 이동</span><span class="hint-touch">한 손가락 회전 · 두 손가락 확대/이동</span>`;

    // 패널 바깥을 누르면 소분류 트레이·설정을 닫는다
    document.addEventListener('pointerdown', (e) => {
      const t = e.target as Node;
      if (this.openCat && !this.partPanel.contains(t) && !this.categoryBar.contains(t)) this.closePanel();
      if (!this.settingsPanel.classList.contains('hidden') && !this.settingsPanel.contains(t) && !(t as HTMLElement).closest?.('#settings-btn, [data-act="settings"]')) {
        this.settingsPanel.classList.add('hidden');
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      this.closePanel();
      this.settingsPanel.classList.add('hidden');
      this.infoCard.classList.add('hidden');
    });
  }

  private require(selector: string): HTMLElement {
    const el = document.querySelector(selector);
    if (!(el instanceof HTMLElement)) throw new Error(`Missing element: ${selector}`);
    return el;
  }

  setVisible(visible: boolean): void {
    this.root.classList.toggle('hidden', !visible);
    if (!visible) {
      this.closePanel();
      this.infoCard.classList.add('hidden');
    }
  }

  // ── 상단 내비 ──

  setMachineTitle(group: string, name: string, nextName: string | null): void {
    this.require('#nav-group').textContent = group;
    this.require('#nav-name').textContent = name;
    this.nextName = nextName;
  }

  /** 실험·507에서 이름표 설정이 바뀐 뒤 미션으로 돌아올 때 버튼 상태를 맞춘다 */
  syncLabels(): void {
    this.updateLabelsButton();
  }

  private updateLabelsButton(): void {
    const btn = this.require('#labels-btn');
    btn.innerHTML = `${ICON.tag}<span>이름표</span>`;
    btn.setAttribute('aria-pressed', String(this.settings.showLabels));
    btn.title = this.settings.showLabels ? '3D 부품 이름표 숨기기' : '3D 부품 이름표 보이기';
  }

  // ── 설정 ──

  toggleSettings(): void {
    this.renderSettings();
    this.settingsPanel.classList.toggle('hidden');
  }

  /** 외부(자동 품질 하향 등)에서 설정이 바뀌었을 때 패널을 다시 그린다 */
  refreshSettings(): void {
    this.renderSettings();
  }

  private renderSettings(): void {
    const panel = this.settingsPanel;
    const s = this.settings;
    const seg = <T extends string>(label: string, desc: string, options: { id: T; label: string }[], value: T, key: string): string => `
      <div class="set-row">
        <div class="set-label"><strong>${label}</strong><small>${desc}</small></div>
        <div class="seg" role="radiogroup" aria-label="${label}">
          ${options.map((o) => `<button type="button" role="radio" aria-checked="${o.id === value}" data-key="${key}" data-val="${o.id}">${o.label}</button>`).join('')}
        </div>
      </div>`;

    const diffDesc: Record<Difficulty, string> = {
      low: '단계에 기계요소 이름 표시',
      medium: '이름 대신 설명 표시',
      high: '이름·설명 모두 숨김'
    };

    panel.innerHTML = `
      <header class="set-head"><h3>설정</h3><button type="button" class="icon-btn set-close" aria-label="닫기">${ICON.close}</button></header>
      ${seg('난이도', diffDesc[s.difficulty], [{ id: 'low', label: '쉬움' }, { id: 'medium', label: '보통' }, { id: 'high', label: '어려움' }], s.difficulty, 'difficulty')}
      ${seg('화면 테마', '교실 밝기에 맞춰 선택', [{ id: 'light', label: '밝게' }, { id: 'dark', label: '어둡게' }], s.theme, 'theme')}
      ${seg('그래픽 품질', s.quality === 'auto' ? '기기 사양에 맞춰 조절' : s.quality === 'high' ? '그림자·음영 효과 최대' : '느린 기기용', [{ id: 'auto', label: '자동' }, { id: 'high', label: '높음' }, { id: 'low', label: '낮음' }], s.quality, 'quality')}
      ${seg('효과음', '정답 효과음', [{ id: 'on', label: '켜기' }, { id: 'off', label: '끄기' }], s.sound ? 'on' : 'off', 'sound')}
      <button type="button" class="set-reset">모든 진행도 초기화</button>`;

    panel.querySelector('.set-close')?.addEventListener('click', () => panel.classList.add('hidden'));
    panel.querySelectorAll<HTMLElement>('[data-key]').forEach((b) => {
      b.addEventListener('click', () => {
        const key = b.dataset.key;
        const val = b.dataset.val ?? '';
        if (key === 'difficulty') s.difficulty = val as Difficulty;
        else if (key === 'theme') s.theme = val === 'dark' ? 'dark' : 'light';
        else if (key === 'quality') s.quality = val === 'low' || val === 'high' ? val : 'auto';
        else if (key === 'sound') s.sound = val === 'on';
        saveSettings(s);
        this.renderSettings();
        this.callbacks.onSettingsChange(s);
      });
    });
    panel.querySelector('.set-reset')?.addEventListener('click', () => {
      panel.classList.add('hidden');
      this.confirm('모든 미션의 진행도를 지울까요?', '되돌릴 수 없어요.', '초기화', () => this.callbacks.onResetAll());
    });
  }

  // ── 부품 선택 독 ──

  /** 현재 머신에서만 적용되는 부품 표시 이름 (예: 전동축 → 구동축) */
  setPartNameOverrides(map: Record<string, string>): void {
    this.partNameOverrides = map;
  }

  /** 현재 머신에서 부품의 쓰임을 덧붙이는 설명 */
  setPartNotes(map: Record<string, string>): void {
    this.partNotes = map;
  }

  private displayName(part: PartDef): string {
    return this.partNameOverrides[part.id] ?? part.name;
  }

  private buildCategoryBar(): void {
    for (const cat of CATEGORIES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cat-btn';
      btn.dataset.cat = cat.id;
      btn.style.setProperty('--c', `var(--cat-${cat.id})`);
      btn.innerHTML = `<i class="cat-swatch"></i><span class="cat-name">${cat.name}</span><small>${PARTS.filter((p) => p.category === cat.id).length}</small>`;
      btn.title = cat.desc;
      btn.addEventListener('click', () => {
        if (this.openCat === cat.id) this.closePanel();
        else this.openCategory(cat.id);
      });
      this.categoryBar.appendChild(btn);
    }
  }

  openCategory(id: string): void {
    const cat = getCategory(id as PartDef['category']);
    this.openCat = id;
    this.partPanel.style.setProperty('--c', `var(--cat-${cat.id})`);
    this.partPanel.innerHTML = `
      <header class="tray-head">
        <strong>${cat.name} 기계요소</strong>
        <small>${cat.desc}</small>
        <button type="button" class="icon-btn tray-close" aria-label="닫기">${ICON.close}</button>
      </header>`;
    this.partPanel.querySelector('.tray-close')?.addEventListener('click', () => this.closePanel());

    const grid = document.createElement('div');
    grid.className = 'part-grid';
    for (const part of PARTS.filter((p) => p.category === id)) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'part-card';
      const name = this.displayName(part);
      card.innerHTML = `<img src="${this.thumbs.get(part)}" alt="" loading="lazy" draggable="false" /><span>${name}</span>`;
      card.addEventListener('click', () => this.callbacks.onSelectPart(part.id));
      grid.appendChild(card);
    }
    this.partPanel.appendChild(grid);
    this.partPanel.classList.remove('hidden');

    for (const btn of Array.from(this.categoryBar.children)) {
      btn.classList.toggle('active', (btn as HTMLElement).dataset.cat === id);
    }
  }

  closePanel(): void {
    this.openCat = null;
    this.partPanel.classList.add('hidden');
    for (const btn of Array.from(this.categoryBar.children)) btn.classList.remove('active');
  }

  // ── 미션 진행 ──

  setMission(text: string, installed: number, labels: StepLabel[], completeText?: string): void {
    this.missionText.textContent = text;
    this.missionChips.innerHTML = '';
    labels.forEach((label, i) => {
      const chip = document.createElement('li');
      const state = i < installed ? 'done' : i === installed ? 'current' : 'todo';
      chip.className = `step ${state}`;
      chip.innerHTML = `<i>${i < installed ? ICON.check : i + 1}</i><span>${label.text}</span>`;
      if (label.tip) chip.title = label.tip;
      this.missionChips.appendChild(chip);
    });
    this.setDone(labels.length > 0 && installed >= labels.length ? (completeText ?? '') : null);
  }

  setHunt(found: number, total: number, prompt: string, completeText?: string): void {
    this.missionText.textContent = prompt;
    this.missionChips.innerHTML = `<li class="step ${found >= total ? 'done' : 'current'} step-count"><i>${found >= total ? ICON.check : found}</i><span>${found} / ${total} 조립</span></li>`;
    this.setDone(found >= total ? (completeText ?? '') : null);
  }

  private setDone(text: string | null): void {
    if (text === null) {
      this.missionDone.classList.add('hidden');
      this.missionText.classList.remove('hidden');
      return;
    }
    this.missionText.classList.add('hidden');
    this.missionDone.classList.remove('hidden');
    this.missionDone.innerHTML = `
      <span class="done-text">${ICON.check}<span>완성! ${text}</span></span>
      ${this.nextName ? `<button type="button" class="btn-primary btn-next"><span>다음 · ${this.nextName}</span>${ICON.next}</button>` : `<button type="button" class="btn-primary btn-next"><span>홈으로</span>${ICON.next}</button>`}`;
    this.missionDone.querySelector('.btn-next')?.addEventListener('click', () => {
      if (this.nextName) this.callbacks.onNextMission();
      else this.callbacks.onHome();
    });
  }

  // ── 우측 수치 패널 ──

  setSpeedControl(visible: boolean, onChange: (v: number) => void): void {
    const box = this.require('#speed-control');
    this.speedChange = onChange;
    if (!visible) {
      box.classList.add('hidden');
      return;
    }
    box.classList.remove('hidden');
    if (!box.querySelector('input')) {
      box.innerHTML = `<label><small>회전 속도</small><strong>1.0x</strong></label><input type="range" min="0" max="10" step="0.5" value="1" aria-label="회전 속도" />`;
      box.querySelector('input')?.addEventListener('input', (e) => {
        const v = Number((e.target as HTMLInputElement).value);
        const label = box.querySelector('strong');
        if (label) label.textContent = `${v.toFixed(1)}x`;
        this.speedChange?.(v);
      });
    } else {
      const input = box.querySelector('input') as HTMLInputElement;
      input.value = '1';
      const label = box.querySelector('strong');
      if (label) label.textContent = '1.0x';
    }
  }

  setGearNameButton(visible: boolean): void {
    this.require('#gear-name-btn').classList.toggle('hidden', !visible);
  }

  setDisplay(items: MachineDisplayItem[] | null): void {
    if (!items) {
      this.displayBox.classList.add('hidden');
      return;
    }
    this.displayBox.classList.remove('hidden');
    this.displayBox.innerHTML =
      `<h4>실시간 수치</h4>` +
      items
        .map((item, i) => {
          const tone = item.tone ? ` ${item.tone}` : '';
          // 숫자가 아닌 긴 값(예: '센터 디퍼렌셜 + 전동축')은 작은 글씨로
          const wordy = /^[-+]?[0-9.,]+$/.test(item.value.trim()) ? '' : ' wordy';
          const arrow = i > 0 ? '<div class="rpm-arrow" aria-hidden="true"></div>' : '';
          return `${arrow}<div class="rpm-item${tone}${wordy}"><small>${item.label}</small><span><strong>${item.value}</strong><em>${item.unit ?? ''}</em></span></div>`;
        })
        .join('');
  }

  // ── 학습 카드·토스트·모달 ──

  showInfoCard(part: PartDef): void {
    const cat = getCategory(part.category);
    const name = this.displayName(part);
    this.infoCard.style.setProperty('--c', `var(--cat-${cat.id})`);
    this.infoCard.innerHTML = `
      <img src="${this.thumbs.get(part)}" alt="" draggable="false" />
      <div class="info-body">
        <span class="info-chip">${cat.name} 기계요소</span>
        <h2>${name}</h2>
        <p>${part.role}</p>
        ${this.partNotes[part.id] ? `<p class="info-note"><b>이 기계에서는</b> ${this.partNotes[part.id]}</p>` : ''}
      </div>
      <button type="button" class="icon-btn info-close" aria-label="닫기">${ICON.close}</button>`;
    this.infoCard.querySelector('.info-close')?.addEventListener('click', () => this.infoCard.classList.add('hidden'));
    this.infoCard.classList.remove('hidden');
  }

  hideInfoCard(): void {
    this.infoCard.classList.add('hidden');
  }

  toast(message: string, kind: 'ok' | 'warn' | 'info' = 'info', duration = 3200): void {
    this.toastEl.textContent = message;
    this.toastEl.className = `toast-${kind}`;
    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.add('hidden'), duration);
  }

  showRestartModal(): void {
    this.showModal(RESTART_SVG, '새롭게 시작해 봅시다.');
  }

  showCongratsModal(): void {
    this.showModal(CONGRATS_SVG, '당신이 자랑스럽습니다.', '모든 미션을 완료했어요!');
  }

  private showModal(art: string, message: string, sub = ''): void {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card" role="dialog" aria-label="${message}">
        <div class="modal-art">${art}</div>
        <h2>${message}</h2>
        ${sub ? `<p>${sub}</p>` : ''}
        <button type="button" class="btn-primary modal-close">확인</button>
      </div>`;
    overlay.querySelector('.modal-close')?.addEventListener('click', () => overlay.remove());
    this.require('#app').appendChild(overlay);
  }

  private confirm(title: string, sub: string, okLabel: string, onOk: () => void): void {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card" role="alertdialog" aria-label="${title}">
        <h2>${title}</h2>
        <p>${sub}</p>
        <div class="modal-actions">
          <button type="button" class="btn-ghost modal-cancel">취소</button>
          <button type="button" class="btn-danger modal-ok">${okLabel}</button>
        </div>
      </div>`;
    overlay.querySelector('.modal-cancel')?.addEventListener('click', () => overlay.remove());
    overlay.querySelector('.modal-ok')?.addEventListener('click', () => {
      overlay.remove();
      onOk();
    });
    this.require('#app').appendChild(overlay);
  }
}
