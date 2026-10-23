<script setup lang="ts">
import type { ContestFormat } from '@vp/core';
import { CONTEST_FORMAT_LABELS } from '@vp/core';

const props = defineProps<{ format: ContestFormat }>();
</script>

<template>
  <span
    class="badge border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
  >
    {{ CONTEST_FORMAT_LABELS[props.format] }}
  </span>
</template>
