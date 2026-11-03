import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { explainApiError } from "../src/api/messages.ts"
import { competitionListQuery, jobListQuery } from "../src/api/opportunities.ts"
import { opportunityCollectionPath } from "../src/api/paths.ts"
import { seedOpportunities } from "../src/data/seed.ts"
import { ApiError, filterOpportunities, makeDedupeKey, resolveSource, validateAndBuild } from "../src/domain/opportunity.ts"
import { SAMPLE_PROFILE, parseProfile } from "../src/profile.ts"

const now = new Date("2026-11-03T11:04:00.000Z")

describe("列表路径", () => {
  it("求职默认不带参数，竞赛只带 kind=competition", () => {
    assert.equal(opportunityCollectionPath(jobListQuery(null, null)), "/api/v1/opportunities")
    assert.equal(opportunityCollectionPath(jobListQuery("internship", null)), "/api/v1/opportunities?kind=internship")
    assert.equal(opportunityCollectionPath(competitionListQuery(null)), "/api/v1/opportunities?kind=competition")
    assert.equal(
      opportunityCollectionPath(competitionListQuery("expired")),
      "/api/v1/opportunities?kind=competition&status=expired",
    )
  })

  it("默认只要进行中的实习和校招", () => {
    const rows = filterOpportunities(seedOpportunities, jobListQuery(null, null))
    assert.equal(rows.length, 5)
    assert.ok(rows.every((item) => item.kind !== "competition"))
    assert.ok(rows.every((item) => item.status === "active"))
  })

  it("已截止的竞赛仍能按状态查到两条样例", () => {
    assert.equal(filterOpportunities(seedOpportunities, competitionListQuery(null)).length, 0)
    const rows = filterOpportunities(seedOpportunities, competitionListQuery("expired"))
    assert.deepEqual(
      rows.map((item) => item.source_url).sort(),
      ["https://aao.cdut.edu.cn/info/1442/7000.htm", "https://cim.cdut.edu.cn/info/1098/6232.htm"].sort(),
    )
  })
})

describe("录入校验", () => {
  it("没有来源链接时返回 400，提示语是中文", () => {
    const result = validateAndBuild(
      {
        title: "没有来源",
        kind: "internship",
        company: "某单位",
        deadline_at: "2026-12-01T10:00:00+08:00",
        source_url: "  ",
      },
      seedOpportunities,
      now,
      "sub_test",
    )
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.error.status, 400)
      assert.match(explainApiError(result.error), /来源链接不能为空/)
      assert.doesNotMatch(explainApiError(result.error), /source_url is required/)
    }
  })

  it("相同来源链接返回 409，进行中的去重键冲突也返回 409", () => {
    const source = seedOpportunities.find((item) => item.id === "talk-deppon-20261105")
    assert.ok(source)
    const sameUrl = validateAndBuild(
      {
        title: "另一场宣讲",
        kind: "campus_recruit",
        company: "另一家公司",
        deadline_at: "2026-12-02T10:00:00+08:00",
        source_url: source.source_url,
      },
      seedOpportunities,
      now,
      "sub_url",
    )
    assert.equal(sameUrl.ok, false)
    if (!sameUrl.ok) assert.match(explainApiError(sameUrl.error), /来源链接已经收录过/)

    const clash = validateAndBuild(
      {
        title: source.title,
        kind: "campus_recruit",
        company: source.company,
        deadline_at: source.deadline_at,
        source_url: "https://cdutjy.cdut.edu.cn/info/browser-dedupe.htm",
      },
      seedOpportunities,
      now,
      "sub_key",
    )
    assert.equal(clash.ok, false)
    if (!clash.ok) {
      assert.equal(clash.error.status, 409)
      assert.match(explainApiError(clash.error), /截止日期相同/)
    }
  })

  it("来源层级按链接和类型判断，去重日期用北京时间", () => {
    assert.deepEqual(resolveSource("https://cdutjy.cdut.edu.cn/a.pdf", "campus_recruit"), {
      source_name: "学生就业指导中心",
      source_tier: "official",
    })
    assert.equal(resolveSource("https://aao.cdut.edu.cn/info/1442/7000.htm", "competition").source_tier, "campus_channel")
    assert.equal(resolveSource("https://aao.cdut.edu.cn/info/1.htm", "internship").source_tier, "unverified")
    assert.equal(resolveSource("https://example.com/job", "internship").source_tier, "unverified")
    assert.equal(makeDedupeKey("海尔", "校招", "2026-11-30T16:30:00.000Z").endsWith("|2026-12-01"), true)
    const apiError = new ApiError(400, "validation", "source_url is required", { origin: "api" })
    assert.equal(explainApiError(apiError), "来源链接不能为空（后端返回 400）")
  })
})

describe("个人设置", () => {
  it("能读出示例画像，坏数据则丢掉", () => {
    assert.equal(parseProfile(SAMPLE_PROFILE)?.major, "大数据管理与应用")
    assert.equal(parseProfile(SAMPLE_PROFILE)?.grade, "大二")
    assert.equal(parseProfile({ school: "成都理工大学" }), null)
    assert.equal(parseProfile(null), null)
  })
})

describe("样例规模", () => {
  it("至少 5 条求职、2 条竞赛，且都有来源链接和截止时间", () => {
    const jobs = seedOpportunities.filter((item) => item.kind === "internship" || item.kind === "campus_recruit")
    const contests = seedOpportunities.filter((item) => item.kind === "competition")
    assert.ok(jobs.length >= 5)
    assert.ok(contests.length >= 2)
    for (const item of seedOpportunities) {
      assert.ok(item.source_url.startsWith("http"))
      assert.ok(!Number.isNaN(new Date(item.deadline_at).getTime()))
    }
  })
})
