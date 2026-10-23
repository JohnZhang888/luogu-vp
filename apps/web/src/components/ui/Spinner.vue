<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next';

withDefaults(defineProps<{ size?: number }>(), { size: 18 });
</script>

<template>
  <Loader2 :size="size" class="animate-spin" aria-hidden="true" />
</template>
