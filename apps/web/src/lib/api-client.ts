import type { ApiErrorBody } from '@eterna/shared'

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export class ApiError extends Error {
  status: number
  details?: ApiErrorBody['details']

  constructor(body: ApiErrorBody) {
    super(body.message)
    this.status = body.statusCode
    this.details = body.details
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })

  if (res.status === 204) {
    return undefined as T
  }

  const body: unknown = await res.json().catch(() => null)

  if (!res.ok) {
    throw new ApiError(
      (body as ApiErrorBody | null) ?? {
        statusCode: res.status,
        error: 'Error',
        message: 'Something went wrong. Please try again.',
        path,
        timestamp: new Date().toISOString(),
      },
    )
  }

  return body as T
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'POST', body: data === undefined ? undefined : JSON.stringify(data) }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'PATCH', body: data === undefined ? undefined : JSON.stringify(data) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
