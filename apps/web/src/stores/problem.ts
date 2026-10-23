import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { ProblemDetail } from '@vp/core';
import { api } from '@/lib/api';

export const useProblemStore = defineStore('problem', () => {
  const cache = ref<Record<string, ProblemDetail>>({});
  const loading = ref<Record<string, boolean>>({});
  const errors = ref<Record<string, string | null>>({});
  const inFlight = new Map<string, Promise<ProblemDetail>>();

  function get(pid: string): ProblemDetail | null {
    return cache.value[pid] ?? null;
  }

  async function load(pid: string): Promise<ProblemDetail> {
    const cached = cache.value[pid];
    if (cached !== undefined) return cached;

    const existing = inFlight.get(pid);
    if (existing !== undefined) return existing;

    loading.value = { ...loading.value, [pid]: true };
    errors.value = { ...errors.value, [pid]: null };

    const promise = api
      .get<ProblemDetail>(`/api/luogu/problem/${encodeURIComponent(pid)}`)
      .then((detail) => {
        cache.value = { ...cache.value, [pid]: detail };
        return detail;
      })
      .catch((error: unknown) => {
        errors.value = {
          ...errors.value,
          [pid]:
            error instanceof Error ? error.message : '无法读取题目。',
        };
        throw error;
      })
      .finally(() => {
        loading.value = { ...loading.value, [pid]: false };
        inFlight.delete(pid);
      });

    inFlight.set(pid, promise);
    return promise;
  }

  function clear(): void {
    cache.value = {};
    loading.value = {};
    errors.value = {};
    inFlight.clear();
  }

  return { cache, loading, errors, get, load, clear };
});
