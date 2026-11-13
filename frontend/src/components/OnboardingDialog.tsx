import { useEffect, useId, useRef, useState, type FormEvent } from "react"
import {
  GRADE_OPTIONS,
  profileFromGuide,
  saveProfile,
  shouldPromptProfile,
  skipProfilePrompt,
} from "../profile"

export function OnboardingDialog() {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [college, setCollege] = useState("")
  const [major, setMajor] = useState("")
  const [grade, setGrade] = useState<string>(GRADE_OPTIONS[1])
  const [error, setError] = useState("")

  useEffect(() => {
    setOpen(shouldPromptProfile())
  }, [])

  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    dialog?.querySelector<HTMLElement>("input, select, button")?.focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        skipProfilePrompt()
        setOpen(false)
        return
      }
      if (event.key !== "Tab" || !dialog) return
      const nodes = [...dialog.querySelectorAll<HTMLElement>("input, select, button")]
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open])

  if (!open) return null

  function skip() {
    skipProfilePrompt()
    setOpen(false)
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const profile = profileFromGuide({ college, major, grade })
    if (!profile) {
      setError("请填写学院和专业，并选择年级。也可以先跳过。")
      return
    }
    saveProfile(profile)
    setOpen(false)
  }

  return (
    <div className="modal-backdrop">
      <div ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId}>先写一下你的院系</h2>
        <p className="lede">
          学院、专业和年级只保存在这台浏览器，可以跳过。填了专业后，实习、校招和竞赛会把对口的排在前面，其余仍显示，不另开栏目，也不改写标题或编造岗位。跳过或专业留空时，列表不带 major。
        </p>
        <form className="form" onSubmit={onSubmit}>
          <label>
            学院
            <input
              value={college}
              onChange={(event) => {
                setError("")
                setCollege(event.target.value)
              }}
              placeholder="例如管理科学学院"
              autoComplete="organization"
            />
          </label>
          <label>
            专业
            <input
              value={major}
              onChange={(event) => {
                setError("")
                setMajor(event.target.value)
              }}
              placeholder="例如大数据管理与应用"
            />
          </label>
          <label>
            年级
            <select
              value={grade}
              onChange={(event) => {
                setError("")
                setGrade(event.target.value)
              }}
            >
              {GRADE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          {error ? <p className="banner">{error}</p> : null}
          <div className="form-actions">
            <button className="primary" type="submit">
              保存并进入
            </button>
            <button className="ghost" type="button" onClick={skip}>
              跳过
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
