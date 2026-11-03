import { ApiError, type FieldError } from "../domain/opportunity"

type DetailItem = { loc?: unknown; msg?: unknown }

export function formatDetail(detail: unknown): string {
  if (typeof detail === "string") return detail
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (!item || typeof item !== "object") return String(item)
        const row = item as DetailItem
        const loc = Array.isArray(row.loc)
          ? row.loc.filter((part) => part !== "body").map(String).join(".")
          : ""
        const msg = typeof row.msg === "string" ? row.msg : ""
        if (loc && msg) return `${loc}: ${msg}`
        return msg || loc || "validation error"
      })
      .filter(Boolean)
      .join("；")
  }
  return ""
}

export function fieldsFromDetail(detail: unknown): FieldError[] {
  if (!Array.isArray(detail)) {
    if (typeof detail === "string" && detail.toLowerCase().includes("source_url")) {
      return [{ field: "source_url", message: detail }]
    }
    return []
  }
  const fields: FieldError[] = []
  for (const item of detail) {
    if (!item || typeof item !== "object") continue
    const row = item as DetailItem
    const loc = Array.isArray(row.loc) ? row.loc.map(String).filter((part) => part !== "body") : []
    const field = loc[loc.length - 1]
    const msg = typeof row.msg === "string" ? row.msg : "validation error"
    if (field) fields.push({ field, message: msg })
  }
  return fields
}

export async function errorFromResponse(response: Response): Promise<ApiError> {
  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    body = null
  }
  const detail =
    body && typeof body === "object" && "detail" in body ? (body as { detail: unknown }).detail : undefined
  const message = formatDetail(detail) || response.statusText || "请求失败"
  const code = response.status === 409 ? "duplicate" : response.status === 400 || response.status === 422 ? "validation" : "http"
  return new ApiError(response.status, code, message, { fields: fieldsFromDetail(detail), origin: "api" })
}
