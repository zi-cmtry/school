import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createElement, type ReactElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router-dom"
import { describe, it } from "node:test"
import { kindListQuery, normalizeOpportunity } from "../src/api/opportunities.ts"
import { OpportunityCard } from "../src/components/OpportunityCard.tsx"
import { RiskNotice } from "../src/components/RiskNotice.tsx"
import { demoRiskOpportunities } from "../src/data/risk-demo.ts"
import { seedOpportunities } from "../src/data/seed.ts"
import { filterOpportunities, type Opportunity } from "../src/domain/opportunity.ts"
import { RISK_FLAGS, parseRiskFlags, riskFlagLabels } from "../src/domain/risk.ts"

const now = new Date("2026-11-13T12:00:00+08:00")

function markup(node: ReactElement): string {
  return renderToStaticMarkup(createElement(MemoryRouter, null, node))
}

function card(item: Opportunity): string {
  return markup(
    createElement(OpportunityCard, {
      item,
      now,
      highlighted: false,
      onDismiss: () => {},
    }),
  )
}

describe("risk_flags 只按接口代码展示", () => {
  it("五个代码映射成短中文，空值和未知代码不产生提示", () => {
    assert.deepEqual(parseRiskFlags(undefined), [])
    assert.deepEqual(parseRiskFlags(null), [])
    assert.deepEqual(parseRiskFlags(""), [])
    assert.deepEqual(parseRiskFlags("pay_to_apply"), [])
    assert.deepEqual(parseRiskFlags([]), [])
    assert.deepEqual(parseRiskFlags(["nope", 1, "  ", "pay_to_apply", "pay_to_apply"]), ["pay_to_apply"])
    assert.deepEqual(riskFlagLabels(["pay_to_apply"]), ["收费定金话术"])
    assert.deepEqual(riskFlagLabels(["deadline_conflict", "no_official_source"]), ["届次截止矛盾", "无合格源"])
    assert.deepEqual(riskFlagLabels(["aggregator_only"]), ["二手聚合当唯一源"])
    assert.deepEqual(riskFlagLabels(["domain_mismatch"]), ["域名不符"])
    assert.deepEqual(riskFlagLabels(["made_up_rule"]), [])
    assert.deepEqual(RISK_FLAGS.length, 5)
  })

  it("归一化只收下发的标志，正文里的收费话术不会被前端补成风险", () => {
    const base = {
      id: 9,
      title: "薪酬面议的运营岗",
      kind: "campus_recruit",
      status: "active",
      company: "示例单位",
      source_url: "https://cdutjy.cdut.edu.cn/info/salary/1.htm",
      source_tier: "official",
      deadline_at: "2027-06-01T10:00:00+08:00",
      summary: "月薪8000，报名费这几个字出现在否定句之外也不由前端判断。",
      requirements: "投递需付费，报名费200元。",
    }
    assert.deepEqual(normalizeOpportunity({ ...base }).risk_flags, [])
    assert.deepEqual(normalizeOpportunity({ ...base, risk_flags: [] }).risk_flags, [])
    assert.deepEqual(normalizeOpportunity({ ...base, risk_flags: null }).risk_flags, [])
    assert.deepEqual(
      normalizeOpportunity({
        ...base,
        risk_flags: ["no_official_source", "not-a-flag", "pay_to_apply", "pay_to_apply"],
      }).risk_flags,
      ["no_official_source", "pay_to_apply"],
    )
  })
})

