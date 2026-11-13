import { demoRiskOpportunities } from "../data/risk-demo"
import { seedOpportunities } from "../data/seed"
import { parseRiskFlags } from "../domain/risk"
import { apiBaseUrl, useMock } from "./config"
import { errorFromResponse } from "./errors"
import { opportunityCollectionPath, opportunityItemPath } from "./paths"
import {
  ApiError,
  GENERIC_MAJOR,
  MISSING_TEXT,
  filterOpportunities,
  isKind,
  isStatus,
  validateAndBuild,
  type CreateOpportunityInput,
  type ListQuery,
  type Opportunity,
  type OpportunityKind,
  type OpportunityStatus,
  type PlaceScope,
  type SourceTier,
} from "../domain/opportunity"

const STORAGE_KEY = "cdut-trust-opportunities-v1"

export type OpportunityList = {
  items: Opportunity[]
  /** api：来自后端；mock：本地示例，或后端连不上时的回退。 */
  source: "api" | "mock"
  path: string
}

function readUserItems(): Opportunity[] {
  if (typeof localStorage === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isStoredOpportunity)
  } catch {
    return []
  }
}

function isStoredOpportunity(value: unknown): value is Opportunity {
  if (!value || typeof value !== "object") return false
  const item = value as Partial<Opportunity>
  return typeof item.id === "string" && typeof item.title === "string" && typeof item.source_url === "string"
}

function completeStored(item: Opportunity): Opportunity {
  return {
    ...item,
    work_location: excerptField(item.work_location),
    responsibilities: excerptField(item.responsibilities),
    requirements: excerptField(item.requirements),
    major_requirements: excerptField(item.major_requirements),
    major_tags: majorTagField(item.major_tags),
    risk_flags: parseRiskFlags(item.risk_flags),
  }
}

function readAll(): Opportunity[] {
  const user = readUserItems().map(completeStored)
  const userIds = new Set(user.map((item) => item.id))
  const base = [...seedOpportunities, ...demoRiskOpportunities].filter((item) => !userIds.has(item.id))
  return [...base, ...user]
}

function saveUserItems(items: Opportunity[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

function asText(value: unknown): string {
  if (typeof value === "string") return value
  if (value == null) return ""
  return String(value)
}

/** 空白或「未提供」收成「未提供」。有原文时原样保留，不改写。 */
export function excerptField(value: unknown): string {
  const text = asText(value)
  if (!text.trim() || text.trim() === MISSING_TEXT) return MISSING_TEXT
  return text
}

function majorTagField(value: unknown): string[] {
  if (!Array.isArray(value)) return [GENERIC_MAJOR]
  const tags = value.map((tag) => String(tag).trim()).filter(Boolean)
  return tags.length > 0 ? tags : [GENERIC_MAJOR]
}

/** 后端 id 是整数，空字段可能是 null。这里收成页面用的字符串。 */
export function normalizeOpportunity(raw: unknown): Opportunity {
  if (!raw || typeof raw !== "object") {
    throw new ApiError(502, "bad_response", "响应不是一条信息", { origin: "api" })
  }
  const row = raw as Record<string, unknown>
  const kind = asText(row.kind)
  const status = asText(row.status)
  const tier = asText(row.source_tier)
  if (row.id == null || row.id === "") {
    throw new ApiError(502, "bad_response", "响应缺少编号", { origin: "api" })
  }
  if (!isKind(kind) || !isStatus(status)) {
    throw new ApiError(502, "bad_response", "响应里的类型或状态无法识别", { origin: "api" })
  }
  const sourceTier: SourceTier =
    tier === "official" || tier === "campus_channel" || tier === "student_submit" || tier === "unverified"
      ? tier
      : "unverified"
  return {
    id: String(row.id),
    title: asText(row.title),
    kind,
    company: asText(row.company),
    role_tags: Array.isArray(row.role_tags) ? row.role_tags.map((tag) => String(tag)) : [],
    location: asText(row.location),
    deadline_at: asText(row.deadline_at),
    source_url: asText(row.source_url),
    source_name: asText(row.source_name),
    source_tier: sourceTier,
    apply_url: asText(row.apply_url),
    summary: asText(row.summary),
    status,
    dedupe_key: asText(row.dedupe_key),
    published_at: asText(row.published_at),
    updated_at: asText(row.updated_at),
    fetched_at: asText(row.fetched_at),
    work_location: excerptField(row.work_location),
    responsibilities: excerptField(row.responsibilities),
    requirements: excerptField(row.requirements),
    major_requirements: excerptField(row.major_requirements),
    major_tags: majorTagField(row.major_tags),
    risk_flags: parseRiskFlags(row.risk_flags),
  }
}

function toCreateBody(input: CreateOpportunityInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    title: input.title,
    kind: input.kind,
    company: input.company ?? "",
    source_url: input.source_url,
    role_tags: input.role_tags ?? [],
  }
  if (input.deadline_at) body.deadline_at = input.deadline_at
  if (input.location) body.location = input.location
  if (input.apply_url) body.apply_url = input.apply_url
  if (input.summary) body.summary = input.summary
  if (input.status) body.status = input.status
  return body
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${apiBaseUrl()}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    })
  } catch {
    throw new ApiError(0, "network", "连不上后端", { origin: "api" })
  }
}

