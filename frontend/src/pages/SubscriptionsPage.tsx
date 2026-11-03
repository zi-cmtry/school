import { useEffect, useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { KIND_LABEL } from "../labels"
import type { OpportunityKind } from "../domain/opportunity"

const KINDS: OpportunityKind[] = ["internship", "campus_recruit", "competition"]
const STORAGE_KEY = "cdut-trust-subscriptions-v1"

type SubscriptionDraft = {
  kinds: OpportunityKind[]
  note: string
}

function loadDraft(): SubscriptionDraft {
  if (typeof localStorage === "undefined") return { kinds: [], note: "" }
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null")
    if (!raw || typeof raw !== "object") return { kinds: [], note: "" }
    const row = raw as Partial<SubscriptionDraft>
    const kinds = Array.isArray(row.kinds)
      ? row.kinds.filter((item): item is OpportunityKind => KINDS.includes(item as OpportunityKind))
      : []
    return { kinds, note: typeof row.note === "string" ? row.note : "" }
  } catch {
    return { kinds: [], note: "" }
  }
}

export function SubscriptionsPage() {
  const [kinds, setKinds] = useState<OpportunityKind[]>([])
  const [note, setNote] = useState("")
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    document.title = "订阅 · 校园可信信息"
    const draft = loadDraft()
    setKinds(draft.kinds)
    setNote(draft.note)
  }, [])

  function toggle(kind: OpportunityKind) {
    setSaved(false)
    setKinds((current) => (current.includes(kind) ? current.filter((item) => item !== kind) : [...current, kind]))
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ kinds, note }))
    setSaved(true)
  }

  return (
    <section className="panel">
      <p className="lede">
        订阅只是本周的占位。勾选想关注的类型后保存在这台浏览器里，不会推送，也不会筛选或重排实习、校招和竞赛。
      </p>
      {saved ? <p className="banner note">已保存在这台浏览器。列表顺序没有变化。</p> : null}
      <form className="form" onSubmit={onSubmit}>
        <fieldset className="choices">
          <legend>想关注的类型</legend>
          {KINDS.map((kind) => (
            <label key={kind}>
              <input type="checkbox" checked={kinds.includes(kind)} onChange={() => toggle(kind)} />
              {KIND_LABEL[kind]}
            </label>
          ))}
        </fieldset>
        <label>
          备注
          <textarea
            value={note}
            onChange={(event) => {
              setSaved(false)
              setNote(event.target.value)
            }}
            placeholder="例如只看成都的校招，本周不会生效"
          />
        </label>
        <div className="form-actions">
          <button className="primary" type="submit">
            保存订阅
          </button>
          <Link className="ghost" to="/settings">
            去个人设置
          </Link>
        </div>
      </form>
    </section>
  )
}
