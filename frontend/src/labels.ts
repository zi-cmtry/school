import type { OpportunityKind, OpportunityStatus, SourceTier } from "./domain/opportunity"

export const KIND_LABEL: Record<OpportunityKind, string> = {
  internship: "实习",
  campus_recruit: "校招",
  competition: "竞赛",
}

export const STATUS_LABEL: Record<OpportunityStatus, string> = {
  active: "进行中",
  expired: "已截止",
  duplicate: "重复",
  withdrawn: "已撤回",
}

export const TIER_LABEL: Record<SourceTier, string> = {
  official: "官方",
  campus_channel: "校内渠道",
  student_submit: "同学提交",
  unverified: "未核验",
}

export const TIER_HINT: Record<SourceTier, string> = {
  official: "就业信息网上的实习或校招",
  campus_channel: "白名单站点上的竞赛，或企业自己的校招/招聘页（企业校招）",
  student_submit: "同学提交，当前接口很少使用这一档",
  unverified: "链接和类型对不上，站点不在白名单里，或只是转载聚合页",
}

const BEIJING = "Asia/Shanghai"

export function formatDateTime(value: string): string {
  if (!value) return "原文未提供"
  const time = new Date(value)
  if (Number.isNaN(time.getTime())) return "原文未提供"
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: BEIJING,
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(time)
}

export function deadlineHint(value: string, now: Date): string {
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return ""
  const diff = time - now.getTime()
  if (diff < 0) return "已截止"
  const hours = diff / 36e5
  if (hours < 1) return "不足 1 小时"
  if (hours < 24) return `${Math.round(hours)} 小时内`
  const days = Math.ceil(hours / 24)
  return `还有 ${days} 天`
}

/** datetime-local 的值按北京时间理解，不跟浏览器时区走。 */
export function beijingLocalToIso(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return ""
  const time = new Date(`${value}:00+08:00`)
  if (Number.isNaN(time.getTime())) return ""
  return time.toISOString()
}

export function splitTags(value: string): string[] {
  return value
    .split(/[,，、;；\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function showText(value: string): string {
  return value.trim() ? value : "原文未提供"
}

/** 岗位职责、任职要求、专业要求。原文没有或已经是「未提供」时就显示「未提供」，不改写其余文字。 */
export function excerptOrMissing(value: string | null | undefined): string {
  if (value == null) return "未提供"
  if (!value.trim() || value.trim() === "未提供") return "未提供"
  return value
}
