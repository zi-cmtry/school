export const OPPORTUNITY_KINDS = ["internship", "campus_recruit", "competition"] as const
export type OpportunityKind = (typeof OPPORTUNITY_KINDS)[number]

export const SOURCE_TIERS = ["official", "campus_channel", "student_submit", "unverified"] as const
export type SourceTier = (typeof SOURCE_TIERS)[number]

export const OPPORTUNITY_STATUSES = ["active", "expired", "duplicate", "withdrawn"] as const
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number]

/** 与 backend/app/config/school.yaml 的精确主机一致。只有 kind 落在 applies_to 里才信任该 host。 */
export const COMPETITION_WHITELIST_HOSTS = [
  "aao.cdut.edu.cn",
  "cim.cdut.edu.cn",
  "cmcc.cdut.edu.cn",
  "scgxxkjs.moocollege.com",
  "cp.moocollege.com",
] as const

export const JOB_OFFICIAL_HOST = "cdutjy.cdut.edu.cn"

export type Opportunity = {
  id: string
  title: string
  kind: OpportunityKind
  company: string
  role_tags: string[]
  location: string
  deadline_at: string
  source_url: string
  source_name: string
  source_tier: SourceTier
  apply_url: string
  summary: string
  status: OpportunityStatus
  dedupe_key: string
  published_at: string
  updated_at: string
  fetched_at: string
}

export type CreateOpportunityInput = {
  title: string
  kind: OpportunityKind
  company?: string
  role_tags?: string[]
  location?: string
  deadline_at: string
  source_url: string
  source_name?: string
  apply_url?: string
  summary?: string
  status?: OpportunityStatus
}

export type FieldError = {
  field: string
  message: string
}

/**
 * 与后端查询一致。
 * 页面三个入口总会带 kind。省略 kind 时，后端和本地回退仍是进行中的实习与校招，不含竞赛。
 */
export type ListQuery = {
  kind?: OpportunityKind
  status?: OpportunityStatus
}

export class ApiError extends Error {
  status: number
  code: string
  fields?: FieldError[]
  existingId?: string

  origin: "api" | "mock"

  constructor(
    status: number,
    code: string,
    message: string,
    extra?: { fields?: FieldError[]; existingId?: string; origin?: "api" | "mock" },
  ) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
    this.fields = extra?.fields
    this.existingId = extra?.existingId
    this.origin = extra?.origin ?? "mock"
  }
}

export function isKind(value: string): value is OpportunityKind {
  return (OPPORTUNITY_KINDS as readonly string[]).includes(value)
}

export function isStatus(value: string): value is OpportunityStatus {
  return (OPPORTUNITY_STATUSES as readonly string[]).includes(value)
}

export function bareHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "")
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim())
    return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password
  } catch {
    return false
  }
}

export function normalizeSourceUrl(raw: string): string {
  const url = new URL(raw.trim())
  url.hash = ""
  url.hostname = url.hostname.toLowerCase()
  if ((url.protocol === "http:" && url.port === "80") || (url.protocol === "https:" && url.port === "443")) {
    url.port = ""
  }
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1)
  }
  return url.toString()
}

/** 与后端 dedupe.normalize 相同：NFKC、去空白、只留字母数字和下划线。 */
export function normalizeKeyPart(value: string): string {
  const text = value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, "")
  return text.replace(/[^\p{L}\p{N}_]+/gu, "")
}

export function shanghaiDate(value: string | Date): string {
  const time = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(time.getTime())) return ""
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(time)
}

/** company|title|YYYY-MM-DD，日期按北京时间。 */
export function makeDedupeKey(company: string, title: string, deadlineAt: string): string {
  return `${normalizeKeyPart(company)}|${normalizeKeyPart(title)}|${shanghaiDate(deadlineAt)}`
}

export function competitionOnWhitelist(sourceUrl: string): boolean {
  try {
    const host = bareHost(new URL(sourceUrl).hostname)
    return (COMPETITION_WHITELIST_HOSTS as readonly string[]).includes(host)
  } catch {
    return false
  }
}

