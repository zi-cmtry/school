/**
 * 学院、专业、年级只存在这台浏览器。
 * 非空专业会作为 major 传给三个列表，只影响顺序，不隐藏其他项，也不编造岗位。
 * 跳过画像或专业为空时不传 major。
 */

export const PROFILE_CHANGE_EVENT = "cdut-profile-change"

import { browserStore, type KeyValueStore } from "./storage"

export type StudentProfile = {
  school: string
  college: string
  major: string
  grade: string
}

export const SAMPLE_PROFILE: StudentProfile = {
  school: "成都理工大学",
  college: "管理科学学院",
  major: "大数据管理与应用",
  grade: "大二",
}

export const GRADE_OPTIONS = ["大一", "大二", "大三", "大四", "大五", "研一", "研二", "研三"] as const

export const PROFILE_STORAGE_KEY = "cdut-trust-profile-v1"
export const ONBOARDING_STORAGE_KEY = "cdut-trust-onboarding-v1"

export type OnboardingChoice = "skipped" | "saved"

export function parseProfile(raw: unknown): StudentProfile | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Partial<StudentProfile>
  if (typeof row.school !== "string" || typeof row.college !== "string") return null
  if (typeof row.major !== "string" || typeof row.grade !== "string") return null
  return {
    school: row.school,
    college: row.college,
    major: row.major,
    grade: row.grade,
  }
}

export function loadSavedProfile(store: KeyValueStore | null = browserStore()): StudentProfile | null {
  if (!store) return null
  try {
    return parseProfile(JSON.parse(store.getItem(PROFILE_STORAGE_KEY) ?? "null"))
  } catch {
    return null
  }
}

export function loadProfile(store: KeyValueStore | null = browserStore()): StudentProfile {
  return loadSavedProfile(store) ?? { ...SAMPLE_PROFILE }
}

export function hasSavedProfile(store: KeyValueStore | null = browserStore()): boolean {
  if (!store) return false
  return store.getItem(PROFILE_STORAGE_KEY) !== null
}

export function readOnboardingChoice(store: KeyValueStore | null = browserStore()): OnboardingChoice | null {
  if (!store) return null
  const value = store.getItem(ONBOARDING_STORAGE_KEY)
  if (value === "skipped" || value === "saved") return value
  if (store.getItem(PROFILE_STORAGE_KEY) !== null) return "saved"
  return null
}

/** 没有跳过、也没有保存过画像时，才弹出首次填写。 */
export function shouldPromptProfile(store: KeyValueStore | null = browserStore()): boolean {
  return readOnboardingChoice(store) === null
}

export function skipProfilePrompt(store: KeyValueStore | null = browserStore()): void {
  store?.setItem(ONBOARDING_STORAGE_KEY, "skipped")
}

export function profileFromGuide(input: { college: string; major: string; grade: string }): StudentProfile | null {
  const college = input.college.trim()
  const major = input.major.trim()
  const grade = input.grade.trim()
  if (!college || !major) return null
  if (!(GRADE_OPTIONS as readonly string[]).includes(grade)) return null
  return {
    school: SAMPLE_PROFILE.school,
    college,
    major,
    grade,
  }
}

export function savedMajor(store: KeyValueStore | null = browserStore()): string {
  return loadSavedProfile(store)?.major.trim() ?? ""
}

export function saveProfile(profile: StudentProfile, store: KeyValueStore | null = browserStore()): void {
  store?.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile))
  store?.setItem(ONBOARDING_STORAGE_KEY, "saved")
  if (typeof window !== "undefined") window.dispatchEvent(new Event(PROFILE_CHANGE_EVENT))
}
