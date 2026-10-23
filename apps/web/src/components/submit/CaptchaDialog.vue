<script setup lang="ts">
import { ref, watch } from 'vue';
import { CircleAlert } from 'lucide-vue-next';
import BaseDialog from '@/components/ui/BaseDialog.vue';
import Spinner from '@/components/ui/Spinner.vue';

const props = defineProps<{
  open: boolean;
  imageDataUrl: string;
  submitting: boolean;
}>();

const emit = defineEmits<{
  submit: [answer: string];
  cancel: [];
}>();

const answer = ref('');
const error = ref<string | null>(null);
let previousImage = '';

function submit(): void {
  const value = answer.value.trim();
  if (value === '') {
    error.value = '请输入验证码。';
    return;
  }
  error.value = null;
  emit('submit', value);
}

function cancel(): void {
  answer.value = '';
  error.value = null;
  emit('cancel');
}

watch(
  () => props.imageDataUrl,
  (image) => {
    if (image === previousImage) return;
    if (previousImage !== '' && props.open) {
      error.value = '验证码不正确，请重试。';
    }
    previousImage = image;
    answer.value = '';
  },
);

watch(
  () => props.open,
  (open) => {
    if (open) {
      error.value = null;
      answer.value = '';
    } else {
      previousImage = '';
    }
  },
);
</script>

<template>
  <BaseDialog
    :open="open"
    title="请输入验证码"
    :closable="!submitting"
    @close="cancel"
  >
    <div class="space-y-3">
      <img
        v-if="imageDataUrl !== ''"
        :src="imageDataUrl"
        alt="验证码"
        class="rounded border border-zinc-200 bg-white dark:border-zinc-700"
      />
      <input
        v-model="answer"
        class="input"
        type="text"
        inputmode="text"
        maxlength="32"
        autocomplete="off"
        spellcheck="false"
        placeholder="验证码"
        :disabled="submitting"
        @keydown.enter.prevent="submit"
      />
      <p v-if="error" class="flex items-start gap-1.5 field-error">
        <CircleAlert :size="14" class="mt-0.5 shrink-0" />
        <span>{{ error }}</span>
      </p>
    </div>
    <template #footer>
      <button type="button" class="btn btn-secondary" :disabled="submitting" @click="cancel">
        取消
      </button>
      <button type="button" class="btn btn-primary" :disabled="submitting" @click="submit">
        <Spinner v-if="submitting" :size="16" />
        提交
      </button>
    </template>
  </BaseDialog>
</template>
