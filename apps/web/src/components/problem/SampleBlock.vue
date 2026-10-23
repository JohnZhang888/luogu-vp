<script setup lang="ts">
import { ref } from 'vue';
import { Check, Copy } from 'lucide-vue-next';

const props = defineProps<{
  index: number;
  input: string;
  output: string;
}>();

const copied = ref<'input' | 'output' | null>(null);
let timer: number | null = null;

async function copy(kind: 'input' | 'output'): Promise<void> {
  const value = kind === 'input' ? props.input : props.output;
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    return;
  }
  copied.value = kind;
  if (timer !== null) clearTimeout(timer);
  timer = window.setTimeout(() => {
    copied.value = null;
    timer = null;
  }, 1500);
}
</script>

<template>
  <div class="space-y-2">
    <p class="text-sm font-medium text-zinc-800 dark:text-zinc-200">
      样例 {{ index + 1 }}
    </p>
    <div class="grid gap-3 md:grid-cols-2">
      <div class="overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
        <div class="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-900">
          <span class="text-xs font-medium text-zinc-600 dark:text-zinc-400">输入</span>
          <button
            type="button"
            class="btn btn-ghost size-7 p-0"
            title="复制输入"
            aria-label="复制输入"
            @click="copy('input')"
          >
            <Check v-if="copied === 'input'" :size="14" class="text-teal-600 dark:text-teal-400" />
            <Copy v-else :size="14" />
          </button>
        </div>
        <pre class="overflow-x-auto bg-white p-3 font-mono text-sm leading-6 text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">{{ input }}</pre>
      </div>
      <div class="overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
        <div class="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-900">
          <span class="text-xs font-medium text-zinc-600 dark:text-zinc-400">输出</span>
          <button
            type="button"
            class="btn btn-ghost size-7 p-0"
            title="复制输出"
            aria-label="复制输出"
            @click="copy('output')"
          >
            <Check v-if="copied === 'output'" :size="14" class="text-teal-600 dark:text-teal-400" />
            <Copy v-else :size="14" />
          </button>
        </div>
        <pre class="overflow-x-auto bg-white p-3 font-mono text-sm leading-6 text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">{{ output }}</pre>
      </div>
    </div>
  </div>
</template>
