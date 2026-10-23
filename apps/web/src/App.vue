<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';
import { useContestStore } from './stores/contest';
import { useSessionStore } from './stores/session';
import { useSubmissionStore } from './stores/submission';
import AppHeader from './components/layout/AppHeader.vue';
import PauseOverlay from './components/layout/PauseOverlay.vue';
import LoginDialog from './components/layout/LoginDialog.vue';

const contest = useContestStore();
const session = useSessionStore();
const submissions = useSubmissionStore();
const route = useRoute();
const router = useRouter();

onMounted(() => {
  void session.check();
  submissions.resumePolling();
});

watch(
  () => contest.phase,
  (phase) => {
    if (phase === null) return;
    if (phase === 'finished' && route.name !== 'results') {
      void router.push({ name: 'results' });
    } else if (
      (phase === 'paused' || phase === 'scheduled') &&
      route.name !== 'contest'
    ) {
      void router.push({ name: 'contest' });
    }
  },
);
</script>

<template>
  <div class="min-h-dvh">
    <AppHeader />
    <RouterView :key="route.fullPath" />
    <PauseOverlay v-if="contest.phase === 'paused'" />
    <LoginDialog />
  </div>
</template>
