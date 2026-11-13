import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import { explainApiError, explainFieldError } from "../src/api/messages.ts"
import { excerptField, kindListQuery, normalizeOpportunity } from "../src/api/opportunities.ts"
import { opportunityCollectionPath } from "../src/api/paths.ts"
import { seedOpportunities } from "../src/data/seed.ts"
import {
  ApiError,
  competitionOnWhitelist,
  filterOpportunities,
  makeDedupeKey,
  resolveSource,
  validateAndBuild,
  type Opportunity,
} from "../src/domain/opportunity.ts"
import { KIND_PATH, detailBackPath, listPath } from "../src/lists.ts"
import { excerptOrMissing } from "../src/labels.ts"
import { SAMPLE_PROFILE, parseProfile, profileFromGuide, saveProfile, savedMajor, skipProfilePrompt } from "../src/profile.ts"
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

  it("保存了专业才传 major，跳过或专业为空时不传", () => {
    const store = memoryStore()
    const profile = profileFromGuide({ college: "管理科学学院", major: "大数据管理与应用", grade: "大二" })
    assert.ok(profile)
    saveProfile(profile, store)
    const saved = kindListQuery("campus_recruit", null, { major: savedMajor(store), place: "chengdu" })
    assert.equal(saved.major, "大数据管理与应用")
    assert.equal(saved.region, undefined)
    assert.equal(Object.hasOwn(saved, "college"), false)
    assert.equal(Object.hasOwn(saved, "grade"), false)
    const savedPath = new URL(opportunityCollectionPath(saved), "http://127.0.0.1")
    assert.equal(savedPath.searchParams.get("major"), "大数据管理与应用")
    assert.equal(savedPath.searchParams.has("region"), false)

    const skipped = memoryStore()
    skipProfilePrompt(skipped)
    const skippedQuery = kindListQuery("campus_recruit", null, { major: savedMajor(skipped), place: "chengdu" })
    assert.equal(savedMajor(skipped), "")
    assert.equal(Object.hasOwn(skippedQuery, "major"), false)

    const blank = kindListQuery("internship", null, { major: "  ", place: "sichuan" })
    assert.equal(Object.hasOwn(blank, "major"), false)
    assert.equal(blank.region, "sichuan")
  })

  it("实习和校招结果里没有竞赛", () => {
    const internships = filterOpportunities(seedOpportunities, kindListQuery("internship", null))
    const campus = filterOpportunities(seedOpportunities, kindListQuery("campus_recruit", null))
    assert.ok(internships.every((item) => item.kind === "internship"))
    assert.ok(internships.some((item) => item.id === "dietuo-ai-intern"))
    assert.equal(campus.length, 8)
    assert.ok(campus.every((item) => item.kind === "campus_recruit"))
    assert.equal(filterOpportunities(seedOpportunities, kindListQuery("competition", null)).length, 1)
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

function sampleOpportunity(overrides: Partial<Opportunity> & Pick<Opportunity, "id" | "title" | "kind">): Opportunity {
  const deadline = overrides.deadline_at ?? "2027-06-01T10:00:00+08:00"
  const company = overrides.company ?? "单位"
  return {
    id: overrides.id,
    title: overrides.title,
    kind: overrides.kind,
    company,
    role_tags: overrides.role_tags ?? [],
    location: overrides.location ?? "",
    deadline_at: deadline,
    source_url: overrides.source_url ?? `https://cdutjy.cdut.edu.cn/${overrides.id}`,
    source_name: overrides.source_name ?? "学生就业指导中心",
    source_tier: overrides.source_tier ?? "official",
    apply_url: overrides.apply_url ?? "",
    summary: overrides.summary ?? "",
    status: overrides.status ?? "active",
    dedupe_key: overrides.dedupe_key ?? `${overrides.id}-key`,
    published_at: overrides.published_at ?? "2026-09-01T00:00:00+08:00",
    updated_at: overrides.updated_at ?? "2026-09-01T00:00:00+08:00",
    fetched_at: overrides.fetched_at ?? "2026-09-01T00:00:00+08:00",
    work_location: overrides.work_location ?? "未提供",
    responsibilities: overrides.responsibilities ?? "未提供",
    requirements: overrides.requirements ?? "未提供",
    major_requirements: overrides.major_requirements ?? "未提供",
    major_tags: overrides.major_tags ?? ["通用"],
  }
}

describe("详情摘录", () => {
  it("原文没有或值为未提供时显示未提供，有原文则原样保留", () => {
    assert.equal(excerptOrMissing(""), "未提供")
    assert.equal(excerptOrMissing("   "), "未提供")
    assert.equal(excerptOrMissing(null), "未提供")
    assert.equal(excerptOrMissing(undefined), "未提供")
    assert.equal(excerptOrMissing("未提供"), "未提供")
    const sentence = "协助高级产品经理完成方案设计及需求分析"
    assert.equal(excerptOrMissing(sentence), sentence)
    assert.equal(excerptOrMissing(`  ${sentence}\n`), `  ${sentence}\n`)

    const dianjian = seedOpportunities.find((item) => item.id === "dianjian-2027")
    const haixin = seedOpportunities.find((item) => item.id === "haixin-2026")
    const kunlun = seedOpportunities.find((item) => item.id === "kunlun-campus")
    assert.ok(dianjian && haixin && kunlun)
    assert.equal(excerptOrMissing(dianjian.responsibilities), "未提供")
    assert.equal(excerptOrMissing(dianjian.requirements), "未提供")
    assert.match(excerptOrMissing(dianjian.major_requirements), /水利水电工程/)
    assert.equal(excerptOrMissing(haixin.responsibilities), "未提供")
    assert.equal(excerptOrMissing(haixin.requirements), "未提供")
    assert.equal(excerptOrMissing(kunlun.responsibilities), "协助高级产品经理完成方案设计及需求分析")
    assert.equal(kunlun.source_url.startsWith("https://cdutjy.cdut.edu.cn/"), true)

    const detail = readFileSync(new URL("../src/pages/DetailPage.tsx", import.meta.url), "utf8")
    assert.match(detail, /岗位职责/)
    assert.match(detail, /任职要求/)
    assert.match(detail, /专业要求/)
    assert.match(detail, /excerptOrMissing/)
    assert.match(detail, /href=\{item\.source_url\}/)
    assert.doesNotMatch(detail, /暂无岗位职责|根据原文整理|推荐职责/)
  })

  it("接口缺摘录字段时归一成未提供，有原文不改写", () => {
    const blank = normalizeOpportunity({
      id: 3,
      title: "中国电建集团成都院2027届校园招聘公告",
      kind: "campus_recruit",
      status: "active",
      company: "中国电建集团成都院",
      source_url: "https://cdutjy.cdut.edu.cn/dianjian.pdf",
      source_tier: "official",
      deadline_at: "2027-04-15T10:00:00Z",
    })
    assert.equal(blank.responsibilities, "未提供")
    assert.equal(blank.requirements, "未提供")
    assert.equal(blank.major_requirements, "未提供")
    assert.equal(blank.work_location, "未提供")
    assert.deepEqual(blank.major_tags, ["通用"])
    assert.equal(excerptField("未提供"), "未提供")
    assert.equal(excerptField("  "), "未提供")
    const kept = "计算机、电子信息、数学、大数据管理与应用等相关专业方向硕士研究生及以上"
    assert.equal(excerptField(kept), kept)
  })
})

describe("专业排序与地点参数", () => {
  it("有专业时请求带 major，省内才带 region=sichuan，默认成都不带 region", () => {
    const chengdu = kindListQuery("campus_recruit", null, { major: "大数据管理与应用", place: "chengdu" })
    const sichuan = kindListQuery("internship", "expired", { major: "大数据管理与应用", place: "sichuan" })
    assert.equal(chengdu.region, undefined)
    assert.equal(sichuan.region, "sichuan")
    assert.equal(sichuan.status, "expired")

    const chengduUrl = new URL(opportunityCollectionPath(chengdu), "http://127.0.0.1")
    assert.equal(chengduUrl.searchParams.get("kind"), "campus_recruit")
    assert.equal(chengduUrl.searchParams.get("major"), "大数据管理与应用")
    assert.equal(chengduUrl.searchParams.has("region"), false)

    const sichuanUrl = new URL(opportunityCollectionPath(sichuan), "http://127.0.0.1")
    assert.equal(sichuanUrl.searchParams.get("region"), "sichuan")
    assert.equal(sichuanUrl.searchParams.get("major"), "大数据管理与应用")
    assert.equal(sichuanUrl.searchParams.get("kind"), "internship")
  })

  it("对口专业排前面，通用和职位名不算，其余仍在", () => {
    const rows = [
      sampleOpportunity({
        id: "civil",
        title: "土木工程岗",
        kind: "campus_recruit",
        work_location: "成都",
        deadline_at: "2027-05-01T10:00:00+08:00",
        major_requirements: "土木工程、水利水电工程",
        major_tags: ["土木工程", "水利水电工程"],
      }),
      sampleOpportunity({
        id: "related-mianyang",
        title: "产品工程师",
        kind: "campus_recruit",
        work_location: "绵阳",
        deadline_at: "2027-09-01T10:00:00+08:00",
        major_requirements: "计算机、电子信息、数学、大数据管理与应用等相关专业方向硕士研究生及以上",
        major_tags: ["计算机", "电子信息", "数学", "大数据管理与应用"],
      }),
      sampleOpportunity({
        id: "generic-title",
        title: "大数据分析师",
        kind: "campus_recruit",
        work_location: "成都",
        deadline_at: "2027-06-01T10:00:00+08:00",
        major_requirements: "未提供",
        major_tags: ["通用"],
      }),
      sampleOpportunity({
        id: "yibin",
        title: "材料岗",
        kind: "campus_recruit",
        work_location: "宜宾",
        deadline_at: "2027-04-01T10:00:00+08:00",
        major_requirements: "材料科学与工程",
        major_tags: ["材料科学与工程"],
      }),
    ]
    const listed = filterOpportunities(rows, kindListQuery("campus_recruit", null, { major: "大数据管理与应用" }))
    assert.deepEqual(
      listed.map((item) => item.id),
      ["related-mianyang", "civil", "generic-title", "yibin"],
    )
    assert.equal(listed[2].title, "大数据分析师")
  })

  it("成都和省内都不出现省外岗，含成都的多地岗仍在，绵阳宜宾也不隐藏", () => {
    const rows = [
      sampleOpportunity({
        id: "chengdu",
        title: "成都设计岗",
        kind: "campus_recruit",
        work_location: "成都",
        deadline_at: "2027-08-01T10:00:00+08:00",
      }),
      sampleOpportunity({
        id: "both",
        title: "深圳成都岗",
        kind: "campus_recruit",
        work_location: "深圳、成都",
        location: "深圳、成都",
        deadline_at: "2027-07-01T10:00:00+08:00",
      }),
      sampleOpportunity({
        id: "mianyang",
        title: "绵阳工艺岗",
        kind: "campus_recruit",
        work_location: "绵阳",
        deadline_at: "2027-03-01T10:00:00+08:00",
      }),
      sampleOpportunity({
        id: "zhongwei",
        title: "中伟集团2026届校园招聘",
        kind: "campus_recruit",
        work_location: "湖南、贵州、广西",
        deadline_at: "2027-09-01T10:00:00+08:00",
      }),
      sampleOpportunity({
        id: "shengli",
        title: "东营工程岗",
        kind: "campus_recruit",
        work_location: "山东东营",
        deadline_at: "2027-04-01T10:00:00+08:00",
      }),
      sampleOpportunity({
        id: "unknown",
        title: "工作地未写",
        kind: "internship",
        work_location: "未提供",
        location: "",
        deadline_at: "2027-02-01T10:00:00+08:00",
      }),
    ]
    const jobs = rows.filter((item) => item.kind !== "internship")
    const byChengdu = filterOpportunities(rows, kindListQuery("campus_recruit", null, { place: "chengdu" }))
    const bySichuan = filterOpportunities(rows, kindListQuery("campus_recruit", null, { place: "sichuan" }))
    assert.deepEqual(byChengdu.map((item) => item.id), bySichuan.map((item) => item.id))
    assert.deepEqual(
      bySichuan.map((item) => item.id),
      ["both", "chengdu", "mianyang"],
    )
    assert.equal(jobs.length, 5)
    assert.ok(bySichuan.every((item) => item.id !== "zhongwei" && item.id !== "shengli"))
    assert.equal(new URL(opportunityCollectionPath(kindListQuery("campus_recruit", null, { place: "chengdu" })), "http://127.0.0.1").searchParams.has("region"), false)
    assert.equal(
      new URL(opportunityCollectionPath(kindListQuery("campus_recruit", null, { place: "sichuan" })), "http://127.0.0.1").searchParams.get("region"),
      "sichuan",
    )

    const seededChengdu = filterOpportunities(seedOpportunities, kindListQuery("campus_recruit", null, { place: "chengdu" }))
    const seededSichuan = filterOpportunities(seedOpportunities, kindListQuery("campus_recruit", null, { place: "sichuan" }))
    assert.deepEqual(
      seededChengdu.map((item) => item.id),
      seededSichuan.map((item) => item.id),
    )
    assert.ok(seededSichuan.some((item) => item.id === "haixin-2026" && item.work_location.includes("成都")))
    assert.ok(seededSichuan.every((item) => item.id !== "zhongwei-2026" && !item.title.includes("胜利石油")))
    const ranked = filterOpportunities(
      seedOpportunities,
      kindListQuery("campus_recruit", null, { major: "大数据管理与应用", place: "chengdu" }),
    )
    assert.equal(ranked[0]?.id, "kunlun-campus")
    assert.ok(ranked.some((item) => item.id === "dianjian-2027"))
    assert.ok(ranked.some((item) => item.id === "haixin-2026"))

    const missingPlace = filterOpportunities(rows, kindListQuery("internship", null, { place: "chengdu" }))
    const missingPlaceSichuan = filterOpportunities(rows, kindListQuery("internship", null, { place: "sichuan" }))
    assert.deepEqual(missingPlace.map((item) => item.id), ["unknown"])
    assert.deepEqual(missingPlaceSichuan.map((item) => item.id), ["unknown"])
  })

  it("成都和省内切换不把竞赛按地点筛掉", () => {
    const contests = [
      sampleOpportunity({
        id: "no-place",
        title: "没有工作地的省赛",
        kind: "competition",
        company: "四川省教育厅",
        work_location: "未提供",
        location: "",
        deadline_at: "2027-05-01T10:00:00+08:00",
        major_tags: ["通用"],
      }),
      sampleOpportunity({
        id: "related",
        title: "省赛乙",
        kind: "competition",
        company: "成都理工大学",
        work_location: "未提供",
        deadline_at: "2027-08-01T10:00:00+08:00",
        major_requirements: "大数据管理与应用",
        major_tags: ["大数据管理与应用"],
      }),
      sampleOpportunity({
        id: "beijing",
        title: "外地通知",
        kind: "competition",
        work_location: "北京",
        location: "北京",
        deadline_at: "2027-06-01T10:00:00+08:00",
      }),
    ]
    for (const place of ["chengdu", "sichuan"] as const) {
      const query = kindListQuery("competition", null, { major: "大数据管理与应用", place })
      assert.equal(query.region, undefined)
      assert.equal(query.major, "大数据管理与应用")
      const path = new URL(opportunityCollectionPath(query), "http://127.0.0.1")
      assert.equal(path.searchParams.has("region"), false)
      assert.equal(path.searchParams.get("kind"), "competition")
      const shown = filterOpportunities(contests, query)
      assert.deepEqual(
        shown.map((item) => item.id),
        ["related", "no-place", "beijing"],
      )
      assert.equal(shown.find((item) => item.id === "no-place")?.work_location, "未提供")
      assert.ok(shown.some((item) => item.work_location === "北京"))
    }

    const seeded = filterOpportunities(seedOpportunities, kindListQuery("competition", null, { place: "sichuan" }))
    const seededDefault = filterOpportunities(seedOpportunities, kindListQuery("competition", null, { place: "chengdu" }))
    assert.deepEqual(
      seeded.map((item) => item.id),
      seededDefault.map((item) => item.id),
    )
    assert.ok(seeded.some((item) => item.id === "comp-moo-medical" && item.work_location === "未提供"))

    const page = readFileSync(new URL("../src/pages/ListPage.tsx", import.meta.url), "utf8")
    assert.match(page, /region=sichuan/)
    assert.match(page, /省内/)
    assert.match(page, /kind === "competition" \? null : place/)
    const shell = readFileSync(new URL("../src/components/Shell.tsx", import.meta.url), "utf8")
    assert.doesNotMatch(shell, /推荐/)
    assert.doesNotMatch(shell, /录入/)
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
