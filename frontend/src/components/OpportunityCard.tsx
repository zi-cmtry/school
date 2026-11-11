import { Link } from "react-router-dom"
import type { Opportunity } from "../domain/opportunity"
import { isOpen } from "../domain/opportunity"
import { KIND_LABEL, STATUS_LABEL, TIER_LABEL, deadlineHint, formatDateTime } from "../labels"

export function OpportunityCard({
  item,
  now,
  highlighted,
  onDismiss,
}: {
  item: Opportunity
  now: Date
  highlighted: boolean
  onDismiss: (item: Opportunity) => void
}) {
  const open = isOpen(item, now)
  const tags = item.role_tags.slice(0, 4)
  const extra = item.role_tags.length - tags.length
  return (
    <article className={highlighted ? "card is-new" : "card"} id={`item-${item.id}`}>
      <Link className="card-link" to={`/opportunities/${item.id}`}>
        <div className="card-top">
          <span>
            <span className={`badge ${item.kind}`}>{KIND_LABEL[item.kind]}</span>{" "}
            {item.status !== "active" ? <span className={`badge ${item.status}`}>{STATUS_LABEL[item.status]}</span> : null}
          </span>
          <span className={open ? "remain open" : "remain"}>{deadlineHint(item.deadline_at, now)}</span>
        </div>
        <h2>{item.title}</h2>
        {item.company ? <p className="company">{item.company}</p> : null}
        {item.location ? <p className="meta">{item.location}</p> : <p className="meta">地点：原文未提供</p>}
        <p className="meta">截止 {formatDateTime(item.deadline_at)}</p>
        {tags.length > 0 ? (
          <div className="tags">
            {tags.map((tag) => (
              <span className="tag" key={tag}>
                {tag}
              </span>
            ))}
            {extra > 0 ? <span className="tag">+{extra}</span> : null}
          </div>
        ) : null}
      </Link>
      <p className="source-line">
        <span className={`badge ${item.source_tier}`}>{TIER_LABEL[item.source_tier]}</span>
        <span className="source-name">{item.source_name || "来源名称未提供"}</span>
        {item.source_url ? (
          <a href={item.source_url} target="_blank" rel="noreferrer">
            {item.source_url}
          </a>
        ) : (
          <span>来源链接未提供</span>
        )}
      </p>
      <button className="text-button dismiss" type="button" onClick={() => onDismiss(item)}>
        不感兴趣
      </button>
    </article>
  )
}
