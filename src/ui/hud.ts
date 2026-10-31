// HUD: 머신 선택 바, 대분류/소분류 UI, 미션 칩, 학습 카드, 토스트, 정보 표시

import { CATEGORIES, PARTS, getCategory, type PartDef } from '../data/elements';
import { MACHINES } from '../data/machines';
import type { MachineDisplayItem } from '../machines/types';
import { ThumbnailFactory } from '../models/thumbnails';
import { saveSettings, type AppSettings, type Difficulty } from '../state/settings';

/** 출발 깃발과 자동차 — "새롭게 시작" 모달용 인라인 SVG */
const RESTART_SVG = `
<svg viewBox="0 0 240 150" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="출발선 앞 자동차">
  <circle cx="120" cy="75" r="70" fill="#e8f4fd"/>
  <circle cx="45" cy="32" r="14" fill="#ffd66b"/>
  <circle cx="45" cy="32" r="8" fill="#ffe9ad"/>
  <ellipse cx="185" cy="30" rx="22" ry="9" fill="#ffffff"/>
  <ellipse cx="160" cy="38" rx="16" ry="7" fill="#f2f9ff"/>
  <rect x="28" y="104" width="184" height="28" rx="12" fill="#8d9aa8"/>
  <line x1="46" y1="118" x2="66" y2="118" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
  <line x1="86" y1="118" x2="106" y2="118" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
  <line x1="126" y1="118" x2="146" y2="118" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
  <line x1="166" y1="118" x2="186" y2="118" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
  <rect x="58" y="46" width="5" height="60" rx="2" fill="#7a6248"/>
  <g>
    <rect x="63" y="48" width="34" height="9" fill="#ffffff" stroke="#4a5568" stroke-width="1.5"/>
    <rect x="63" y="57" width="34" height="9" fill="#4a5568"/>
    <rect x="63" y="48" width="17" height="9" fill="#4a5568"/>
    <rect x="80" y="57" width="17" height="9" fill="#ffffff" stroke="#4a5568" stroke-width="1.5"/>
  </g>
  <g>
    <path d="M104 92 q6 -20 26 -20 h18 q16 0 22 20 z" fill="#e74c3c"/>
    <rect x="96" y="90" width="84" height="20" rx="9" fill="#e74c3c"/>
    <rect x="126" y="78" width="20" height="10" rx="3" fill="#bce0f7"/>
    <rect x="92" y="93" width="7" height="9" rx="2" fill="#ffd66b"/>
    <circle cx="112" cy="111" r="10" fill="#2d3436"/>
    <circle cx="164" cy="111" r="10" fill="#2d3436"/>
    <circle cx="112" cy="111" r="4.5" fill="#dfe6e9"/>
    <circle cx="164" cy="111" r="4.5" fill="#dfe6e9"/>
  </g>
</svg>`;

/** 트로피와 별 — "모두 클리어 축하" 모달용 인라인 SVG */
const CONGRATS_SVG = `
<svg viewBox="0 0 240 150" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="트로피와 별">
  <circle cx="120" cy="75" r="70" fill="#fff7e0"/>
  <polygon points="40,32 44,42 55,43 47,50 49,61 40,55 31,61 33,50 25,43 36,42" fill="#ffd66b"/>
  <polygon points="200,30 204,40 215,41 207,48 209,59 200,53 191,59 193,48 185,41 196,40" fill="#ffd66b"/>
  <polygon points="120,10 123,17 131,18 125,23 127,31 120,27 113,31 115,23 109,18 117,17" fill="#ff8fab"/>
  <g>
    <path d="M92 38 h56 v20 q0 28 -28 34 q-28 -6 -28 -34 z" fill="#f6c344"/>
    <path d="M92 44 h-14 q-2 20 16 26" fill="none" stroke="#f6c344" stroke-width="7"/>
    <path d="M148 44 h14 q2 20 -16 26" fill="none" stroke="#f6c344" stroke-width="7"/>
    <rect x="96" y="42" width="48" height="6" fill="#e0a72e"/>
    <rect x="116" y="92" width="8" height="16" fill="#e0a72e"/>
    <rect x="104" y="106" width="32" height="9" rx="3" fill="#f6c344"/>
    <rect x="98" y="115" width="44" height="8" rx="4" fill="#e0a72e"/>
    <path d="M112 50 l6 12 13 2 -9 9 2 13 -12 -6 -12 6 2 -13 -9 -9 13 -2 z" fill="#ffffff" opacity="0.85"/>
  </g>
</svg>`;

