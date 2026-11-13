import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { explainApiError } from "../api/messages"
import { getOpportunity } from "../api/opportunities"
import { ApiError, type Opportunity } from "../domain/opportunity"
import { hideOpportunity, isHidden } from "../hidden"
import { KIND_LABEL, STATUS_LABEL, TIER_HINT, TIER_LABEL, excerptOrMissing, formatDateTime, showText } from "../labels"
import { detailBackPath } from "../lists"
import { RiskNotice } from "../components/RiskNotice"

export function DetailPage() {
  const { id = "" } = useParams()
  const [item, setItem] = useState<Opportunity | null | undefined>(undefined)
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState("")
  const hidden = useMemo(() => isHidden(id), [id, revision])

  useEffect(() => {
    document.title = "详情 · 校园可信信息"
    let cancelled = false
    setItem(undefined)
    setError("")
    getOpportunity(id)
      .then((result) => {
        if (cancelled) return
        setItem(result.item)
        if (result.item && !isHidden(id)) document.title = `${result.item.title} · 校园可信信息`
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof ApiError ? explainApiError(reason) : "详情加载失败")
      })
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (hidden) document.title = "详情 · 校园可信信息"
  }, [hidden])

  if (item === undefined && !error) return <p className="lede">加载中</p>

  const back = detailBackPath(item ?? null)

  if (hidden) {
    return (
      <section className="panel">
        <h2>已标为不感兴趣</h2>
        <p className="lede">这条信息不会出现在你的列表和详情里。记录仍在服务器上，到设置里可以解除。</p>
        <div className="form-actions">
          <Link className="primary" to="/settings">
            去设置解除
          </Link>
          <Link className="ghost" to={back}>
            返回列表
          </Link>
        </div>
      </section>
    )
  }

  if (error) return <p className="banner">{error}</p>
  if (!item) {
    return (
      <div className="empty">
        <h2>没有这条信息</h2>
        <Link to={back}>返回列表</Link>
      </div>
    )
  }
  const rows: [string, string][] = [
    ["标题", item.title],
    ["类型", KIND_LABEL[item.kind]],
    ["单位", showText(item.company)],
    ["岗位或赛道", item.role_tags.length ? item.role_tags.join("、") : "原文未提供"],
    ["地点", showText(item.location)],
    ["工作地", excerptOrMissing(item.work_location)],
    ["截止时间", formatDateTime(item.deadline_at)],
    ["来源名称", showText(item.source_name)],
    ["来源层级", `${TIER_LABEL[item.source_tier]}。${TIER_HINT[item.source_tier]}`],
    ["状态", STATUS_LABEL[item.status]],
    ["发布时间", formatDateTime(item.published_at)],
    ["更新时间", formatDateTime(item.updated_at)],
    ["抓取时间", formatDateTime(item.fetched_at)],
  ]

  return (
    <article className="panel detail">
      <Link className="back" to={back}>
        返回列表
      </Link>
      <div className="tags" style={{ marginTop: 12 }}>
        <span className={`badge ${item.kind}`}>{KIND_LABEL[item.kind]}</span>
        <span className={`badge ${item.source_tier}`}>{TIER_LABEL[item.source_tier]}</span>
        <span className={`badge ${item.status}`}>{STATUS_LABEL[item.status]}</span>
      </div>
      <h2>{item.title}</h2>
      <RiskNotice flags={item.risk_flags} />
      <p className="summary">{item.summary || "原文未提供摘要。"}</p>
      <Excerpt heading="岗位职责" value={item.responsibilities} />
      <Excerpt heading="任职要求" value={item.requirements} />
      <Excerpt heading="专业要求" value={item.major_requirements} />
      <div className="detail-actions">
        <a className="primary" href={item.source_url} target="_blank" rel="noreferrer">
          打开来源
        </a>
        {item.apply_url ? (
          <a className="ghost" href={item.apply_url} target="_blank" rel="noreferrer">
            打开投递或报名
          </a>
        ) : (
          <span className="meta">原文未提供投递或报名链接</span>
        )}
        <button
          className="ghost"
          type="button"
          onClick={() => {
            hideOpportunity({ id: item.id, title: item.title })
            setRevision((current) => current + 1)
          }}
        >
          不感兴趣
        </button>
      </div>
      <dl className="fields">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
        <div>
          <dt>来源链接</dt>
          <dd>
            <a href={item.source_url} target="_blank" rel="noreferrer">
              {item.source_url}
            </a>
          </dd>
        </div>
        <div>
          <dt>投递链接</dt>
          <dd>
            {item.apply_url ? (
              <a href={item.apply_url} target="_blank" rel="noreferrer">
                {item.apply_url}
              </a>
            ) : (
              "原文未提供"
            )}
          </dd>
        </div>
        <div>
          <dt>去重键</dt>
          <dd className="mono">{item.dedupe_key}</dd>
        </div>
      </dl>
    </article>
  )
}

function Excerpt({ heading, value }: { heading: string; value: string }) {
  return (
    <section className="excerpt-block">
      <h3>{heading}</h3>
      <p className="excerpt">{excerptOrMissing(value)}</p>
    </section>
  )
}
