import { createRouter, createWebHistory, type Router } from 'vue-router';
import type { useContestStore } from '@/stores/contest';
import CreateView from '@/views/CreateView.vue';
import ContestView from '@/views/ContestView.vue';
import ProblemView from '@/views/ProblemView.vue';
import SubmitView from '@/views/SubmitView.vue';
import ResultsView from '@/views/ResultsView.vue';

type ContestStore = ReturnType<typeof useContestStore>;

export function createAppRouter(contest: ContestStore): Router {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', name: 'home', component: CreateView },
      { path: '/create', name: 'create', component: CreateView },
      { path: '/contest', name: 'contest', component: ContestView },
      {
        path: '/contest/problem/:pid',
        name: 'problem',
        component: ProblemView,
        props: true,
      },
      {
        path: '/contest/problem/:pid/submit',
        name: 'submit',
        component: SubmitView,
        props: true,
      },
      {
        path: '/contest/results',
        name: 'results',
        component: ResultsView,
      },
      { path: '/:pathMatch(.*)*', redirect: '/' },
    ],
    scrollBehavior() {
      return { top: 0 };
    },
  });

  router.beforeEach((to) => {
    const phase = contest.phase;

    if (phase === null) {
      return to.name === 'create' ? true : { name: 'create' };
    }

    if (phase === 'scheduled' || phase === 'paused') {
      return to.name === 'contest' ? true : { name: 'contest' };
    }

    if (phase === 'finished') {
      return to.name === 'results' ? true : { name: 'results' };
    }

    if (to.name === 'home' || to.name === 'create' || to.name === 'results') {
      return { name: 'contest' };
    }

    if (to.name === 'problem' || to.name === 'submit') {
      const pid = String(to.params.pid ?? '');
      const exists = contest.state?.config.problems.some(
        (problem) => problem.pid === pid,
      );
      if (exists !== true) return { name: 'contest' };
    }

    return true;
  });

  return router;
}
