// localStorage 진행도 저장 (머신별)

const KEY = 'mech3d-progress-v2';

export interface MachineProgress {
  installed: number;
  completedOnce: boolean;
  huntFound?: number;
  huntIds?: string[];
}

export interface ProgressData {
  last: string;
  machines: Record<string, MachineProgress>;
}

export function loadProgress(): ProgressData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { last: 'bicycle', machines: {} };
    const parsed = JSON.parse(raw) as Partial<ProgressData>;
    return {
      last: typeof parsed.last === 'string' ? parsed.last : 'bicycle',
      machines: parsed.machines ?? {}
    };
  } catch {
    return { last: 'bicycle', machines: {} };
  }
}

export function saveProgress(data: ProgressData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // 저장 실패(시크릿 모드 등)는 무시: 진행도 없이 계속 진행
  }
}

export function clearMachineProgress(data: ProgressData, machineId: string): void {
  delete data.machines[machineId];
  saveProgress(data);
}
