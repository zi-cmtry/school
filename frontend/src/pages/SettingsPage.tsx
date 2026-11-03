import { useEffect, useState, type FormEvent } from "react"
import {
  GRADE_OPTIONS,
  SAMPLE_PROFILE,
  hasSavedProfile,
  loadSavedProfile,
  readOnboardingChoice,
  saveProfile,
  type StudentProfile,
} from "../profile"
import { readHidden, unhideOpportunity, type HiddenOpportunity } from "../hidden"

const BLANK_PROFILE: StudentProfile = {
  school: SAMPLE_PROFILE.school,
  college: "",
  major: "",
  grade: "大二",
}

export function SettingsPage() {
  const [profile, setProfile] = useState<StudentProfile>(BLANK_PROFILE)
  const [saved, setSaved] = useState(false)
  const [known, setKnown] = useState(false)
  const [skipped, setSkipped] = useState(false)
  const [hidden, setHidden] = useState<HiddenOpportunity[]>([])

  useEffect(() => {
    document.title = "设置 · 校园可信信息"
    const stored = loadSavedProfile()
    setProfile(stored ?? { ...BLANK_PROFILE })
    setKnown(hasSavedProfile())
    setSkipped(readOnboardingChoice() === "skipped" && !hasSavedProfile())
    setHidden(readHidden())
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
    setSkipped(false)
  }

  function restoreSample() {
    setProfile({ ...SAMPLE_PROFILE })
    setSaved(false)
  }

  function restoreHidden(id: string) {
    setHidden(unhideOpportunity(id))
  }

  return (
    <section className="stack">
      <div className="panel">
        <h2 className="section-title">不感兴趣</h2>
        <p className="lede">按信息编号隐藏，只对你这台浏览器生效。不会删除服务器记录，也不会按公司拉黑。</p>
        {hidden.length === 0 ? <p className="meta">还没有标记不感兴趣的信息。</p> : null}
        <ul className="hidden-list">
          {hidden.map((item) => (
            <li key={item.id}>
              <span>
                <strong>{item.title || "未记下标题"}</strong>
                <span className="meta">编号 {item.id}</span>
              </span>
              <button className="ghost" type="button" onClick={() => restoreHidden(item.id)}>
                解除
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="panel">
        <h2 className="section-title">学院、专业、年级</h2>
        <p className="lede">
          只保存在这台浏览器。不会用来筛选或重排实习、校招、竞赛，也不会编造岗位。
        </p>
        {skipped ? <p className="banner note">你跳过了首次填写。这里仍可以补，列表保持原样。</p> : null}
        {known && !saved ? <p className="banner note">已读取上次保存在本地的画像。</p> : null}
        {saved ? <p className="banner note">已保存在这台浏览器。列表顺序保持原样。</p> : null}
        {!known && !skipped ? <p className="banner note">还没有保存画像。下面是空的，示例可以一键填入。</p> : null}
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
              placeholder={`例如${SAMPLE_PROFILE.college}`}
            />
          </label>
          <label>
            专业
            <input
              value={profile.major}
              onChange={(event) => update("major", event.target.value)}
              placeholder={`例如${SAMPLE_PROFILE.major}`}
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
      </div>
    </section>
  )
}
