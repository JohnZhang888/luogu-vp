import { appConfig } from '../config';
import {
  AppError,
  AuthRequiredError,
  LuoguApiError,
  isAuthError,
} from '../errors';
import { sleep } from '../util/fs';
import { asNumber, asRecord, asString, isRecord } from '../util/guards';

export interface LuoguRequestOptions {
  cookies?: string | null;
  timeoutMs?: number;
  retries?: number;
}

export interface RawJsonResponse {
  status: number;
  data: Record<string, unknown>;
}

interface JarCookie {
  value: string;
  expiresAt: number | null;
}

const DEFAULT_HEADERS: Record<string, string> = {
  'user-agent': appConfig.userAgent,
  accept: 'application/json, text/plain, */*',
  'accept-language': 'zh-CN,zh;q=0.9',
  'x-lentille-request': 'content-only',
};

/** 洛谷会对部分 UA 下发 C3VK Cookie 并 302 回同一地址，需要一个轻量 Cookie 罐。 */
const cookieJar = new Map<string, JarCookie>();

function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${appConfig.luoguBase}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}

function rememberSetCookies(headers: Headers): void {
  const withSetter = headers as Headers & { getSetCookie?: () => string[] };
  const list =
    typeof withSetter.getSetCookie === 'function'
      ? withSetter.getSetCookie()
      : [];
  if (list.length === 0) {
    const single = headers.get('set-cookie');
    if (single !== null) list.push(single);
  }

  for (const cookie of list) {
    const parts = cookie.split(';');
    const pair = parts[0] ?? '';
    const equals = pair.indexOf('=');
    if (equals <= 0) continue;
    const name = pair.slice(0, equals).trim();
    const value = pair.slice(equals + 1).trim();
    if (name === '') continue;

    let expiresAt: number | null = null;
    for (const attribute of parts.slice(1)) {
      const equalsIndex = attribute.indexOf('=');
      if (equalsIndex < 0) continue;
      const key = attribute.slice(0, equalsIndex).trim().toLowerCase();
      const rawValue = attribute.slice(equalsIndex + 1).trim();
      if (key === 'max-age') {
        const seconds = Number(rawValue);
        if (Number.isFinite(seconds)) expiresAt = Date.now() + seconds * 1000;
      } else if (key === 'expires' && expiresAt === null) {
        const parsed = Date.parse(rawValue);
        if (!Number.isNaN(parsed)) expiresAt = parsed;
      }
    }

    if (expiresAt !== null && expiresAt <= Date.now()) {
      cookieJar.delete(name);
    } else {
      cookieJar.set(name, { value, expiresAt });
    }
  }
}

function buildCookieHeader(sessionCookies?: string | null): string | undefined {
  const now = Date.now();
  const jarPairs: string[] = [];
  for (const [name, cookie] of cookieJar) {
    if (cookie.expiresAt !== null && cookie.expiresAt <= now) {
      cookieJar.delete(name);
      continue;
    }
    jarPairs.push(`${name}=${cookie.value}`);
  }

  if (!sessionCookies) return jarPairs.length > 0 ? jarPairs.join('; ') : undefined;
  if (jarPairs.length === 0) return sessionCookies;

  // 会话 Cookie 里可能带有旧的 C3VK；重定向挑战下发的 C3VK 必须覆盖它，
  // 否则会一直 302 回同一地址。
  const merged = new Map<string, string>();
  for (const part of sessionCookies.split(';')) {
    const trimmed = part.trim();
    if (trimmed === '') continue;
    const equals = trimmed.indexOf('=');
    if (equals <= 0) continue;
    merged.set(trimmed.slice(0, equals), trimmed.slice(equals + 1));
  }
  for (const pair of jarPairs) {
    const equals = pair.indexOf('=');
    if (equals <= 0) continue;
    const name = pair.slice(0, equals);
    // 登录身份始终以保存的会话 Cookie 为准，避免匿名请求写入的同名 Cookie 覆盖登录态。
    if (name === '__client_id' || name === '_uid') continue;
    merged.set(name, pair.slice(equals + 1));
  }
  return [...merged.entries()]
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

async function fetchFollowingRedirects(
  initialUrl: string,
  options: LuoguRequestOptions,
): Promise<{ status: number; text: string }> {
  let url = initialUrl;
  for (let hop = 0; hop <= 5; hop += 1) {
    const headers: Record<string, string> = { ...DEFAULT_HEADERS };
    const cookie = buildCookieHeader(options.cookies);
    if (cookie !== undefined) headers.cookie = cookie;

    const response = await fetch(url, {
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(options.timeoutMs ?? appConfig.requestTimeoutMs),
    });
    rememberSetCookies(response.headers);

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location === null) {
        return { status: response.status, text: await response.text() };
      }
      url = new URL(location, url).toString();
      continue;
    }

    return { status: response.status, text: await response.text() };
  }

  throw new AppError(
    'LUOGU_REDIRECT_LOOP',
    '洛谷返回了过多重定向，请稍后重试。',
    502,
  );
}

