<script setup lang="ts">
import { FlaskConical } from 'lucide-vue-next';
import { MOCK_PROBLEM_TITLE } from '@vp/core';
</script>

<template>
  <div class="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
    <p class="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
      <FlaskConical :size="16" class="shrink-0 text-teal-600 dark:text-teal-400" />
      虚构测试比赛
    </p>
    <p class="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
      内置一道虚构题目，不访问洛谷、无需登录。提交任意代码都会返回覆盖
      AC / WA / TLE / MLE / RE / OLE / UKE 的虚构评测结果，用于测试提交流程与结果展示。
    </p>
    <ul class="mt-3 space-y-1.5">
      <li class="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <span class="w-5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          A
        </span>
        <span class="truncate">{{ MOCK_PROBLEM_TITLE }}</span>
      </li>
    </ul>
  </div>
</template>
