import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { AuthStatus, AuthUser, LoginStatus } from '@vp/core';
import { api } from '@/lib/api';

const EMPTY_LOGIN: LoginStatus = { state: 'idle', user: null, error: null };

export const useSessionStore = defineStore('session', () => {
  const user = ref<AuthUser | null>(null);
  const checked = ref(false);
  const checking = ref(false);
  const error = ref<string | null>(null);
  const loginStatus = ref<LoginStatus>({ ...EMPTY_LOGIN });
  const loginDialogOpen = ref(false);
  const loginChecking = ref(false);

  let pollTimer: number | null = null;

  async function check(force = false): Promise<void> {
    if (checking.value && !force) return;
    checking.value = true;
    try {
      const status = await api.get<AuthStatus>('/api/auth/status');
      user.value = status.user;
      error.value = status.error;
    } catch (requestError) {
      error.value =
        requestError instanceof Error
          ? requestError.message
          : '无法连接本地服务。';
    } finally {
      checked.value = true;
      checking.value = false;
    }
  }

  function stopPolling(): void {
    if (pollTimer !== null) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  function applyLoginStatus(status: LoginStatus): void {
    loginStatus.value = status;
    if (status.state === 'success') {
      stopPolling();
      if (status.user !== null) user.value = status.user;
      loginDialogOpen.value = false;
    }
  }

  // 这里只轮询本地服务端的登录状态（127.0.0.1），用于发现登录窗口被关闭、
  // 同步错误提示；对洛谷的登录检测完全由用户点击“我已完成登录”触发。
  function schedulePoll(): void {
    stopPolling();
    pollTimer = window.setTimeout(async () => {
      pollTimer = null;
      try {
        const status = await api.get<LoginStatus>('/api/auth/login');
        applyLoginStatus(status);
        if (status.state === 'waiting') schedulePoll();
      } catch (requestError) {
        loginStatus.value = {
          state: 'error',
          user: null,
          error:
            requestError instanceof Error
              ? requestError.message
              : '无法获取登录状态。',
        };
      }
    }, 1000);
  }

  async function startLogin(force = false): Promise<void> {
    loginStatus.value = { state: 'waiting', user: null, error: null };
    try {
      const status = await api.post<LoginStatus>('/api/auth/login', { force });
      applyLoginStatus(status);
      if (status.state === 'waiting') schedulePoll();
    } catch (requestError) {
      loginStatus.value = {
        state: 'error',
        user: null,
        error:
          requestError instanceof Error
            ? requestError.message
            : '无法打开登录窗口。',
      };
    }
  }

  async function openLogin(force = false): Promise<void> {
    loginDialogOpen.value = true;
    if (loginStatus.value.state === 'waiting') return;
    if (!force && user.value !== null) {
      loginDialogOpen.value = false;
      return;
    }
    await startLogin(force);
  }

  async function checkLoginNow(): Promise<void> {
    if (loginChecking.value) return;
    loginChecking.value = true;
    try {
      const status = await api.post<LoginStatus>('/api/auth/login/check');
      applyLoginStatus(status);
    } catch (requestError) {
      loginStatus.value = {
        state: 'waiting',
        user: null,
        error:
          requestError instanceof Error
            ? requestError.message
            : '无法检查登录状态，请稍后重试。',
      };
    } finally {
      loginChecking.value = false;
    }
  }

  async function cancelLogin(): Promise<void> {
    stopPolling();
    loginDialogOpen.value = false;
    loginStatus.value = { state: 'cancelled', user: null, error: null };
    try {
      await api.post<LoginStatus>('/api/auth/login/cancel');
    } catch {
      // 取消失败不阻塞界面。
    }
  }

  async function logout(): Promise<void> {
    try {
      await api.post('/api/auth/logout');
    } finally {
      user.value = null;
    }
  }

  return {
    user,
    checked,
    checking,
    error,
    loginStatus,
    loginDialogOpen,
    loginChecking,
    check,
    openLogin,
    startLogin,
    checkLoginNow,
    cancelLogin,
    logout,
  };
});
