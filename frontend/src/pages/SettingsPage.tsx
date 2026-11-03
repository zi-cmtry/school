import { useEffect, useState, type FormEvent } from "react"
import {
  GRADE_OPTIONS,
  SAMPLE_PROFILE,
  hasSavedProfile,
  loadProfile,
  saveProfile,
  type StudentProfile,
} from "../profile"

export function SettingsPage() {
  const [profile, setProfile] = useState<StudentProfile>(SAMPLE_PROFILE)
  const [saved, setSaved] = useState(false)
  const [known, setKnown] = useState(false)

  useEffect(() => {
    document.title = "个人设置 · 校园可信信息"
    setProfile(loadProfile())
    setKnown(hasSavedProfile())
  }, [])

  function update(field: keyof StudentProfile, value: string) {
    setSaved(false)
    setProfile((current) => ({ ...current, [field]: value }))
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    saveProfile(profile)
    setSaved(true)
    setKnown(true)
  }

  function restoreSample() {
    setProfile({ ...SAMPLE_PROFILE })
    setSaved(false)
  }

  return (
    <section className="panel">
      <p className="lede">
        个人设置只保存在这台浏览器里。本周用它留一个入口，不会按学校、学院、专业或年级推荐，也不会改变求职和竞赛的排序。
      </p>
      {known && !saved ? <p className="banner note">已读取上次保存在本地的画像。</p> : null}
      {saved ? <p className="banner note">已保存在这台浏览器。列表顺序保持原样。</p> : null}
      <form className="form" onSubmit={onSubmit}>
        <label>
          学校
          <input
            value={profile.school}
            onChange={(event) => update("school", event.target.value)}
            placeholder={SAMPLE_PROFILE.school}
            autoComplete="organization"
          />
        </label>
        <label>
          学院
          <input
            value={profile.college}
            onChange={(event) => update("college", event.target.value)}
            placeholder={SAMPLE_PROFILE.college}
          />
        </label>
        <label>
          专业
          <input
            value={profile.major}
            onChange={(event) => update("major", event.target.value)}
            placeholder={SAMPLE_PROFILE.major}
          />
        </label>
        <label>
          年级
          <select value={profile.grade} onChange={(event) => update("grade", event.target.value)}>
            {GRADE_OPTIONS.map((grade) => (
              <option key={grade} value={grade}>
                {grade}
              </option>
            ))}
          </select>
        </label>
        <div className="form-actions">
          <button className="primary" type="submit">
            保存到本地
          </button>
          <button className="ghost" type="button" onClick={restoreSample}>
            填回示例
          </button>
        </div>
      </form>
    </section>
  )
}
