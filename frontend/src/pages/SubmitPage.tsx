import { useEffect, useMemo, useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { createOpportunity } from "../api/opportunities"
import { explainApiError, explainFieldError } from "../api/messages"
import {
  ApiError,
  competitionOnWhitelist,
  isHttpUrl,
  resolveSource,
  type OpportunityKind,
} from "../domain/opportunity"
import { KIND_LABEL, TIER_LABEL, beijingLocalToIso, splitTags } from "../labels"
import { listPath } from "../lists"

const KINDS: OpportunityKind[] = ["internship", "campus_recruit", "competition"]

export function SubmitPage() {
  const navigate = useNavigate()
  const [title, setTitle] = useState("")
  const [kind, setKind] = useState<OpportunityKind>("campus_recruit")
  const [company, setCompany] = useState("")
  const [tags, setTags] = useState("")
  const [location, setLocation] = useState("")
  const [deadline, setDeadline] = useState("")
  const [sourceUrl, setSourceUrl] = useState("")
  const [applyUrl, setApplyUrl] = useState("")
  const [summary, setSummary] = useState("")
  const [pending, setPending] = useState(false)
  const [formError, setFormError] = useState("")
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [existingId, setExistingId] = useState("")

  useEffect(() => {
    document.title = "录入 · 校园可信信息"
  }, [])

  const tierPreview = useMemo(() => {
    if (!isHttpUrl(sourceUrl)) return null
    try {
      return resolveSource(sourceUrl, kind)
    } catch {
      return null
    }
  }, [sourceUrl, kind])

  const whitelistWarning = kind === "competition" && isHttpUrl(sourceUrl) && !competitionOnWhitelist(sourceUrl)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError("")
    setFieldErrors({})
    setExistingId("")
    setPending(true)
    try {
      const created = await createOpportunity({
        title,
        kind,
        company,
        role_tags: splitTags(tags),
        location,
        deadline_at: deadline ? beijingLocalToIso(deadline) : "",
        source_url: sourceUrl,
        apply_url: applyUrl,
        summary,
      })
      navigate(listPath(created.kind, created.status, created.id))
    } catch (reason) {
      if (reason instanceof ApiError) {
        const map: Record<string, string> = {}
        for (const field of reason.fields ?? []) map[field.field] = explainFieldError(field.field, field.message)
        setFieldErrors(map)
        setFormError(explainApiError(reason))
        setExistingId(reason.existingId ?? "")
      } else {
        setFormError("提交失败，请稍后再试")
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="panel">
      <p className="lede">
        实习、校招、竞赛都可以录入。来源链接必填，空着提交会收到拒绝。来源名称和可信层级由后端按链接判断，这里不能手填成官方。
      </p>
      <form className="form" onSubmit={onSubmit} noValidate>
        <label>
          标题
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
          {fieldErrors.title ? <span className="field-error">{fieldErrors.title}</span> : null}
        </label>
        <fieldset className="choices">
          <legend>类型</legend>
          {KINDS.map((item) => (
            <label key={item}>
              <input type="radio" name="kind" checked={kind === item} onChange={() => setKind(item)} />
              {KIND_LABEL[item]}
            </label>
          ))}
        </fieldset>
        <label>
          单位或主办方
          <input value={company} onChange={(event) => setCompany(event.target.value)} placeholder="用人单位或竞赛主办方" />
          {fieldErrors.company ? <span className="field-error">{fieldErrors.company}</span> : null}
        </label>
        <label>
          岗位或赛道
          <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="用顿号或逗号分开，原文没有就留空" />
        </label>
        <label>
          地点
          <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="原文没有就留空" />
        </label>
        <label>
          截止时间（北京时间）
          <input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
          {fieldErrors.deadline_at ? <span className="field-error">{fieldErrors.deadline_at}</span> : null}
        </label>
        <label>
          来源链接
          <input
            type="url"
            inputMode="url"
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
            placeholder="https://"
          />
          {fieldErrors.source_url ? <span className="field-error">{fieldErrors.source_url}</span> : null}
        </label>
        {tierPreview ? (
          <p className="tier-preview">
            按当前链接，后端会记为{TIER_LABEL[tierPreview.source_tier]}，来源名称是{tierPreview.source_name}。最终以返回结果为准。
          </p>
        ) : null}
        {whitelistWarning ? (
          <p className="banner note">
            这个竞赛链接不在白名单里。白名单是教务处、管理科学学院、材料与化学化工学院，以及四川省高校学科竞赛平台（scgxxkjs.moocollege.com 与 cp.moocollege.com）。仍然可以提交，但不会标成校内渠道。
          </p>
        ) : null}
        <label>
          投递或报名链接
          <input type="url" value={applyUrl} onChange={(event) => setApplyUrl(event.target.value)} placeholder="没有就留空" />
          {fieldErrors.apply_url ? <span className="field-error">{fieldErrors.apply_url}</span> : null}
        </label>
        <label>
          摘要
          <textarea value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="只写来源里有的话" />
        </label>
        {formError ? <p className="banner">{formError}</p> : null}
        {existingId ? (
          <p>
            <Link to={`/opportunities/${existingId}`}>查看已收录的那一条</Link>
          </p>
        ) : null}
        <div className="form-actions">
          <button className="primary" type="submit" disabled={pending}>
            {pending ? "提交中" : "提交"}
          </button>
        </div>
      </form>
    </section>
  )
}
