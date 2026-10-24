<script setup lang="ts">
import { computed } from 'vue';
import { Loader2 } from 'lucide-vue-next';
import { verdictTone } from '@/lib/verdict';

const props = defineProps<{
  statusKey: string;
  statusName: string;
  shortName?: string | null;
  score?: number | null;
  pending?: boolean;
}>();

const styleClass = computed(() => verdictTone(props.statusKey, props.pending === true).badge);

const label = computed(() => {
  if (props.pending) return '评测中';
  const short = props.shortName ?? props.statusKey;
  if (props.score !== null && props.score !== undefined && props.statusKey !== 'AC') {
    return `${short} · ${props.score}`;
  }
  return short;
});
</script>

<template>
  <span :class="['badge', styleClass]" :title="statusName">
    <Loader2
      v-if="pending"
      :size="12"
      class="animate-spin"
      aria-hidden="true"
    />
    {{ label }}
  </span>
</template>