const SOURCE_RULES: { hosts: string[]; kinds: OpportunityKind[]; tier: SourceTier; name: string }[] = [
  {
    hosts: [JOB_OFFICIAL_HOST],
    kinds: ["internship", "campus_recruit"],
    tier: "official",
    name: "学生就业指导中心",
  },
  {
    hosts: ["aao.cdut.edu.cn"],
    kinds: ["competition"],
    tier: "campus_channel",
    name: "教务处竞赛通知",
  },
  {
    hosts: ["cim.cdut.edu.cn"],
    kinds: ["competition"],
    tier: "campus_channel",
    name: "计算机学院竞赛",
  },
  {
    hosts: ["cmcc.cdut.edu.cn"],
    kinds: ["competition"],
    tier: "campus_channel",
    name: "材料与化学化工学院",
  },
  {
    hosts: ["scgxxkjs.moocollege.com", "cp.moocollege.com"],
    kinds: ["competition"],
    tier: "campus_channel",
    name: "学科竞赛平台(moocollege)",
  },
]

/** 与 school.yaml 的「企业校招」规则一致。比较前已去掉开头的 www。 */
const ENTERPRISE_HOSTS = [
  "maker.haier.net",
  "jobs.hisense.com",
  "cngr.hotjob.cn",
  "job.sinopec.com",
  "xz.duoyi.com",
  "campus.mihoyo.com",
] as const

const ENTERPRISE_HOST_LABELS = ["jobs", "zhaopin", "maker", "careers", "campus"] as const

const ENTERPRISE_HOST_SUFFIXES = [".hotjob.cn", ".zhiye.com"] as const

/** 二手聚合或转载站。与 school.yaml 的 aggregators 一致。 */
const AGGREGATOR_DOMAINS = [
  "yingjiesheng.com",
  "ezhizhaopin.com",
  "51job.com",
  "zhaopin.com",
  "liepin.com",
  "bosszhipin.com",
  "zhipin.com",
  "lagou.com",
  "nowcoder.com",
  "shixiseng.com",
  "gaoxiaojob.com",
  "jobui.com",
  "chinahr.com",
  "kanzhun.com",
  "jobs.com",
  "linkedin.com",
  "indeed.com",
  "glassdoor.com",
] as const

