// HUD: 머신 선택 바, 대분류/소분류 UI, 미션 칩, 학습 카드, 토스트, 정보 표시

import { CATEGORIES, PARTS, getCategory, type PartDef } from '../data/elements';
import { MACHINES } from '../data/machines';
import type { MachineDisplayItem } from '../machines/types';
import { ThumbnailFactory } from '../models/thumbnails';
import { saveSettings, type AppSettings, type Difficulty } from '../state/settings';

export interface HudCallbacks {
  onSelectPart: (id: string) => void;
  onHint: () => void;
  onReset: () => void;
  onSwitchMachine: (id: string) => void;
  onSettingsChange: (s: AppSettings) => void;
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
    };
    render();
  }

  private buildMachineBar(): void {
    for (const def of MACHINES) {
      if (def.id === 'drivetrain-ff') {
        this.buildDrivetrainGroup();
        continue;
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'machine-btn';
      btn.dataset.machine = def.id;
      btn.innerHTML = `<span class="machine-icon">${def.icon}</span><span>${def.name}</span>`;
      btn.addEventListener('click', () => this.callbacks.onSwitchMachine(def.id));
      this.machineBar.appendChild(btn);
    }
  }

  /** '자동차 구동방식' 중첩 호버 메뉴: 1단 내연기관/전기, 2단 각 구동방식. FF만 구현됨. */
  private buildDrivetrainGroup(): void {
    const group = document.createElement('div');
    group.className = 'machine-group';
    group.dataset.machine = 'drivetrain-ff';

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
      { label: 'FR 후륜구동', id: null },
      { label: 'AWD 사륜구동', id: null }
    ]);
    branch('전기 자동차', '🔌', [
      { label: '싱글 모터(2WD)', id: null },
      { label: '듀얼 모터(AWD)', id: null }
    ]);

    group.appendChild(submenu);
    this.machineBar.appendChild(group);
  }

  setMachineActive(id: string): void {
    for (const btn of Array.from(this.machineBar.children)) {
      const el = btn as HTMLElement;
      btn.classList.toggle('active', el.dataset.machine === id);
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
}
