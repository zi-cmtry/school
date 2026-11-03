/**
 * 「不感兴趣」只按机会 id 记在这台浏览器。
 * 不删库、不改请求、不按公司隐藏、不跨设备同步。
 */

import { browserStore, type KeyValueStore } from "./storage"

export const HIDDEN_STORAGE_KEY = "cdut-trust-hidden-v1"

export type HiddenOpportunity = {
  id: string
  title: string
}

export function parseHidden(raw: unknown): HiddenOpportunity[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const items: HiddenOpportunity[] = []
  for (const entry of raw) {
    const row = normalizeHiddenEntry(entry)
    if (!row || seen.has(row.id)) continue
    seen.add(row.id)
    items.push(row)
  }
  return items
}

function normalizeHiddenEntry(entry: unknown): HiddenOpportunity | null {
  if (typeof entry === "string" || typeof entry === "number") {
    const id = String(entry).trim()
    return id ? { id, title: "" } : null
  }
  if (!entry || typeof entry !== "object") return null
  const row = entry as { id?: unknown; title?: unknown }
  if (typeof row.id !== "string" && typeof row.id !== "number") return null
  const id = String(row.id).trim()
  if (!id) return null
  return { id, title: typeof row.title === "string" ? row.title : "" }
}

export function readHidden(store: KeyValueStore | null = browserStore()): HiddenOpportunity[] {
  if (!store) return []
  try {
    return parseHidden(JSON.parse(store.getItem(HIDDEN_STORAGE_KEY) ?? "null"))
  } catch {
    return []
  }
}

export function isHidden(id: string, store: KeyValueStore | null = browserStore()): boolean {
  return readHidden(store).some((item) => item.id === id)
}

export function hideOpportunity(
  item: { id: string; title?: string },
  store: KeyValueStore | null = browserStore(),
): HiddenOpportunity[] {
  const id = item.id.trim()
  if (!id || !store) return readHidden(store)
  const next = readHidden(store).filter((row) => row.id !== id)
  next.push({ id, title: item.title?.trim() ?? "" })
  store.setItem(HIDDEN_STORAGE_KEY, JSON.stringify(next))
  return next
}

export function unhideOpportunity(id: string, store: KeyValueStore | null = browserStore()): HiddenOpportunity[] {
  if (!store) return []
  const next = readHidden(store).filter((row) => row.id !== id)
  store.setItem(HIDDEN_STORAGE_KEY, JSON.stringify(next))
  return next
}

/** 只去掉被标记的 id，保留其余条目的原有顺序。 */
export function omitHidden<T extends { id: string }>(items: readonly T[], hidden: readonly { id: string }[]): T[] {
  const ids = new Set(hidden.map((item) => item.id))
  return items.filter((item) => !ids.has(item.id))
}
