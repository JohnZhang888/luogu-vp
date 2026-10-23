<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { LogIn, Pause, User } from 'lucide-vue-next';
import { useContestStore } from '@/stores/contest';
import { useSessionStore } from '@/stores/session';
import ThemeMenu from './ThemeMenu.vue';
import TimerDisplay from '@/components/contest/TimerDisplay.vue';

const contest = useContestStore();
const session = useSessionStore();

const hasContest = computed(() => contest.state !== null);
const showTimer = computed(
  () => contest.phase === 'running' || contest.phase === 'paused',
);
const canPause = computed(
  () => contest.phase === 'running' && contest.allowPause,
);
</script>

<template>
  <header
    class="sticky top-0 z-30 border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
  >
    <div class="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
      <RouterLink to="/" class="flex items-center gap-2" aria-label="VP 首页">
        <span
          class="flex size-7 items-center justify-center rounded-md bg-teal-600 text-xs font-bold tracking-wide text-white"
        >
          VP
        </span>
      </RouterLink>

      <div v-if="hasContest && contest.state" class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {{ contest.state.config.name }}
        </p>
        <p class="text-xs text-zinc-500 dark:text-zinc-400">
          {{ contest.formatLabel }}
        </p>
      </div>
      <div v-else class="flex-1" />

      <TimerDisplay v-if="showTimer" />

      <button
        v-if="canPause"
        type="button"
        class="btn btn-ghost size-9 p-0"
        title="暂停比赛"
        aria-label="暂停比赛"
        @click="contest.pause()"
      >
        <Pause :size="18" />
      </button>

      <ThemeMenu />

      <button
        v-if="session.user === null"
        type="button"
        class="btn btn-secondary h-9 px-3 text-xs"
        @click="session.openLogin()"
      >
        <LogIn :size="15" />
        <span class="hidden sm:inline">连接洛谷</span>
      </button>
      <button
        v-else
        type="button"
        class="flex items-center gap-1.5 rounded px-1.5 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        title="重新登录"
        @click="session.openLogin(true)"
      >
        <User :size="15" />
        <span class="hidden max-w-32 truncate sm:inline">@{{ session.user?.name }}</span>
      </button>
    </div>
  </header>
</template>
