<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Clock } from 'lucide-vue-next';
import { useContestStore } from '@/stores/contest';
import { useSubmissionStore } from '@/stores/submission';
import { formatClock, formatDateTime } from '@/lib/format';
import FormatBadge from '@/components/ui/FormatBadge.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';

const router = useRouter();
const contest = useContestStore();
const submissions = useSubmissionStore();
const confirmOpen = ref(false);

const startAt = computed(() => contest.state?.config.startAt ?? 0);
const untilStart = computed(() => Math.max(0, startAt.value - contest.now));

function cancelContest(): void {
  confirmOpen.value = false;
  submissions.reset();
  contest.clear();
  void router.push({ name: 'create' });
}
</script>

<template>
  <main class="mx-auto flex max-w-2xl flex-col items-center px-4 py-16 sm:px-6">
    <div class="w-full">
      <div class="flex items-center gap-2">
        <FormatBadge v-if="contest.state" :format="contest.state.config.format" />
        <span class="hint">等待开始</span>
      </div>
      <h1 class="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        {{ contest.state?.config.name }}
      </h1>
      <p class="mt-1 flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
        <Clock :size="15" />
        {{ formatDateTime(startAt) }}
      </p>

      <div class="card mt-8 p-6">
        <p class="text-sm text-zinc-500 dark:text-zinc-400">距离开始</p>
        <p class="mt-2 font-mono text-4xl tabular-nums text-zinc-900 dark:text-zinc-100">
          {{ formatClock(untilStart) }}
        </p>
      </div>

      <button
        type="button"
        class="btn btn-secondary mt-6"
        @click="confirmOpen = true"
      >
        取消比赛
      </button>
    </div>

    <ConfirmDialog
      :open="confirmOpen"
      title="取消比赛"
      message="取消后本场比赛的配置会被删除。"
      confirm-text="取消比赛"
      cancel-text="返回"
      danger
      @confirm="cancelContest"
      @cancel="confirmOpen = false"
    />
  </main>
</template>
