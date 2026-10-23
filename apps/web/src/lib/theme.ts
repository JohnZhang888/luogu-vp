import { computed, ref } from 'vue';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'vp.theme';

function readMode(): ThemeMode {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === 'light' || value === 'dark' || value === 'system') return value;
  } catch {
    // 忽略读取失败。
  }
  return 'system';
}

const mode = ref<ThemeMode>(readMode());
const systemQuery = window.matchMedia('(prefers-color-scheme: dark)');
const systemDark = ref(systemQuery.matches);
const isDark = computed(
  () => mode.value === 'dark' || (mode.value === 'system' && systemDark.value),
);

function apply(): void {
  document.documentElement.classList.toggle('dark', isDark.value);
}

function setMode(next: ThemeMode): void {
  mode.value = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // 忽略写入失败。
  }
  apply();
}

systemQuery.addEventListener('change', (event) => {
  systemDark.value = event.matches;
  if (mode.value === 'system') apply();
});

apply();

export function useTheme() {
  return { mode, isDark, setMode };
}
