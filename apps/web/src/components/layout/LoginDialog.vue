<script setup lang="ts">
import { computed } from 'vue';
import { CircleAlert, Loader2 } from 'lucide-vue-next';
import BaseDialog from '@/components/ui/BaseDialog.vue';
import { useSessionStore } from '@/stores/session';

const session = useSessionStore();
const open = computed(() => session.loginDialogOpen);
const waiting = computed(() => session.loginStatus.state === 'waiting');
</script>

<template>
  <BaseDialog
    :open="open"
    title="连接洛谷"
    @close="session.cancelLogin()"
  >
    <div v-if="waiting" class="space-y-3">
      <p class="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <Loader2 :size="16" class="animate-spin text-teal-600" />
        请在弹出的浏览器窗口中完成登录
      </p>
      <p class="text-xs text-zinc-500 dark:text-zinc-400">
        完成登录后窗口会自动关闭。
      </p>
      <p
        v-if="session.loginStatus.error"
        class="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400"
      >
        <CircleAlert :size="14" class="mt-0.5 shrink-0" />
        <span>{{ session.loginStatus.error }}</span>
      </p>
    </div>
    <div
      v-else-if="
        session.loginStatus.state === 'error' ||
        session.loginStatus.state === 'cancelled'
      "
      class="space-y-3"
    >
      <p class="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
        <CircleAlert :size="16" class="mt-0.5 shrink-0" />
        <span>{{ session.loginStatus.error ?? '登录窗口已关闭。' }}</span>
      </p>
      <button type="button" class="btn btn-primary" @click="session.startLogin()">
        重试
      </button>
    </div>
    <p v-else class="text-sm text-zinc-600 dark:text-zinc-400">
      正在打开登录窗口…
    </p>
    <template #footer>
      <button type="button" class="btn btn-secondary" @click="session.cancelLogin()">
        取消
      </button>
      <button
        v-if="waiting"
        type="button"
        class="btn btn-primary"
        :disabled="session.loginChecking"
        @click="session.checkLoginNow()"
      >
        <Loader2 v-if="session.loginChecking" :size="16" class="animate-spin" />
        我已完成登录
      </button>
    </template>
  </BaseDialog>
</template>
