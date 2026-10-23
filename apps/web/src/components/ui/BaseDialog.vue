<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import { X } from 'lucide-vue-next';

const props = withDefaults(
  defineProps<{
    open: boolean;
    title?: string;
    closable?: boolean;
    panelClass?: string;
  }>(),
  {
    title: '',
    closable: true,
    panelClass: 'max-w-md',
  },
);

const emit = defineEmits<{ close: [] }>();

const titleId = useId();
const panel = ref<HTMLElement | null>(null);
let previousFocus: HTMLElement | null = null;
let previousOverflow = '';
let active = false;

function focusableElements(): HTMLElement[] {
  if (panel.value === null) return [];
  return Array.from(
    panel.value.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

function requestClose(): void {
  if (props.closable) emit('close');
}

function handleKeydown(event: KeyboardEvent): void {
  if (!props.open) return;
  if (event.key === 'Escape' && props.closable) {
    event.preventDefault();
    requestClose();
    return;
  }
  if (event.key !== 'Tab') return;
  const items = focusableElements();
  if (items.length === 0) {
    event.preventDefault();
    panel.value?.focus();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

async function activate(): Promise<void> {
  active = true;
  previousFocus =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  await nextTick();
  const firstInput = panel.value?.querySelector<HTMLElement>(
    'input, textarea, select',
  );
  if (firstInput !== undefined && firstInput !== null) firstInput.focus();
  else panel.value?.focus();
}

function deactivate(): void {
  if (!active) return;
  active = false;
  document.body.style.overflow = previousOverflow;
  previousFocus?.focus();
  previousFocus = null;
}

watch(
  () => props.open,
  (open) => {
    if (open) void activate();
    else deactivate();
  },
  { immediate: true },
);

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown);
  if (props.open) deactivate();
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4"
      @mousedown.self="requestClose"
    >
      <div
        ref="panel"
        :class="[
          'w-full rounded-lg border border-zinc-200 bg-white shadow-xl outline-none dark:border-zinc-800 dark:bg-zinc-900',
          panelClass,
        ]"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="title !== '' ? titleId : undefined"
        tabindex="-1"
      >
        <div
          v-if="title !== '' || closable"
          class="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800"
        >
          <h2
            v-if="title !== ''"
            :id="titleId"
            class="text-base font-semibold text-zinc-900 dark:text-zinc-100"
          >
            {{ title }}
          </h2>
          <span v-else />
          <button
            v-if="closable"
            type="button"
            class="btn btn-ghost -mr-2 -mt-1 size-8 p-0"
            aria-label="关闭"
            @click="requestClose"
          >
            <X :size="18" />
          </button>
        </div>
        <div class="px-5 py-4">
          <slot />
        </div>
        <div
          v-if="$slots.footer"
          class="flex justify-end gap-2 border-t border-zinc-200 px-5 py-3 dark:border-zinc-800"
        >
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
