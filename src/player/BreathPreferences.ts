import { TUNING } from '../config/tuning';

export interface BreathPreferences {
  inhaleSeconds: number;
  exhaleSeconds: number;
}

const STORAGE_KEY = 'light-within-breath-preferences';
const choices = [1, 2, 3, 4] as const;
const defaults: BreathPreferences = {
  inhaleSeconds: TUNING.breath.inhaleTarget,
  exhaleSeconds: TUNING.breath.exhaleTarget,
};

function defaultPreferences(): BreathPreferences {
  return { ...defaults };
}

function readPreferences(): BreathPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPreferences();
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return defaultPreferences();
    const value = parsed as Record<string, unknown>;
    return {
      inhaleSeconds: choices.includes(value.inhaleSeconds as 1 | 2 | 3 | 4) ? value.inhaleSeconds as number : defaults.inhaleSeconds,
      exhaleSeconds: choices.includes(value.exhaleSeconds as 1 | 2 | 3 | 4) ? value.exhaleSeconds as number : defaults.exhaleSeconds,
    };
  } catch {
    return defaultPreferences();
  }
}

let preferences = readPreferences();

export function getBreathPreferences(): Readonly<BreathPreferences> {
  return preferences;
}

export function setBreathPreference(phase: keyof BreathPreferences, seconds: number): void {
  if (!choices.includes(seconds as 1 | 2 | 3 | 4)) return;
  preferences = { ...preferences, [phase]: seconds };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Keep the current choice for this session when storage is unavailable.
  }
}

export const BREATH_DURATION_CHOICES = choices;