/**
 * 发送一次洛谷请求并返回原始 JSON。HTTP 错误状态不会直接抛出，便于提交接口自行判断错误类型。
 */
export async function luoguRequest(
  pathOrUrl: string,
  options: LuoguRequestOptions = {},
): Promise<RawJsonResponse> {
  const url = absoluteUrl(pathOrUrl);
  const retries = options.retries ?? 2;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const { status, text } = await fetchFollowingRedirects(url, options);
      let data: Record<string, unknown>;
      try {
        const parsed: unknown = JSON.parse(text);
        data = isRecord(parsed) ? parsed : { raw: text };
      } catch {
        data = { raw: text };
      }
      if (status >= 500 && attempt < retries) {
        lastError = new Error(`HTTP ${status}`);
        await sleep(300 * (attempt + 1));
        continue;
      }
      return { status, data };
    } catch (error) {
      if (error instanceof AppError) throw error;
      lastError = error;
      if (attempt < retries) {
        await sleep(300 * (attempt + 1));
      }
    }
  }

  const message = lastError instanceof Error ? lastError.message : '网络请求失败';
  throw new AppError(
    'LUOGU_UNAVAILABLE',
    `无法连接洛谷（${message}），请检查网络或代理设置。`,
    502,
  );
}

function errorMessage(data: Record<string, unknown>): string {
  const direct = data.errorMessage;
  if (typeof direct === 'string' && direct.trim() !== '') return direct;
  const payload = data.data;
  if (typeof payload === 'string' && payload.trim() !== '') return payload;
  if (isRecord(payload)) {
    const nested = payload.errorMessage;
    if (typeof nested === 'string' && nested.trim() !== '') return nested;
  }
  if (typeof data.raw === 'string' && data.raw.trim() !== '') {
    return '洛谷返回了无法解析的响应。';
  }
  return '洛谷接口返回错误。';
}

/**
 * 读取洛谷 content-only JSON，遇到错误状态或登录失效时抛出 AppError。
 */
export async function luoguJson<T = Record<string, unknown>>(
  pathOrUrl: string,
  options: LuoguRequestOptions = {},
): Promise<T> {
  const { status, data } = await luoguRequest(pathOrUrl, options);
  const errorType = asString(data.errorType) || null;
  const payloadStatus = asNumber(data.status, 0);
  const isError =
    status >= 400 || payloadStatus >= 400 || data.template === 'error';

  if (!isError) {
    return data as T;
  }

  if (status === 401 || status === 403 || payloadStatus === 401 || payloadStatus === 403) {
    if (isAuthError(errorType) || asNumber(asRecord(data.data).needLogin, 0) === 1) {
      throw new AuthRequiredError();
    }
  }
  if (isAuthError(errorType)) throw new AuthRequiredError();

  if (status === 404 || payloadStatus === 404) {
    throw new AppError('LUOGU_NOT_FOUND', '洛谷上找不到对应的资源。', 404);
  }

  throw new LuoguApiError(errorMessage(data), errorType, status >= 500 ? 502 : 400);
}