function isNetworkError(error: unknown): boolean {
  return error instanceof ApiError && error.code === "network"
}

export function listRequestPath(query: ListQuery): string {
  return opportunityCollectionPath(query)
}

export async function listOpportunities(query: ListQuery): Promise<OpportunityList> {
  const path = opportunityCollectionPath(query)
  if (!useMock()) {
    try {
      const response = await request(path)
      if (!response.ok) throw await errorFromResponse(response)
      const body: unknown = await response.json()
      if (!Array.isArray(body)) throw new ApiError(502, "bad_response", "列表响应不是数组", { origin: "api" })
      return { items: body.map(normalizeOpportunity), source: "api", path }
    } catch (error) {
      if (!isNetworkError(error)) throw error
    }
  }
  return { items: filterOpportunities(readAll(), query), source: "mock", path }
}

export async function getOpportunity(id: string): Promise<{ item: Opportunity | null; source: "api" | "mock" }> {
  const path = opportunityItemPath(id)
  if (!useMock()) {
    try {
      const response = await request(path)
      if (response.status === 404) return { item: null, source: "api" }
      if (!response.ok) throw await errorFromResponse(response)
      return { item: normalizeOpportunity(await response.json()), source: "api" }
    } catch (error) {
      if (!isNetworkError(error)) throw error
    }
  }
  return { item: readAll().find((item) => item.id === id) ?? null, source: "mock" }
}

export async function createOpportunity(input: CreateOpportunityInput): Promise<Opportunity> {
  const path = opportunityCollectionPath()
  if (!useMock()) {
    const response = await request(path, { method: "POST", body: JSON.stringify(toCreateBody(input)) })
    if (!response.ok) throw await errorFromResponse(response)
    return normalizeOpportunity(await response.json())
  }
  const existing = readAll()
  const id = `sub_${crypto.randomUUID()}`
  const result = validateAndBuild(input, existing, new Date(), id)
  if (!result.ok) throw result.error
  const user = readUserItems().filter((item) => item.id !== result.value.id)
  saveUserItems([...user, result.value])
  return result.value
}

export async function patchOpportunity(id: string, patch: Partial<CreateOpportunityInput>): Promise<Opportunity> {
  const path = opportunityItemPath(id)
  if (!useMock()) {
    const response = await request(path, { method: "PATCH", body: JSON.stringify(toCreateBodyPartial(patch)) })
    if (!response.ok) throw await errorFromResponse(response)
    return normalizeOpportunity(await response.json())
  }
  const current = readAll().find((item) => item.id === id)
  if (!current) throw new ApiError(404, "not_found", "opportunity not found")
  const next: Opportunity = {
    ...current,
    ...patch,
    role_tags: patch.role_tags ?? current.role_tags,
    updated_at: new Date().toISOString(),
  }
  const user = readUserItems().filter((item) => item.id !== id)
  saveUserItems([...user, next])
  return next
}

function toCreateBodyPartial(patch: Partial<CreateOpportunityInput>): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  if (patch.title !== undefined) body.title = patch.title
  if (patch.kind !== undefined) body.kind = patch.kind
  if (patch.company !== undefined) body.company = patch.company
  if (patch.deadline_at) body.deadline_at = patch.deadline_at
  if (patch.source_url !== undefined) body.source_url = patch.source_url
  if (patch.role_tags !== undefined) body.role_tags = patch.role_tags
  if (patch.location !== undefined) body.location = patch.location
  if (patch.apply_url !== undefined) body.apply_url = patch.apply_url
  if (patch.summary !== undefined) body.summary = patch.summary
  if (patch.status !== undefined) body.status = patch.status
  return body
}

/**
 * 三个入口都会带上 kind。已截止再加 status。
 * 已保存且非空的专业才传 major，不传学院和年级。
 * 实习、校招切到省内才传 region=sichuan；默认（成都）不传 region。
 * 竞赛不传 region。
 */
export function kindListQuery(
  kind: OpportunityKind,
  status: OpportunityStatus | null,
  options?: { major?: string | null; place?: PlaceScope | null },
): ListQuery {
  const query: ListQuery = { kind }
  if (status) query.status = status
  const major = options?.major?.trim() ?? ""
  if (major) query.major = major
  if (options?.place === "sichuan" && kind !== "competition") query.region = "sichuan"
  return query
}
