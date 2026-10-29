export type Difficulty = 'low' | 'medium' | 'high';

export interface AppSettings {
  difficulty: Difficulty;
  sound: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = { difficulty: 'medium', sound: false };

const KEY = 'mech3d-settings-v1';

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<AppSettings>;
      const difficulty: Difficulty = s.difficulty === 'low' || s.difficulty === 'high' ? s.difficulty : 'medium';
      return { difficulty, sound: s.sound === true };
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
