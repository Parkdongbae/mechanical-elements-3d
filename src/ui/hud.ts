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
  private speedChange: ((v: number) => void) | null = null;

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
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'machine-btn';
      btn.dataset.machine = def.id;
      btn.innerHTML = `<span class="machine-icon">${def.icon}</span><span>${def.name}</span>`;
      btn.addEventListener('click', () => this.callbacks.onSwitchMachine(def.id));
      this.machineBar.appendChild(btn);
    }
  }

  setMachineActive(id: string): void {
    for (const btn of Array.from(this.machineBar.children)) {
      btn.classList.toggle('active', (btn as HTMLElement).dataset.machine === id);
    }
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
        <span>${part.name}</span>`;
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
    this.partPanel.classList.add('hidden');
    for (const btn of Array.from(this.categoryBar.children)) {
      btn.classList.remove('active');
    }
  }

  setMission(text: string, installed: number, labels: string[]): void {
    this.missionText.textContent = text;
    this.missionChips.innerHTML = '';
    labels.forEach((label, i) => {
      const chip = document.createElement('span');
      chip.className = `chip${i < installed ? ' done' : ''}`;
      chip.textContent = `${i + 1}. ${label}${i < installed ? ' ✔' : ''}`;
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
    this.infoCard.innerHTML = `
      <div class="info-chip" style="background:${cat.color}">${cat.icon} ${cat.name}</div>
      <h2>${part.name}</h2>
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
