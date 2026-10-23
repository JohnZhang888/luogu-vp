<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { Component } from 'vue';
import { Check, Monitor, Moon, Sun } from 'lucide-vue-next';
import { useTheme, type ThemeMode } from '@/lib/theme';

interface Option {
  value: ThemeMode;
  label: string;
  icon: Component;
}

const { mode, isDark, setMode } = useTheme();
const open = ref(false);
const root = ref<HTMLElement | null>(null);

const options: Option[] = [
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
  { value: 'system', label: '跟随系统', icon: Monitor },
];

const currentIcon = computed(() => {
  if (mode.value === 'system') return Monitor;
  return isDark.value ? Moon : Sun;
});

function onDocumentClick(event: MouseEvent): void {
  if (!open.value) return;
  const target = event.target;
  if (root.value !== null && target instanceof Node && !root.value.contains(target)) {
    open.value = false;
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') open.value = false;
}

function choose(value: ThemeMode): void {
  setMode(value);
  open.value = false;
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick);
  document.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick);
  document.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="btn btn-ghost size-9 p-0"
      title="切换颜色模式"
      aria-label="切换颜色模式"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click="open = !open"
    >
      <component :is="currentIcon" :size="18" />
    </button>
    <div
      v-if="open"
      class="absolute right-0 z-40 mt-2 w-36 rounded-md border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
      role="menu"
    >
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        role="menuitemradio"
        :aria-checked="mode === option.value"
        class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        @click="choose(option.value)"
      >
        <component :is="option.icon" :size="15" />
        <span class="flex-1 text-left">{{ option.label }}</span>
        <Check v-if="mode === option.value" :size="15" class="text-teal-600 dark:text-teal-400" />
      </button>
    </div>
  </div>
</template>