export interface HudCallbacks {
  onSelectPart: (id: string) => void;
  onHint: () => void;
  onReset: () => void;
  onSwitchMachine: (id: string) => void;
  onSettingsChange: (s: AppSettings) => void;
  onResetAll: () => void;
  onToggleLabels: (visible: boolean) => void;
}

export class HUD {
  private machineBar: HTMLElement;
  private categoryBar: HTMLElement;
  private partPanel: HTMLElement;
  private displayBox: HTMLElement;
  private infoCard: HTMLElement;
  private toastEl: HTMLElement;
  private missionChips: HTMLElement;
  private missionText: HTMLElement;
  private toastTimer: number | null = null;
  private hoverCloseTimer: number | null = null;
  private speedChange: ((v: number) => void) | null = null;
  private partNameOverrides: Record<string, string> = {};

  constructor(
    private callbacks: HudCallbacks,
    private thumbs: ThumbnailFactory,
    private settings: AppSettings
  ) {
    this.machineBar = this.require('#machine-bar');
    this.categoryBar = this.require('#category-bar');
    this.partPanel = this.require('#part-panel');
    this.displayBox = this.require('#rpm-display');
    this.infoCard = this.require('#info-card');
    this.toastEl = this.require('#toast');
    this.missionChips = this.require('#mission-chips');
    this.missionText = this.require('#mission-text');

    this.buildMachineBar();
    this.buildCategoryBar();
    this.buildSettingsPanel();

    // 호버 하위 메뉴: 카테고리 바 ↔ 소분류 패널 영역을 벗어나면 자동으로 닫힘
    this.categoryBar.addEventListener('mouseenter', () => this.cancelHoverClose());
    this.categoryBar.addEventListener('mouseleave', () => this.scheduleHoverClose());
    this.partPanel.addEventListener('mouseenter', () => this.cancelHoverClose());
    this.partPanel.addEventListener('mouseleave', () => this.scheduleHoverClose());

    this.require('#hint-btn').addEventListener('click', () => this.callbacks.onHint());
    this.require('#reset-btn').addEventListener('click', () => this.callbacks.onReset());
    this.require('#gear-name-btn').addEventListener('click', () => {
      this.openCategory('power');
      this.toast('씬에 조립된 기어들과 이름을 비교해 보세요! 🔍', 'info');
    });

    // 부품 이름 표시 토글(설정 버튼 위) — 3D 씬의 라벨 레이어를 켜고 끈다
    const labelsBtn = this.require('#labels-btn');
    labelsBtn.addEventListener('click', () => {
      this.settings.showLabels = !this.settings.showLabels;
      saveSettings(this.settings);
      this.updateLabelsButton();
      this.callbacks.onToggleLabels(this.settings.showLabels);
    });
    this.updateLabelsButton();
  }

  private updateLabelsButton(): void {
    const btn = this.require('#labels-btn');
    btn.textContent = this.settings.showLabels ? '🏷️ 부품 이름 켜짐' : '🏷️ 부품 이름 꺼짐';
    btn.classList.toggle('labels-off', !this.settings.showLabels);
  }

  setLabelsVisible(visible: boolean): void {
    this.settings.showLabels = visible;
    this.updateLabelsButton();
  }

  private require(selector: string): HTMLElement {
    const el = document.querySelector(selector);
    if (!(el instanceof HTMLElement)) throw new Error(`Missing element: ${selector}`);
    return el;
  }

