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

/**
 * 详情页「返回列表」。
 * 按这条信息自己的 kind 回到对应入口；没有记录可判断时回到实习。
 */
export function detailBackPath(
  item: { kind: OpportunityKind; status?: OpportunityStatus | null } | null,
): string {
  if (!item || !Object.hasOwn(KIND_PATH, item.kind)) return listPath("internship")
  return listPath(item.kind, item.status)
}
