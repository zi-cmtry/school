/** 本周只在浏览器里保存画像，不参与列表排序，也不做推荐。 */

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

const STORAGE_KEY = "cdut-trust-profile-v1"

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

export function loadProfile(): StudentProfile {
  if (typeof localStorage === "undefined") return { ...SAMPLE_PROFILE }
  try {
    const parsed = parseProfile(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"))
    return parsed ?? { ...SAMPLE_PROFILE }
  } catch {
    return { ...SAMPLE_PROFILE }
  }
}

export function saveProfile(profile: StudentProfile): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
}

export function hasSavedProfile(): boolean {
  if (typeof localStorage === "undefined") return false
  return localStorage.getItem(STORAGE_KEY) !== null
}
