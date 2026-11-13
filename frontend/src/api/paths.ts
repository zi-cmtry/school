import type { ListQuery } from "../domain/opportunity"

export const API_PREFIX = "/api/v1"

export function opportunityCollectionPath(query: ListQuery = {}): string {
  const params = new URLSearchParams()
  if (query.kind) params.set("kind", query.kind)
  if (query.status) params.set("status", query.status)
  if (query.region) params.set("region", query.region)
  if (query.major) params.set("major", query.major)
  const search = params.toString()
  return `${API_PREFIX}/opportunities${search ? `?${search}` : ""}`
}

export function opportunityItemPath(id: string): string {
  return `${API_PREFIX}/opportunities/${encodeURIComponent(id)}`
}
