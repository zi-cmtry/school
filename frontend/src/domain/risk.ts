/**
 * 与 backend/app/services/risk.py 的 RISK_FLAGS、schemas.OpportunityOut.risk_flags 一致。
 * 接口给代码，页面只映射成简短中文。不根据正文现算，也不新增代码。
 */

export const RISK_FLAGS = [
  "no_official_source",
  "aggregator_only",
  "pay_to_apply",
  "domain_mismatch",
  "deadline_conflict",
] as const

export type RiskFlag = (typeof RISK_FLAGS)[number]

/** 后端字段说明里的含义，收成列表和详情上的短提示。 */
const RISK_FLAG_LABEL: Record<RiskFlag, string> = {
  no_official_source: "无合格源",
  aggregator_only: "二手聚合当唯一源",
  pay_to_apply: "收费定金话术",
  domain_mismatch: "域名不符",
  deadline_conflict: "届次截止矛盾",
}

export function isRiskFlag(value: string): value is RiskFlag {
  return (RISK_FLAGS as readonly string[]).includes(value)
}

/**
 * 只保留接口约定的代码，按返回顺序去重。
 * 缺失、空数组、字符串或其他值都当成没有标志，不编造风险。
 */
export function parseRiskFlags(value: unknown): RiskFlag[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<RiskFlag>()
  const flags: RiskFlag[] = []
  for (const item of value) {
    if (typeof item !== "string") continue
    const code = item.trim()
    if (!isRiskFlag(code) || seen.has(code)) continue
    seen.add(code)
    flags.push(code)
  }
  return flags
}

export function riskFlagLabels(value: unknown): string[] {
  return parseRiskFlags(value).map((flag) => RISK_FLAG_LABEL[flag])
}