  private buildSettingsPanel(): void {
    const btn = this.require('#settings-btn');
    const panel = this.require('#settings-panel');
    btn.addEventListener('click', () => panel.classList.toggle('hidden'));

    const difficultyOptions: { id: Difficulty; label: string; desc: string }[] = [
      { id: 'low', label: '하', desc: '기계요소 이름 표시' },
      { id: 'medium', label: '중', desc: '이름 대신 설명 표시' },
      { id: 'high', label: '상', desc: '이름·설명 모두 숨김' }
    ];

    const render = (): void => {
      panel.innerHTML = '';
      const title = document.createElement('h3');
      title.textContent = '⚙️ 설정';
      panel.appendChild(title);

      const diffRow = document.createElement('div');
      diffRow.className = 'settings-row';
      const diffLabel = document.createElement('small');
      diffLabel.textContent = '난이도';
      diffRow.appendChild(diffLabel);
      for (const opt of difficultyOptions) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'settings-opt';
        b.textContent = opt.label;
        b.title = opt.desc;
        b.classList.toggle('active', this.settings.difficulty === opt.id);
        b.addEventListener('click', () => {
          this.settings.difficulty = opt.id;
          saveSettings(this.settings);
          render();
          this.callbacks.onSettingsChange(this.settings);
        });
        diffRow.appendChild(b);
      }
      panel.appendChild(diffRow);

      const soundRow = document.createElement('div');
      soundRow.className = 'settings-row';
      const soundLabel = document.createElement('small');
      soundLabel.textContent = '효과음';
      soundRow.appendChild(soundLabel);
      const soundBtn = document.createElement('button');
      soundBtn.type = 'button';
      soundBtn.className = 'settings-opt';
      soundBtn.textContent = this.settings.sound ? '🔊 켜기' : '🔇 끄기';
      soundBtn.title = '정답 효과음';
      soundBtn.classList.toggle('active', this.settings.sound);
      soundBtn.addEventListener('click', () => {
        this.settings.sound = !this.settings.sound;
        saveSettings(this.settings);
        render();
        this.callbacks.onSettingsChange(this.settings);
      });
      soundRow.appendChild(soundBtn);
      panel.appendChild(soundRow);

      const resetAllRow = document.createElement('div');
      resetAllRow.className = 'settings-row';
      const resetAllBtn = document.createElement('button');
      resetAllBtn.type = 'button';
      resetAllBtn.className = 'settings-opt settings-reset-all';
      resetAllBtn.textContent = '🧹 모두 초기화';
      resetAllBtn.title = '모든 기계의 진행도를 지웁니다';
      resetAllBtn.addEventListener('click', () => {
        this.callbacks.onResetAll();
        panel.classList.add('hidden');
      });
      resetAllRow.appendChild(resetAllBtn);
      panel.appendChild(resetAllRow);
    };
    render();
  }

  private buildMachineBar(): void {
    for (const def of MACHINES) {
      // 구동방식(FF·FR·AWD·EV)은 '자동차 구동방식' 중첩 메뉴로만 노출 — 최상단 버튼 중복 방지
      if (def.id === 'drivetrain-ff') {
        this.buildDrivetrainGroup();
        continue;
      }
      if (def.id === 'drivetrain-fr' || def.id === 'drivetrain-awd' || def.id === 'ev-single' || def.id === 'ev-dual') continue;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'machine-btn';
      btn.dataset.machine = def.id;
      btn.innerHTML = `<span class="machine-icon">${def.icon}</span><span>${def.name}</span>`;
      btn.addEventListener('click', () => this.callbacks.onSwitchMachine(def.id));
      this.machineBar.appendChild(btn);
    }
  }

  /** '자동차 구동방식' 중첩 호버 메뉴: 1단 내연기관/전기, 2단 각 구동방식. FF·FR 구현됨. */
  private buildDrivetrainGroup(): void {
    const group = document.createElement('div');
    group.className = 'machine-group';
    group.dataset.machine = 'drivetrain';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'machine-btn';
    btn.innerHTML = `<span class="machine-icon">🚗</span><span>자동차 구동방식</span><span class="menu-arrow">▸</span>`;
    group.appendChild(btn);

    const submenu = document.createElement('div');
    submenu.className = 'machine-submenu';

    const branch = (label: string, icon: string, items: { label: string; id: string | null }[]): void => {
      const item = document.createElement('div');
      item.className = 'machine-subitem has-children';
      item.innerHTML = `<span class="machine-icon">${icon}</span><span>${label}</span><span class="menu-arrow">▸</span>`;
      const sub = document.createElement('div');
      sub.className = 'machine-submenu machine-submenu2';
      for (const it of items) {
        const leaf = document.createElement('button');
        leaf.type = 'button';
        leaf.className = 'machine-subitem machine-leaf';
        leaf.innerHTML = `<span>${it.label}</span>`;
        leaf.addEventListener('click', (e) => {
          e.stopPropagation();
          if (it.id) {
            this.callbacks.onSwitchMachine(it.id);
          } else {
            this.toast(`${it.label} 미션은 준비 중이에요! 🔧`, 'info');
          }
        });
        sub.appendChild(leaf);
      }
      item.appendChild(sub);
      submenu.appendChild(item);
    };

    branch('내연기관 자동차', '⛽', [
      { label: 'FF 전륜구동', id: 'drivetrain-ff' },
      { label: 'FR 후륜구동', id: 'drivetrain-fr' },
      { label: 'AWD 사륜구동', id: 'drivetrain-awd' }
    ]);
    branch('전기 자동차', '🔌', [
      { label: '싱글 모터(2WD)', id: 'ev-single' },
      { label: '듀얼 모터(AWD)', id: 'ev-dual' }
    ]);

    group.appendChild(submenu);
    this.machineBar.appendChild(group);
  }

  setMachineActive(id: string): void {
    for (const btn of Array.from(this.machineBar.children)) {
      const el = btn as HTMLElement;
      const dm = el.dataset.machine;
      // '자동차 구동방식' 그룹(drivetrain)은 FF/FR 어느 쪽이든 활성 표시
      btn.classList.toggle('active', dm === id || (dm !== undefined && id.startsWith(dm)));
    }
  }

  /** 현재 머신에서만 적용되는 부품 표시 이름 (예: 전동축 → 구동축) */
  setPartNameOverrides(map: Record<string, string>): void {
    this.partNameOverrides = map;
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
      btn.style.setProperty('--cat-color', cat.color);
      btn.innerHTML = `<span class="cat-icon">${cat.icon}</span><span class="cat-name">${cat.name}</span>`;
      btn.title = cat.desc;
      btn.addEventListener('click', () => this.openCategory(cat.id));
      btn.addEventListener('mouseenter', () => this.openCategory(cat.id));
      this.categoryBar.appendChild(btn);
    }
  }

  openCategory(id: string): void {
    const cat = getCategory(id as PartDef['category']);
    this.partPanel.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'panel-header';
    header.innerHTML = `
      <button type="button" class="back-btn" aria-label="뒤로">◀</button>
      <div class="panel-title">
        <span class="cat-icon">${cat.icon}</span>
        <strong style="color:${cat.color}">${cat.name} 기계요소</strong>
        <small>${cat.desc}</small>
      </div>
    `;
    header.querySelector('.back-btn')?.addEventListener('click', () => this.closePanel());
    this.partPanel.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'part-grid';
    for (const part of PARTS.filter((p) => p.category === id)) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'part-card';
      card.innerHTML = `<img src="${this.thumbs.get(part)}" alt="${part.name}" loading="lazy" draggable="false" />
        <span>${this.displayName(part)}</span>`;
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
    this.cancelHoverClose();
    this.partPanel.classList.add('hidden');
    for (const btn of Array.from(this.categoryBar.children)) {
      btn.classList.remove('active');
    }
  }

  private scheduleHoverClose(): void {
    if (this.hoverCloseTimer !== null) window.clearTimeout(this.hoverCloseTimer);
    this.hoverCloseTimer = window.setTimeout(() => this.closePanel(), 200);
  }

  private cancelHoverClose(): void {
    if (this.hoverCloseTimer !== null) {
      window.clearTimeout(this.hoverCloseTimer);
      this.hoverCloseTimer = null;
    }
  }

  setMission(text: string, installed: number, labels: (string | { text: string; tip: string })[]): void {
    this.missionText.textContent = text;
    this.missionChips.innerHTML = '';
    labels.forEach((label, i) => {
      const chip = document.createElement('span');
      chip.className = `chip${i < installed ? ' done' : ''}`;
      const display = typeof label === 'string' ? label : label.text;
      chip.textContent = `${i + 1}. ${display}${i < installed ? ' ✔' : ''}`;
      if (typeof label !== 'string') chip.title = label.tip;
      this.missionChips.appendChild(chip);
    });
  }

  setHunt(found: number, total: number, prompt: string): void {
    this.missionText.textContent = prompt;
    const chip = document.createElement('span');
    chip.className = `chip${found >= total ? ' done' : ''}`;
    chip.textContent = `🎯 ${found} / ${total}`;
    this.missionChips.innerHTML = '';
    this.missionChips.appendChild(chip);
  }

  setSpeedControl(visible: boolean, onChange: (v: number) => void): void {
    const box = this.require('#speed-control');
    this.speedChange = onChange;
    if (!visible) {
      box.classList.add('hidden');
      return;
    }
    box.classList.remove('hidden');
    if (!box.querySelector('input')) {
      box.innerHTML = `<small>회전 속도</small><input type="range" min="0" max="10" step="0.5" value="1" /><strong>1.0x</strong>`;
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
    const btn = this.require('#gear-name-btn');
    btn.classList.toggle('hidden', !visible);
  }

  setDisplay(items: MachineDisplayItem[] | null): void {
    if (!items) {
      this.displayBox.classList.add('hidden');
      return;
    }
    this.displayBox.classList.remove('hidden');
    this.displayBox.innerHTML = items
      .map((item, i) => {
        const tone = item.tone ? ` ${item.tone}` : '';
        const arrow = i > 0 ? '<div class="rpm-arrow">→</div>' : '';
        return `${arrow}<div class="rpm-item${tone}"><small>${item.label}</small><strong>${item.value}</strong><small>${item.unit ?? ''}</small></div>`;
      })
      .join('');
  }

  showInfoCard(part: PartDef): void {
    const cat = getCategory(part.category);
    const name = this.displayName(part);
    this.infoCard.innerHTML = `
      <div class="info-chip" style="background:${cat.color}">${cat.icon} ${cat.name}</div>
      <h2>${name}</h2>
      <p>${part.role}</p>
      <button type="button" class="info-close">확인</button>
    `;
    this.infoCard.querySelector('.info-close')?.addEventListener('click', () => {
      this.infoCard.classList.add('hidden');
    });
    this.infoCard.classList.remove('hidden');
  }

  toast(message: string, kind: 'ok' | 'warn' | 'info' = 'info', duration = 3200): void {
    this.toastEl.textContent = message;
    this.toastEl.className = `toast-${kind}`;
    this.toastEl.classList.remove('hidden');
    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.add('hidden'), duration);
  }

  showRestartModal(): void {
    this.showModal(RESTART_SVG, '새롭게 시작해 봅시다.');
  }

  showCongratsModal(): void {
    this.showModal(CONGRATS_SVG, '당신이 자랑스럽습니다.');
  }

  private showModal(art: string, message: string): void {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card" role="dialog" aria-label="${message}">
        <div class="modal-art">${art}</div>
        <h2>${message}</h2>
        <button type="button" class="modal-close">확인</button>
      </div>
    `;
    overlay.querySelector('.modal-close')?.addEventListener('click', () => overlay.remove());
    this.require('#hud').appendChild(overlay);
  }
}
