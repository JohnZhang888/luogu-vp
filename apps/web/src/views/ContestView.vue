<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useContestStore } from '@/stores/contest';
import WaitingRoom from './WaitingRoom.vue';
import ContestOverview from './ContestOverview.vue';

const router = useRouter();
const contest = useContestStore();
const phase = computed(() => contest.phase);

watch(
  phase,
  (value) => {
    if (value === 'finished') void router.replace({ name: 'results' });
  },
  { immediate: true },
);
</script>

<template>
  <WaitingRoom v-if="phase === 'scheduled'" />
  <ContestOverview v-else-if="phase === 'running' || phase === 'paused'" />
</template>
