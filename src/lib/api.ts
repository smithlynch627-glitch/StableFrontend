import { API_URL } from '../config';

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type Params = Record<string, string | number | boolean | null | undefined>;

function url(path: string, params?: Params) {
  const u = new URL(API_URL + '/api' + path);
  if (params) for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, String(v));
  return u.toString();
}

async function handle<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error || `Request failed (${res.status})`, body.code);
  return body as T;
}

const send = <T>(method: string, path: string, body?: unknown, token?: string | null) =>
  fetch(url(path), {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then((r) => handle<T>(r));

export const api = {
  get: <T>(path: string, params?: Params, token?: string | null) =>
    fetch(url(path, params), token ? { headers: { authorization: `Bearer ${token}` } } : undefined).then((r) => handle<T>(r)),
  post: <T>(path: string, body?: unknown, token?: string | null) => send<T>('POST', path, body ?? {}, token),
  put: <T>(path: string, body: unknown, token: string) => send<T>('PUT', path, body, token),
  patch: <T>(path: string, body: unknown, token: string) => send<T>('PATCH', path, body, token),
  del: <T>(path: string, token: string) => send<T>('DELETE', path, undefined, token),
  upload: <T>(path: string, file: File, token: string, fields: Record<string, string> = {}) => {
    const fd = new FormData();
    fd.append('file', file);
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    return fetch(url(path), { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: fd }).then((r) => handle<T>(r));
  },
};
