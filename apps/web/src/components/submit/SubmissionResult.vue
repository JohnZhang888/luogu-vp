<script setup lang="ts">
import type { ContestFormat, JudgeResult } from '@vp/core';
import { formatMemory, formatRecordTime } from '@/lib/format';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import JudgeDetails from './JudgeDetails.vue';

const props = defineProps<{
  judge: JudgeResult;
  format: ContestFormat;
}>();

function isScored(): boolean {
  return props.format !== 'icpc';
}
</script>

<template>
  <div class="card space-y-4 p-4">
    <div class="flex flex-wrap items-center gap-2">
      <StatusBadge
        :status-key="judge.statusKey"
        :status-name="judge.statusName"
        :short-name="judge.statusShortName"
        :score="isScored() ? judge.score : null"
        :pending="false"
      />
      <span class="text-xs text-zinc-500 dark:text-zinc-400">
        {{ formatRecordTime(judge.timeMs) }} · {{ formatMemory(judge.memoryKb ?? 0) }}
      </span>
      <span
        v-if="isScored() && judge.statusKey === 'AC'"
        class="text-xs text-zinc-500 dark:text-zinc-400"
      >
        得分 {{ judge.score }}
      </span>
    </div>
    <JudgeDetails :judge="judge" />
  </div>
</template>
