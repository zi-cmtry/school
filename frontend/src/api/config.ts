/** 后端默认地址。可用 VITE_API_BASE_URL 覆盖。 */
export const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000"

function envValue(name: keyof ImportMetaEnv): string | undefined {
  const env = import.meta.env
  if (!env) return undefined
  const value = env[name]
  return typeof value === "string" ? value : undefined
}

export function apiBaseUrl(): string {
  const configured = envValue("VITE_API_BASE_URL")
  const value = configured && configured.trim() ? configured.trim() : DEFAULT_API_BASE_URL
  return value.replace(/\/$/, "")
}

/** VITE_USE_MOCK=1 时不请求后端。 */
export function useMock(): boolean {
  const flag = envValue("VITE_USE_MOCK")
  return flag === "1" || flag === "true"
}
