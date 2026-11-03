import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { apiBaseUrl } from "../api/config"
import { explainApiError } from "../api/messages"
import { kindListQuery, listOpportunities, listRequestPath } from "../api/opportunities"
import { OpportunityCard } from "../components/OpportunityCard"
import { ApiError, isStatus, type Opportunity, type OpportunityKind } from "../domain/opportunity"
import { hideOpportunity, omitHidden, readHidden, type HiddenOpportunity } from "../hidden"
import { KIND_PAGE_TITLE } from "../lists"

const LEDE: Record<OpportunityKind, string> = {
  internship:
    "只请求实习。校招和竞赛不会出现在这里。学院、专业、年级保存在这台浏览器，不会筛选、不会重排，也不会编造岗位。",
  campus_recruit:
    "只请求校招。实习和竞赛不会出现在这里。学院、专业、年级保存在这台浏览器，不会筛选、不会重排，也不会编造岗位。",
  competition:
    "只请求竞赛。白名单站点包括教务处、管理科学学院、材料与化学化工学院，以及四川省高校学科竞赛平台（scgxxkjs.moocollege.com 与 cp.moocollege.com）。",
}

export function ListPage({ kind }: { kind: OpportunityKind }) {
  const [params, setParams] = useSearchParams()
  const [items, setItems] = useState<Opportunity[] | null>(null)
  const [hidden, setHidden] = useState<HiddenOpportunity[]>(() => readHidden())
  const [source, setSource] = useState<"api" | "mock" | "">("")
  const [error, setError] = useState("")
  const now = useMemo(() => new Date(), [])
  const created = params.get("created") ?? ""
  const statusParam = params.get("status")
  const status = statusParam && isStatus(statusParam) ? statusParam : null
  const query = kindListQuery(kind, status)
  const requestPath = listRequestPath(query)
  const title = KIND_PAGE_TITLE[kind]

  useEffect(() => {
    document.title = `${title} · 校园可信信息`
  }, [title])

  useEffect(() => {
    let cancelled = false
    setItems(null)
    setSource("")
    setError("")
    listOpportunities(kindListQuery(kind, status))
      .then((result) => {
        if (cancelled) return
        setItems(result.items)
        setSource(result.source)
      })
      .catch((reason: unknown) => {
        if (cancelled) return
        setItems([])
        setError(reason instanceof ApiError ? explainApiError(reason) : "列表加载失败")
      })
    return () => {
      cancelled = true
    }
  }, [kind, status])

  useEffect(() => {
    if (!created || !items?.some((item) => item.id === created)) return
    document.getElementById(`item-${created}`)?.scrollIntoView({ block: "center" })
  }, [created, items])

  function patch(mutate: (next: URLSearchParams) => void) {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete("created")
      mutate(next)
      return next
    })
  }

  function dismiss(item: Opportunity) {
    setHidden(hideOpportunity({ id: item.id, title: item.title }))
  }

  const showingExpired = status === "expired"
  const visible = items ? omitHidden(items, hidden) : null
  const hiddenHere = items && visible ? items.length - visible.length : 0

  return (
    <section>
      <div className="panel">
        <p className="lede">{LEDE[kind]}</p>
        <div className="filters" role="group" aria-label="筛选">
          <button
            type="button"
            className="chip"
            aria-pressed={showingExpired}
            onClick={() =>
              patch((next) => {
                if (showingExpired) next.delete("status")
                else next.set("status", "expired")
              })
            }
          >
            已截止
          </button>
        </div>
        <p className="count">{visible ? `${visible.length} 条` : "加载中"}</p>
        {hiddenHere > 0 ? <p className="tier-preview">有 {hiddenHere} 条已标为不感兴趣，可在设置里解除。</p> : null}
        <p className="request">本次请求 GET {requestPath}</p>
        <p className="tier-preview">
          {source === "api" ? `数据来自后端 ${apiBaseUrl()}` : source === "mock" ? "后端未连接，当前显示本地示例。" : ""}
        </p>
      </div>

      {error ? <p className="banner">{error}</p> : null}

      {visible && visible.length === 0 ? (
        <div className="empty">
          <h2>{hiddenHere > 0 && items && items.length > 0 ? "这些信息你都标成了不感兴趣" : "这条筛选下没有信息"}</h2>
          <p>
            {hiddenHere > 0 && items && items.length > 0
              ? "服务器上的记录还在。到设置里可以解除。"
              : showingExpired
                ? "没有已截止的记录。可以关掉「已截止」。"
                : "默认只显示进行中的记录。已经截止的内容在「已截止」里。"}
          </p>
        </div>
      ) : null}

      <div className="stack">
        {visible?.map((item) => (
          <OpportunityCard key={item.id} item={item} now={now} highlighted={item.id === created} onDismiss={dismiss} />
        ))}
      </div>
    </section>
  )
}
