import { makeDedupeKey, type Opportunity } from "../domain/opportunity"
import type { RiskFlag } from "../domain/risk"

/**
 * 前端演示 / 测试夹具，不是真实岗位。
 * 后端种子的 risk_flags 都是空数组，这里不改那些记录，也不把风险写到真实单位上。
 * 代码按接口会返回的组合写死，页面不根据正文重算。
 */

const STAMP = "2026-11-01T00:00:00+08:00"

function demo(input: {
  id: string
  title: string
  deadline_at: string
  source_url: string
  source_name: string
  source_tier: Opportunity["source_tier"]
  risk_flags: RiskFlag[]
}): Opportunity {
  const company = "演示单位（非真实）"
  return {
    id: input.id,
    title: input.title,
    kind: "campus_recruit",
    company,
    role_tags: [],
    location: "成都",
    deadline_at: input.deadline_at,
    source_url: input.source_url,
    source_name: input.source_name,
    source_tier: input.source_tier,
    apply_url: "",
    summary: "演示数据，不是真实岗位。risk_flags 写在测试夹具里，页面只展示这些标注，不补写岗位职责。",
    status: "active",
    dedupe_key: makeDedupeKey(company, input.title, input.deadline_at),
    published_at: STAMP,
    updated_at: STAMP,
    fetched_at: STAMP,
    work_location: "成都",
    responsibilities: "未提供",
    requirements: "未提供",
    major_requirements: "未提供",
    major_tags: ["通用"],
    risk_flags: input.risk_flags,
  }
}

export const demoRiskOpportunities: Opportunity[] = [
  demo({
    id: "demo-risk-aggregator",
    title: "【演示数据】二手聚合站转载样例",
    deadline_at: "2026-11-30T18:00:00+08:00",
    source_url: "https://www.zhaopin.com/demo/risk-aggregator",
    source_name: "演示聚合站",
    source_tier: "unverified",
    risk_flags: ["no_official_source", "aggregator_only"],
  }),
  demo({
    id: "demo-risk-pay",
    title: "【演示数据】收费定金话术样例",
    deadline_at: "2026-12-05T18:00:00+08:00",
    source_url: "https://example.com/demo/risk-pay",
    source_name: "演示来源",
    source_tier: "unverified",
    risk_flags: ["pay_to_apply"],
  }),
  demo({
    id: "demo-risk-domain",
    title: "【演示数据】域名不符样例",
    deadline_at: "2026-12-10T18:00:00+08:00",
    source_url: "https://unrelated-third.example/demo/risk-domain",
    source_name: "演示来源",
    source_tier: "unverified",
    risk_flags: ["no_official_source", "domain_mismatch"],
  }),
  demo({
    id: "demo-risk-deadline",
    title: "【演示数据】届次与截止矛盾样例",
    deadline_at: "2026-12-15T18:00:00+08:00",
    source_url: "https://example.com/demo/risk-deadline",
    source_name: "演示来源",
    source_tier: "unverified",
    risk_flags: ["no_official_source", "deadline_conflict"],
  }),
]
