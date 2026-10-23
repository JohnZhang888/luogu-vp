<script setup lang="ts">
import type { ProblemDetail } from '@vp/core';
import { formatLimitTime, formatMemory } from '@/lib/format';
import MarkdownContent from './MarkdownContent.vue';
import SampleBlock from './SampleBlock.vue';

defineProps<{
  problem: ProblemDetail;
  letter: string;
}>();
</script>

<template>
  <article class="space-y-8">
    <header class="space-y-2">
      <div class="flex items-start gap-2">
        <span
          class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded border border-zinc-200 text-xs font-semibold text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
        >
          {{ letter }}
        </span>
        <h1 class="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          {{ problem.title }}
        </h1>
      </div>
      <p class="text-xs text-zinc-500 dark:text-zinc-400">
        时间限制 {{ formatLimitTime(problem.timeLimitMs) }} · 内存限制
        {{ formatMemory(problem.memoryLimitKb) }}
      </p>
    </header>

    <section v-if="problem.content.background.trim() !== ''">
      <MarkdownContent :source="problem.content.background" />
    </section>

    <section v-if="problem.content.description.trim() !== ''" class="space-y-3">
      <h2 class="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        题目描述
      </h2>
      <MarkdownContent :source="problem.content.description" />
    </section>

    <section v-if="problem.content.formatI.trim() !== ''" class="space-y-3">
      <h2 class="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        输入格式
      </h2>
      <MarkdownContent :source="problem.content.formatI" />
    </section>

    <section v-if="problem.content.formatO.trim() !== ''" class="space-y-3">
      <h2 class="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        输出格式
      </h2>
      <MarkdownContent :source="problem.content.formatO" />
    </section>

    <section v-if="problem.samples.length > 0" class="space-y-4">
      <h2 class="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        样例
      </h2>
      <SampleBlock
        v-for="(sample, index) in problem.samples"
        :key="index"
        :index="index"
        :input="sample.input"
        :output="sample.output"
      />
    </section>

    <section v-if="problem.content.hint.trim() !== ''" class="space-y-3">
      <h2 class="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        提示
      </h2>
      <MarkdownContent :source="problem.content.hint" />
    </section>
  </article>
</template>
