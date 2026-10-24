<script setup lang="ts">
import { computed } from 'vue';
import type { JudgeTestCase } from '@vp/core';
import { formatMemory, formatRecordTime, formatScore } from '@/lib/format';
import { verdictCardLabel, verdictTone } from '@/lib/verdict';

const props = defineProps<{
  testCase: JudgeTestCase;
  showScore?: boolean;
}>();

const tone = computed(() => verdictTone(props.testCase.statusKey));
const scoreVisible = computed(
  () => props.showScore === true && props.testCase.score > 0,
);
</script>

<template>
  <div
    :title="testCase.statusName"
    :class="[
      'flex items-center justify-between gap-2 rounded-md border px-3 py-2.5',
      tone.card,
    ]"
  >
    <span
      :class="['text-lg font-bold leading-none tracking-tight', tone.strong]"
    >
      {{ verdictCardLabel(testCase.statusKey) }}
    </span>
    <span :class="['text-right text-xs leading-4', tone.meta]">
      <span class="block font-medium">
        #{{ testCase.id }}<template v-if="scoreVisible"> · {{ formatScore(testCase.score) }} 分</template>
      </span>
      <span class="block">{{ formatRecordTime(testCase.timeMs) }}</span>
      <span class="block">{{
        testCase.memoryKb === null ? '—' : formatMemory(testCase.memoryKb)
      }}</span>
    </span>
  </div>
</template>