describe("有标志仍留在列表里，没有标志不提示", () => {
  it("真实摘录的标志都是空数组，电建职责仍是未提供", () => {
    assert.ok(seedOpportunities.length > 0)
    for (const item of seedOpportunities) {
      assert.deepEqual(item.risk_flags, [], item.id)
    }
    const dianjian = seedOpportunities.find((item) => item.id === "dianjian-2027")
    assert.ok(dianjian)
    assert.equal(dianjian.responsibilities, "未提供")
    assert.equal(dianjian.requirements, "未提供")
    assert.equal(card(dianjian).includes("疑似欺骗"), false)
    assert.match(card(dianjian), /中国电建集团成都院/)
    assert.match(card(dianjian), new RegExp(`href="/opportunities/${dianjian.id}"`))
    assert.match(card(dianjian), new RegExp(dianjian.source_url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  })

  it("演示夹具带标志，过滤后仍可见，卡片显示提示且能进详情和来源", () => {
    assert.ok(demoRiskOpportunities.every((item) => item.title.includes("演示数据")))
    assert.ok(demoRiskOpportunities.every((item) => item.responsibilities === "未提供"))
    assert.ok(demoRiskOpportunities.every((item) => item.requirements === "未提供"))
    const codes = new Set(demoRiskOpportunities.flatMap((item) => item.risk_flags))
    for (const code of RISK_FLAGS) assert.ok(codes.has(code), code)

    const listed = filterOpportunities(
      [...seedOpportunities, ...demoRiskOpportunities],
      kindListQuery("campus_recruit", null, { place: "chengdu" }),
    )
    const ids = listed.map((item) => item.id)
    for (const item of demoRiskOpportunities) {
      assert.ok(ids.includes(item.id), item.id)
      const html = card(item)
      assert.match(html, /疑似欺骗/)
      assert.match(html, /只做提示，不会隐藏，来源仍可打开。/)
      for (const label of riskFlagLabels(item.risk_flags)) assert.match(html, new RegExp(label))
      assert.match(html, new RegExp(`href="/opportunities/${item.id}"`))
      assert.match(html, new RegExp(`href="${item.source_url}"`))
      assert.match(html, /不感兴趣/)
      assert.equal(html.includes("disabled"), false)
      assert.equal(html.includes("major_tags"), false)
      assert.equal(html.includes("专业标签"), false)
    }

    const plain = listed.find((item) => item.id === "dianjian-2027")
    assert.ok(plain)
    assert.deepEqual(plain.risk_flags, [])
    assert.equal(card(plain).includes("疑似欺骗"), false)

    const sichuan = filterOpportunities(
      [...seedOpportunities, ...demoRiskOpportunities],
      kindListQuery("campus_recruit", null, { major: "大数据管理与应用", place: "sichuan" }),
    )
    assert.equal(sichuan[0]?.id, "kunlun-campus")
    assert.ok(sichuan.some((item) => item.id === "demo-risk-pay"))
    assert.ok(sichuan.some((item) => item.id === "dianjian-2027"))
  })

  it("详情仍提供来源链接，空标志不渲染提示", () => {
    assert.equal(markup(createElement(RiskNotice, { flags: [] })), "")
    assert.equal(markup(createElement(RiskNotice, { flags: undefined })), "")
    assert.equal(markup(createElement(RiskNotice, { flags: ["made_up_rule"] })), "")
    const shown = markup(createElement(RiskNotice, { flags: ["domain_mismatch", "pay_to_apply"] }))
    assert.match(shown, /疑似欺骗/)
    assert.match(shown, /域名不符/)
    assert.match(shown, /收费定金话术/)
    assert.ok(shown.indexOf("域名不符") < shown.indexOf("收费定金话术"))

    const detail = readFileSync(new URL("../src/pages/DetailPage.tsx", import.meta.url), "utf8")
    const cardSource = readFileSync(new URL("../src/components/OpportunityCard.tsx", import.meta.url), "utf8")
    const list = readFileSync(new URL("../src/pages/ListPage.tsx", import.meta.url), "utf8")
    const shell = readFileSync(new URL("../src/components/Shell.tsx", import.meta.url), "utf8")
    assert.match(detail, /RiskNotice/)
    assert.match(detail, /打开来源/)
    assert.match(detail, /href=\{item\.source_url\}/)
    assert.match(detail, /岗位职责/)
    assert.doesNotMatch(detail, /major_tags/)
    assert.match(cardSource, /RiskNotice/)
    assert.match(cardSource, /source_url/)
    assert.match(cardSource, /to=\{`\/opportunities\/\$\{item\.id\}`\}/)
    assert.doesNotMatch(list, /risk_flags/)
    assert.doesNotMatch(shell, /录入/)
  })
})