function isAggregatorHost(host: string): boolean {
  return AGGREGATOR_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`))
}

function isCompanyAtsHost(host: string): boolean {
  return ENTERPRISE_HOST_SUFFIXES.some((suffix) => {
    if (!host.endsWith(suffix)) return false
    const left = host.slice(0, -suffix.length)
    if (!left || left.endsWith(".")) return false
    const first = left.split(".")[0]
    return first !== "www" && first !== "m"
  })
}

function isEnterpriseCareerUrl(host: string, pathname: string): boolean {
  if ((ENTERPRISE_HOSTS as readonly string[]).includes(host)) return true
  const first = host.split(".").filter(Boolean)[0] ?? ""
  if ((ENTERPRISE_HOST_LABELS as readonly string[]).includes(first)) return true
  if (isCompanyAtsHost(host)) return true
  return pathname.toLowerCase().includes("campus")
}

/** 来源名称和层级只由链接和类型决定，调用方不能指定。 */
export function resolveSource(sourceUrl: string, kind: OpportunityKind): { source_name: string; source_tier: SourceTier } {
  const url = new URL(sourceUrl)
  const host = bareHost(url.hostname)
  for (const rule of SOURCE_RULES) {
    if (!rule.hosts.includes(host)) continue
    if (rule.kinds.includes(kind)) return { source_name: rule.name, source_tier: rule.tier }
    return { source_name: host || "unknown", source_tier: "unverified" }
  }
  const jobKind = kind === "internship" || kind === "campus_recruit"
  if (jobKind && !isAggregatorHost(host) && isEnterpriseCareerUrl(host, url.pathname)) {
    return { source_name: "企业校招", source_tier: "campus_channel" }
  }
  return { source_name: host || "unknown", source_tier: "unverified" }
}

export function deadlineMs(value: string): number {
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? Number.NaN : time
}

export function isOpen(item: Pick<Opportunity, "status" | "deadline_at">, now: Date): boolean {
  return item.status === "active" && deadlineMs(item.deadline_at) >= now.getTime()
}

const JOB_KINDS: OpportunityKind[] = ["internship", "campus_recruit"]

/** 复刻 GET /api/v1/opportunities：省略 status 时只要 active，省略 kind 时排除竞赛。 */
export function filterOpportunities(items: Opportunity[], query: ListQuery): Opportunity[] {
  const status = query.status ?? "active"
  return items
    .filter((item) => item.status === status)
    .filter((item) => (query.kind ? item.kind === query.kind : JOB_KINDS.includes(item.kind)))
    .slice()
    .sort((a, b) => {
      const byTime = (deadlineMs(a.deadline_at) || 0) - (deadlineMs(b.deadline_at) || 0)
      if (byTime !== 0) return byTime
      return a.id.localeCompare(b.id, "en", { numeric: true })
    })
}

function cleanTags(tags: string[] | undefined): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const tag of tags ?? []) {
    const text = tag.trim().replace(/\s+/g, " ")
    if (!text || seen.has(text)) continue
    seen.add(text)
    result.push(text)
  }
  return result
}

export function validateAndBuild(
  input: CreateOpportunityInput,
  existing: Opportunity[],
  now: Date,
  id: string,
): { ok: true; value: Opportunity } | { ok: false; error: ApiError } {
  const errors: FieldError[] = []
  const title = input.title.trim()
  const company = (input.company ?? "").trim()
  if (!title) errors.push({ field: "title", message: "must not be blank" })
  if (!company) errors.push({ field: "company", message: "must not be blank" })
  if (!isKind(input.kind)) errors.push({ field: "kind", message: "invalid kind" })

  const deadline = input.deadline_at.trim()
  const deadlineTime = deadlineMs(deadline)
  if (!deadline || Number.isNaN(deadlineTime)) {
    errors.push({ field: "deadline_at", message: "field required" })
  }

  const sourceUrl = input.source_url.trim()
  if (!sourceUrl) {
    return {
      ok: false,
      error: new ApiError(400, "validation", "source_url is required", {
        fields: [{ field: "source_url", message: "source_url is required" }],
      }),
    }
  }
  if (!isHttpUrl(sourceUrl)) {
    return {
      ok: false,
      error: new ApiError(400, "validation", "source_url must be an absolute http(s) URL", {
        fields: [{ field: "source_url", message: "source_url must be an absolute http(s) URL" }],
      }),
    }
  }

  if (errors.length > 0 || !isKind(input.kind) || Number.isNaN(deadlineTime)) {
    return {
      ok: false,
      error: new ApiError(422, "validation", errors[0]?.message ?? "validation error", { fields: errors }),
    }
  }

  const source = resolveSource(sourceUrl, input.kind)
  const dedupeKey = makeDedupeKey(company, title, new Date(deadlineTime).toISOString())
  const urlOwner = existing.find((item) => item.source_url === sourceUrl.trim())
  if (urlOwner) {
    return {
      ok: false,
      error: new ApiError(409, "duplicate", "source_url already exists", { existingId: urlOwner.id }),
    }
  }
  const status = input.status ?? "active"
  if (status === "active") {
    const clash = existing.find((item) => item.dedupe_key === dedupeKey && item.status === "active")
    if (clash) {
      return {
        ok: false,
        error: new ApiError(409, "duplicate", "active opportunity with the same dedupe_key already exists", {
          existingId: clash.id,
        }),
      }
    }
  }

  const stamp = now.toISOString()
  const value: Opportunity = {
    id,
    title,
    kind: input.kind,
    company,
    role_tags: cleanTags(input.role_tags),
    location: (input.location ?? "").trim(),
    deadline_at: new Date(deadlineTime).toISOString(),
    source_url: sourceUrl.trim(),
    source_name: source.source_name,
    source_tier: source.source_tier,
    apply_url: (input.apply_url ?? "").trim(),
    summary: (input.summary ?? "").trim(),
    status,
    dedupe_key: dedupeKey,
    published_at: stamp,
    updated_at: stamp,
    fetched_at: stamp,
  }
  return { ok: true, value }
}
