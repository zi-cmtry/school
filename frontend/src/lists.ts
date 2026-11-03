import type { OpportunityKind, OpportunityStatus } from "./domain/opportunity"

export const KIND_PATH: Record<OpportunityKind, string> = {
  internship: "/internships",
  campus_recruit: "/campus",
  competition: "/competitions",
}

export const KIND_PAGE_TITLE: Record<OpportunityKind, string> = {
  internship: "实习",
  campus_recruit: "校招",
  competition: "竞赛",
}

export function listPath(kind: OpportunityKind, status?: OpportunityStatus | null, created?: string): string {
  const params = new URLSearchParams()
  if (status && status !== "active") params.set("status", status)
  if (created) params.set("created", created)
  const search = params.toString()
  return `${KIND_PATH[kind]}${search ? `?${search}` : ""}`
}
