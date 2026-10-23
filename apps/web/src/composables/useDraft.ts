import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useContestStore } from '@/stores/contest';
import { draftKey, readDraft, writeDraft } from '@/lib/storage';

export function useDraft(pid: string) {
  const contest = useContestStore();
  const key = computed(() =>
    contest.state === null
      ? null
      : draftKey(contest.state.config.id, pid),
  );
  const text = ref(key.value === null ? '' : readDraft(key.value));
  let timer: number | null = null;

  function flush(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (key.value !== null) writeDraft(key.value, text.value);
  }

  watch(key, (next, previous) => {
    if (previous !== null) {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      writeDraft(previous, text.value);
    }
    text.value = next === null ? '' : readDraft(next);
  });

  watch(text, () => {
    if (key.value === null) return;
    if (timer !== null) clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = null;
      if (key.value !== null) writeDraft(key.value, text.value);
    }, 400);
  });

  onBeforeUnmount(flush);

  return { text, flush };
}
