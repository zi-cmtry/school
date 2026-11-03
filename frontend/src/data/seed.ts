import { makeDedupeKey, type Opportunity } from "../domain/opportunity"

/**
 * 只收录来源页写明的事实。
 * 来源没写的字段留空，不补公司、城市、岗位或截止日期。
 * 原文只写到“某日”而没有钟点的，截止收到当天 23:59（北京时间），并在 summary 里说明。
 * 宣讲转载页没有网申截止，deadline_at 用宣讲开始时间，source_tier 为 unverified。
 */

const TALKS_URL = "https://ezhizhaopin.com/school.php?id=2233&section=lectures"

function withKey(item: Omit<Opportunity, "dedupe_key" | "fetched_at"> & { fetched_at?: string }): Opportunity {
  return {
    fetched_at: item.fetched_at ?? item.updated_at,
    ...item,
    dedupe_key: makeDedupeKey(item.company, item.title, item.deadline_at),
  }
}

function talk(input: {
  id: string
  title: string
  company: string
  location: string
  deadline_at: string
  whenText: string
}): Opportunity {
  return withKey({
    id: input.id,
    title: input.title,
    kind: "campus_recruit",
    company: input.company,
    role_tags: [],
    location: input.location,
    deadline_at: input.deadline_at,
    source_url: TALKS_URL,
    source_name: "E职科技",
    source_tier: "unverified",
    apply_url: "",
    summary: `E职科技「成都理工大学近期宣讲会安排」收录：${input.whenText}，${input.location}。该页未给出岗位、网申截止日期和投递链接，因此 deadline_at 取宣讲开始时间，来源层级为未核验。具体安排以学校通知为准。`,
    status: "active",
    published_at: "",
    updated_at: "",
  })
}

