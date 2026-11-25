export type Difficulty = 'low' | 'medium' | 'high';
export type ThemeSetting = 'light' | 'dark';
/** auto: 기기 사양을 보고 시작 품질을 정하고, 느려지면 스스로 낮춘다 */
export type QualitySetting = 'auto' | 'high' | 'low';

export interface AppSettings {
  difficulty: Difficulty;
  sound: boolean;
  showLabels: boolean;
  theme: ThemeSetting;
  quality: QualitySetting;
  /** 507 상세 화면 회전·움직임 화살표 */
  showArrows: boolean;
  /** 507 화면 언어 */
  mmLang: 'ko' | 'en' | 'ja' | 'zh' | 'hi' | 'ar';
}

export const DEFAULT_SETTINGS: AppSettings = { difficulty: 'medium', sound: false, showLabels: true, theme: 'light', quality: 'auto', showArrows: true, mmLang: 'ko' };

const KEY = 'mech3d-settings-v1';

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<AppSettings>;
      const difficulty: Difficulty = s.difficulty === 'low' || s.difficulty === 'high' ? s.difficulty : 'medium';
      return {
        difficulty,
        sound: s.sound === true,
        showLabels: s.showLabels !== false,
        theme: s.theme === 'dark' ? 'dark' : 'light',
        quality: s.quality === 'low' || s.quality === 'high' ? s.quality : 'auto',
        showArrows: s.showArrows !== false,
        mmLang: (['en', 'ja', 'zh', 'hi', 'ar'] as const).find((x) => x === s.mmLang) ?? 'ko'
      };
    }
  } catch {
    void 0;
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: AppSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    void 0;
  }
}

/** 자동 품질의 시작값: 코어·메모리가 적거나 터치 기기면 낮음으로 시작한다 */
export function guessQuality(): 'high' | 'low' {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 8;
  const mem = nav.deviceMemory ?? 8;
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  return cores <= 4 || mem <= 4 || coarse ? 'low' : 'high';
}
