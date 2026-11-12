import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import { explainApiError, explainFieldError } from "../src/api/messages.ts"
import { kindListQuery } from "../src/api/opportunities.ts"
import { opportunityCollectionPath } from "../src/api/paths.ts"
import { seedOpportunities } from "../src/data/seed.ts"
import {
  ApiError,
  competitionOnWhitelist,
  filterOpportunities,
  makeDedupeKey,
  resolveSource,
  validateAndBuild,
} from "../src/domain/opportunity.ts"
import { KIND_PATH, detailBackPath, listPath } from "../src/lists.ts"
import { SAMPLE_PROFILE, parseProfile, profileFromGuide, saveProfile } from "../src/profile.ts"
import { memoryStore } from "../src/storage.ts"

const now = new Date("2026-11-03T11:04:00.000Z")

describe("三个入口的列表路径", () => {
  it("实习、校招、竞赛各自带 kind，已截止可以一起传", () => {
    assert.equal(opportunityCollectionPath(kindListQuery("internship", null)), "/api/v1/opportunities?kind=internship")
    assert.equal(
      opportunityCollectionPath(kindListQuery("campus_recruit", null)),
      "/api/v1/opportunities?kind=campus_recruit",
    )
    assert.equal(opportunityCollectionPath(kindListQuery("competition", null)), "/api/v1/opportunities?kind=competition")
    assert.equal(
      opportunityCollectionPath(kindListQuery("internship", "expired")),
      "/api/v1/opportunities?kind=internship&status=expired",
    )
    assert.equal(
      opportunityCollectionPath(kindListQuery("campus_recruit", "expired")),
      "/api/v1/opportunities?kind=campus_recruit&status=expired",
    )
    assert.equal(
      opportunityCollectionPath(kindListQuery("competition", "expired")),
      "/api/v1/opportunities?kind=competition&status=expired",
    )
  })

  it("画像保存之后，列表查询仍然只有 kind 和 status", () => {
    const store = memoryStore()
    const profile = profileFromGuide({ college: "管理科学学院", major: "大数据管理与应用", grade: "大二" })
    assert.ok(profile)
    saveProfile(profile, store)
    const query = kindListQuery("campus_recruit", null)
    assert.deepEqual(query, { kind: "campus_recruit" })
    assert.equal(Object.hasOwn(query, "college"), false)
    assert.equal(Object.hasOwn(query, "major"), false)
    assert.equal(Object.hasOwn(query, "grade"), false)
  })

  it("实习和校招结果里没有竞赛", () => {
    const internships = filterOpportunities(seedOpportunities, kindListQuery("internship", null))
    const campus = filterOpportunities(seedOpportunities, kindListQuery("campus_recruit", null))
    assert.ok(internships.every((item) => item.kind === "internship"))
    assert.equal(campus.length, 5)
    assert.ok(campus.every((item) => item.kind === "campus_recruit"))
    assert.equal(filterOpportunities(seedOpportunities, kindListQuery("competition", null)).length, 0)
  })

  it("已截止的竞赛仍能按状态查到两条样例", () => {
    const rows = filterOpportunities(seedOpportunities, kindListQuery("competition", "expired"))
    assert.deepEqual(
      rows.map((item) => item.source_url).sort(),
      ["https://aao.cdut.edu.cn/info/1442/7000.htm", "https://cim.cdut.edu.cn/info/1098/6232.htm"].sort(),
    )
    const expiredJobs = filterOpportunities(seedOpportunities, kindListQuery("internship", "expired"))
    assert.ok(expiredJobs.length >= 1)
    assert.ok(expiredJobs.every((item) => item.kind === "internship" && item.status === "expired"))
  })

  it("页面路径按类型分开，录入不出现在主导航", () => {
    assert.equal(listPath("internship"), "/internships")
    assert.equal(listPath("campus_recruit", "expired", "9"), "/campus?status=expired&created=9")
    assert.equal(listPath("competition"), "/competitions")
    assert.equal(KIND_PATH.campus_recruit, "/campus")
    const shell = readFileSync(new URL("../src/components/Shell.tsx", import.meta.url), "utf8")
    assert.match(shell, /实习/)
    assert.match(shell, /校招/)
    assert.match(shell, /竞赛/)
    assert.doesNotMatch(shell, /求职/)
    assert.doesNotMatch(shell, /录入/)
    assert.doesNotMatch(shell, /\/submit/)
    const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8")
    assert.match(app, /path="\/submit"/)
    const card = readFileSync(new URL("../src/components/OpportunityCard.tsx", import.meta.url), "utf8")
    assert.match(card, /不感兴趣/)
    assert.match(card, /source_url/)
    assert.match(card, /source_name/)
    assert.match(card, /TIER_LABEL/)
  })

  it("详情的返回列表按 kind 回到实习、校招或竞赛", () => {
    assert.equal(detailBackPath({ kind: "internship", status: "active" }), "/internships")
    assert.equal(detailBackPath({ kind: "campus_recruit", status: "active" }), "/campus")
    assert.equal(detailBackPath({ kind: "competition", status: "active" }), "/competitions")
    assert.equal(detailBackPath({ kind: "internship", status: "expired" }), "/internships?status=expired")
    assert.equal(detailBackPath({ kind: "campus_recruit", status: "expired" }), "/campus?status=expired")
    assert.equal(detailBackPath({ kind: "competition", status: "expired" }), "/competitions?status=expired")
    assert.equal(detailBackPath(null), "/internships")

    const detail = readFileSync(new URL("../src/pages/DetailPage.tsx", import.meta.url), "utf8")
    assert.match(detail, /detailBackPath/)
    assert.equal(detail.match(/返回列表/g)?.length, 3)
    assert.doesNotMatch(detail, /to=["']\/internships["']/)
    assert.doesNotMatch(detail, /to=["']\/campus["']/)
    assert.doesNotMatch(detail, /to=["']\/competitions["']/)
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
    assert.deepEqual(resolveSource("https://jobs.hisense.com/campus", "campus_recruit"), {
      source_name: "企业校招",
      source_tier: "campus_channel",
    })
    assert.equal(resolveSource("https://maker.haier.net/", "internship").source_tier, "campus_channel")
    assert.equal(resolveSource("https://cngr.hotjob.cn/position", "campus_recruit").source_tier, "campus_channel")
    assert.equal(resolveSource("https://vistar.zhiye.com/", "campus_recruit").source_name, "企业校招")
    assert.equal(resolveSource("https://company.example/campus-recruit", "internship").source_tier, "campus_channel")
    assert.equal(resolveSource("https://jobs.hisense.com/campus", "competition").source_tier, "unverified")
    assert.equal(resolveSource("https://www.zhaopin.com/campus/index.html", "campus_recruit").source_tier, "unverified")
    assert.equal(resolveSource("https://my.yingjiesheng.com/xjh.html", "campus_recruit").source_tier, "unverified")
    assert.equal(resolveSource("https://ezhizhaopin.com/school.php?id=2233", "campus_recruit").source_tier, "unverified")
    assert.equal(resolveSource("https://example.com/search?q=campus", "campus_recruit").source_tier, "unverified")
    const detail = "https://cp.moocollege.com/home/competition/details?competitionId=107706"
    assert.deepEqual(resolveSource(detail, "competition"), {
      source_name: "学科竞赛平台(moocollege)",
      source_tier: "campus_channel",
    })
    assert.deepEqual(resolveSource("https://scgxxkjs.moocollege.com/competition", "competition"), {
      source_name: "学科竞赛平台(moocollege)",
      source_tier: "campus_channel",
    })
    assert.equal(resolveSource(detail, "internship").source_tier, "unverified")
    assert.equal(competitionOnWhitelist(detail), true)
    assert.equal(competitionOnWhitelist("https://www.cp.moocollege.com/home"), true)
    assert.equal(competitionOnWhitelist("https://scgxxkjs.moocollege.com/competition"), true)
    assert.equal(competitionOnWhitelist("https://example.com/contest"), false)
    assert.equal(makeDedupeKey("海尔", "校招", "2026-11-30T16:30:00.000Z").endsWith("|2026-12-01"), true)
    const apiError = new ApiError(400, "validation", "source_url is required", { origin: "api" })
    assert.equal(explainApiError(apiError), "来源链接不能为空（后端返回 400）")
  })
})

describe("后端中文 detail", () => {
  it("按 PR#1 的 detail 原文映射，不落成笼统的 400 或 409", () => {
    const emptyUrl = new ApiError(400, "validation", "source_url 不能为空", {
      origin: "api",
      fields: [{ field: "source_url", message: "source_url 不能为空" }],
    })
    assert.equal(explainApiError(emptyUrl), "来源链接不能为空（后端返回 400）")
    assert.equal(explainFieldError("source_url", "source_url 不能为空"), "请填写来源链接")

    const relativeUrl = new ApiError(400, "validation", "source_url 必须是绝对的 http(s) 地址", { origin: "api" })
    assert.equal(explainApiError(relativeUrl), "来源链接必须是以 http 或 https 开头的完整地址（后端返回 400）")
    assert.equal(
      explainFieldError("source_url", "source_url 必须是绝对的 http(s) 地址"),
      "来源链接必须是以 http 或 https 开头的完整地址",
    )

    const sameUrl = new ApiError(409, "duplicate", "source_url 已存在", { origin: "api" })
    assert.equal(explainApiError(sameUrl), "这条来源链接已经收录过（后端返回 409）")
    assert.equal(explainFieldError("source_url", "source_url 已存在"), "这条来源链接已经收录过")

    const sameKey = new ApiError(409, "duplicate", "已存在相同 dedupe_key 的有效记录", { origin: "api" })
    assert.equal(explainApiError(sameKey), "已有一条进行中的记录，单位、标题和截止日期相同（后端返回 409）")

    const clash = new ApiError(409, "duplicate", "与已有记录冲突", { origin: "api" })
    assert.equal(explainApiError(clash), "与已有记录冲突（后端返回 409）")

    const missing = new ApiError(404, "http", "未找到该机会", { origin: "api" })
    assert.equal(explainApiError(missing), "没有找到这条信息（后端返回 404）")

    const blankTitle = new ApiError(422, "validation", "title: Value error, 不能为空", { origin: "api" })
    assert.equal(explainApiError(blankTitle), "有必填项没有填完整（后端返回 422）")
    assert.equal(explainFieldError("title", "Value error, 不能为空"), "请填写标题")

    const badKind = new ApiError(400, "validation", "kind 无效", { origin: "api" })
    assert.equal(explainApiError(badKind), "提交内容没有通过校验（后端返回 400）")
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

  it("计算机设计大赛样例是校内渠道，求职样例仍覆盖工科等方向", () => {
    const contest = seedOpportunities.find((item) => item.id === "comp-jsjds-2026")
    assert.ok(contest)
    assert.equal(contest.kind, "competition")
    assert.equal(contest.source_url, "https://aao.cdut.edu.cn/info/1442/7000.htm")
    assert.equal(contest.source_tier, "campus_channel")

    const jobs = seedOpportunities.filter((item) => item.kind === "internship" || item.kind === "campus_recruit")
    const text = jobs.map((item) => `${item.title} ${item.company} ${item.role_tags.join(" ")}`).join("\n")
    assert.match(text, /石油工程|电池材料|电子/)
    assert.ok(jobs.some((item) => item.company !== "成都理工大学管理科学学院"))
  })
})