export const seedOpportunities: Opportunity[] = [
  withKey({
    id: "sinopec-shengli-2027",
    title: "中石化胜利石油工程有限公司2027年度校园招聘",
    kind: "campus_recruit",
    company: "中石化胜利石油工程有限公司",
    role_tags: ["石油工程技术研发及应用岗", "人工智能研发及应用岗", "新能源、新材料研发岗"],
    location: "以山东东营为主",
    deadline_at: "2026-10-28T17:00:00+08:00",
    source_url:
      "https://cdutjy.cdut.edu.cn/data/mcit_editor/20260930/%E4%B8%AD%E7%9F%B3%E5%8C%96%E8%83%9C%E5%88%A9%E7%9F%B3%E6%B2%B9%E5%B7%A5%E7%A8%8B%E6%9C%89%E9%99%90%E5%85%AC%E5%8F%B82027%E5%B9%B4%E5%BA%A6%E6%A0%A1%E5%9B%AD%E6%8B%9B%E8%81%98%E7%AE%80%E7%AB%A0.pdf",
    source_name: "成都理工大学就业信息网",
    source_tier: "official",
    apply_url: "http://job.sinopec.com",
    summary:
      "就业信息网简章。2027年度校园招聘，计划5类岗位、140名高校毕业生，工作地点以山东东营为主。网上应聘2026年9月24日至10月28日17:00，通过中国石化人才招聘网校园招聘，在油田企业中选择胜利石油工程有限公司。初选考试2026年11月8日15:00。本次收录的岗位名只包含已读到的三类；简章写明共5类，其余类别以原文为准。",
    status: "expired",
    published_at: "2026-09-30T00:00:00+08:00",
    updated_at: "2026-09-30T00:00:00+08:00",
  }),
  withKey({
    id: "duoyi-2027-early",
    title: "多益网络27届校招秋季提前批",
    kind: "campus_recruit",
    company: "多益网络",
    role_tags: ["策划类", "程序类", "市场类", "艺术类", "职能类"],
    location: "广州、武汉、杭州",
    deadline_at: "2026-08-31T23:59:59+08:00",
    source_url: "https://cmcc.cdut.edu.cn/info/1101/9407.htm",
    source_name: "成都理工大学材料与化学化工学院",
    source_tier: "campus_channel",
    apply_url: "https://xz.duoyi.com/FNa",
    summary:
      "材料与化学化工学院2026年7月16日发布。岗位含策划、程序、市场、艺术、职能，共30余种。工作地点广州、武汉、杭州。投递时间即日起至8月31日，原文未写钟点，截止记为2026年8月31日23:59（北京时间）。网申地址 https://xz.duoyi.com/FNa 。",
    status: "expired",
    published_at: "2026-07-16T00:00:00+08:00",
    updated_at: "2026-07-16T00:00:00+08:00",
  }),
  withKey({
    id: "mihoyo-2025-campus",
    title: "米哈游科技有限公司正式岗位招聘",
    kind: "campus_recruit",
    company: "米哈游科技有限公司",
    role_tags: ["美术&表现类", "程序&技术类", "产品策划类", "运营类", "市场&商务类", "国际化类", "质量管理类", "综合类"],
    location: "",
    deadline_at: "2025-05-05T23:59:59+08:00",
    source_url: "https://cmcc.cdut.edu.cn/info/1101/8082.htm",
    source_name: "成都理工大学材料与化学化工学院",
    source_tier: "campus_channel",
    apply_url: "https://campus.mihoyo.com",
    summary:
      "材料与化学化工学院2025年2月26日发布。正式岗位面向2024年9月至2025年8月毕业生。网申时间2月21日至5月5日，原文未写钟点，按发布年份记到2025年5月5日23:59（北京时间）。网申地址原文写作 campus.mihoyo.com。原文未写工作城市。内推码 SLJQ。",
    status: "expired",
    published_at: "2025-02-26T00:00:00+08:00",
    updated_at: "2025-02-26T00:00:00+08:00",
  }),
  withKey({
    id: "mihoyo-2025-intern",
    title: "米哈游科技有限公司暑期实习",
    kind: "internship",
    company: "米哈游科技有限公司",
    role_tags: ["美术&表现类", "程序&技术类", "产品策划类", "运营类", "市场&商务类", "国际化类", "质量管理类", "综合类"],
    location: "",
    deadline_at: "2025-05-05T23:59:59+08:00",
    source_url: "https://cmcc.cdut.edu.cn/info/1101/8082.htm",
    source_name: "成都理工大学材料与化学化工学院",
    source_tier: "campus_channel",
    apply_url: "https://campus.mihoyo.com",
    summary:
      "同一则学院通知中的暑期实习，面向2025年9月至2026年8月毕业生。网申时间与正式岗相同，截止记为2025年5月5日23:59（北京时间）。原文另写：部分美术与表现类岗位也面向27届及之后毕业的低年级同学，该句没有单独限定只属于实习。",
    status: "expired",
    published_at: "2025-02-26T00:00:00+08:00",
    updated_at: "2025-02-26T00:00:00+08:00",
  }),
  withKey({
    id: "fair-2027-autumn",
    title: "成都理工大学2027届毕业生秋季学期大型双选会",
    kind: "campus_recruit",
    company: "成都理工大学学生就业指导与服务中心",
    role_tags: [],
    location: "成都理工大学体育场（西区）",
    deadline_at: "2026-11-11T17:00:00+08:00",
    source_url: "https://my.yingjiesheng.com/xjh-006-285-782.html",
    source_name: "应届生求职网",
    source_tier: "unverified",
    apply_url: "",
    summary:
      "应届生求职网转载的就业指导中心安排，本条没有核到就业信息网原文，来源层级记为未核验。活动时间2026年11月11日14:30–17:00，报到13:30–14:30，地点体育场（西区）。用人单位报名截止2026年11月6日18时。本条 deadline_at 取活动结束时间，用来判断场次是否已过，不是某一家单位的网申截止。咨询电话028-84078700。",
    status: "active",
    published_at: "",
    updated_at: "",
  }),
  talk({
    id: "talk-deppon-20261105",
    title: "德邦物流股份有限公司宣讲会",
    company: "德邦物流股份有限公司",
    location: "成都理工大学学生就业指导与服务中心2号厅",
    deadline_at: "2026-11-05T16:00:00+08:00",
    whenText: "2026-11-05 16:00",
  }),
  talk({
    id: "talk-gotion-20261106",
    title: "合肥国轩电池材料有限公司宣讲会（芯世界，由你定义）",
    company: "合肥国轩电池材料有限公司",
    location: "成都理工大学学生就业指导与服务中心3号厅",
    deadline_at: "2026-11-06T14:30:00+08:00",
    whenText: "2026-11-06 14:30，页面标题为「芯世界，由你定义」",
  }),
  talk({
    id: "talk-kinwong-20261109",
    title: "深圳市景旺电子股份有限公司宣讲会",
    company: "深圳市景旺电子股份有限公司",
    location: "成都理工大学学生就业指导与服务中心3号厅",
    deadline_at: "2026-11-09T16:00:00+08:00",
    whenText: "2026-11-09 16:00",
  }),
  talk({
    id: "talk-yanjin-20261110",
    title: "盐津铺子食品股份有限公司宣讲会",
    company: "盐津铺子食品股份有限公司",
    location: "成都理工大学学生就业指导与服务中心2号厅",
    deadline_at: "2026-11-10T14:30:00+08:00",
    whenText: "2026-11-10 14:30",
  }),
  withKey({
    id: "comp-jsjds-2026",
    title: "2026年中国大学生计算机设计大赛成都理工大学校级赛",
    kind: "competition",
    company: "计算机与网络安全学院（示范性软件学院）",
    role_tags: [
      "软件应用与开发",
      "微课与 AI教学辅助",
      "物联网应用与物联网创新转化（创业实践）",
      "大数据应用",
      "人工智能应用",
      "信息可视化设计",
      "数媒静态设计",
      "数媒动漫与短片",
      "数媒游戏与交互设计",
      "计算机音乐创作",
      "国际生“汉学”（“中华优秀传统文化”数智创作）",
    ],
    location: "成都理工大学",
    deadline_at: "2026-04-15T12:00:00+08:00",
    source_url: "https://aao.cdut.edu.cn/info/1442/7000.htm",
    source_name: "成都理工大学教务处",
    source_tier: "campus_channel",
    apply_url: "http://jsjds.blcu.edu.cn/",
    summary:
      "教务处通知，发布时间2026-04-08。计算机与网络安全学院（示范性软件学院）承办。参赛对象为成都理工大学在籍本科生。报名及材料报送截止2026年4月15日中午12点，材料发送至 cdutjsjsjdx@qq.com。大赛官网 http://jsjds.blcu.edu.cn/ 。",
    status: "expired",
    published_at: "2026-04-08T00:00:00+08:00",
    updated_at: "2026-04-08T00:00:00+08:00",
  }),
  withKey({
    id: "comp-bigdata-2026",
    title: "2026年四川省大学生大数据采集与分析大赛企业大数据智能决策赛道校赛",
    kind: "competition",
    company: "成都理工大学管理科学学院",
    role_tags: ["企业大数据智能决策", "理论竞赛"],
    location: "成都理工大学（校赛地点待定）",
    deadline_at: "2026-09-10T23:59:59+08:00",
    source_url: "https://cim.cdut.edu.cn/info/1098/6232.htm",
    source_name: "成都理工大学管理科学学院",
    source_tier: "campus_channel",
    apply_url: "https://cp.moocollege.com/home/competition/details?competitionId=106777",
    summary:
      "管理科学学院2026年7月24日发布。四川省教育厅主办、成都理工大学承办。参赛对象为在校专科生、本科生，每队3人。报名截止2026年9月10日，原文未写钟点，截止记为当日23:59（北京时间）。校赛时间2026年9月底，地点待定。报名方式为加入QQ群1106690679并填写群内报名表。",
    status: "expired",
    published_at: "2026-07-24T00:00:00+08:00",
    updated_at: "2026-07-24T00:00:00+08:00",
  }),
]
