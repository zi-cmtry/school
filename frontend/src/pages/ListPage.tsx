import { useEffect, useMemo, useState } from "react"
import { Navigate, useSearchParams } from "react-router-dom"
import { apiBaseUrl } from "../api/config"
import { explainApiError } from "../api/messages"
import {
  competitionListQuery,
  jobListQuery,
  listOpportunities,
  listRequestPath,
} from "../api/opportunities"
import { OpportunityCard } from "../components/OpportunityCard"
import { ApiError, isKind, isStatus, type Opportunity, type OpportunityKind } from "../domain/opportunity"

type Stream = "jobs" | "competitions"

export function ListPage({ stream }: { stream: Stream }) {
  const [params, setParams] = useSearchParams()
  const [items, setItems] = useState<Opportunity[] | null>(null)
  const [source, setSource] = useState<"api" | "mock" | "">("")
  const [error, setError] = useState("")
  const now = useMemo(() => new Date(), [])
  const created = params.get("created") ?? ""

  const kindParam = params.get("kind")
  const redirectToCompetitions = stream === "jobs" && kindParam === "competition"
  const kind: OpportunityKind | null =
    stream === "jobs" && kindParam && isKind(kindParam) && kindParam !== "competition" ? kindParam : null
  const statusParam = params.get("status")
  const status = statusParam && isStatus(statusParam) ? statusParam : null
  const query = stream === "jobs" ? jobListQuery(kind, status) : competitionListQuery(status)
  const requestPath = listRequestPath(query)

  useEffect(() => {
    document.title = stream === "jobs" ? "求职 · 校园可信信息" : "竞赛 · 校园可信信息"
  }, [stream])

  useEffect(() => {
    if (redirectToCompetitions) return
    let cancelled = false
    setError("")
    listOpportunities(query)
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
  }, [requestPath, redirectToCompetitions])

  useEffect(() => {
    if (!created || !items?.some((item) => item.id === created)) return
    document.getElementById(`item-${created}`)?.scrollIntoView({ block: "center" })
  }, [created, items])

  if (redirectToCompetitions) return <Navigate to="/competitions" replace />

  function patch(mutate: (next: URLSearchParams) => void) {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete("created")
      mutate(next)
      return next
    })
  }

  const showingExpired = status === "expired"

  return (
    <section>
      <div className="panel">
        <p className="lede">
          {stream === "jobs"
            ? "求职页请求默认列表：进行中的实习和校招，不含竞赛。个人设置不会改变这里的顺序。"
            : "竞赛页只请求竞赛。白名单站点包括教务处、管理科学学院、材料与化学化工学院，以及四川省高校学科竞赛平台。"}
        </p>
        <div className="filters" role="group" aria-label="筛选">
          {stream === "jobs" ? (
            <>
              <button type="button" className="chip" aria-pressed={kind === null} onClick={() => patch((next) => next.delete("kind"))}>
                全部求职
              </button>
              <button
                type="button"
                className="chip"
                aria-pressed={kind === "internship"}
                onClick={() => patch((next) => next.set("kind", "internship"))}
              >
                实习
              </button>
              <button
                type="button"
                className="chip"
                aria-pressed={kind === "campus_recruit"}
                onClick={() => patch((next) => next.set("kind", "campus_recruit"))}
              >
                校招
              </button>
            </>
          ) : null}
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
        <p className="count">{items ? `${items.length} 条` : "加载中"}</p>
        <p className="request">本次请求 GET {requestPath}</p>
        <p className="tier-preview">
          {source === "api" ? `数据来自后端 ${apiBaseUrl()}` : source === "mock" ? "后端未连接，当前显示本地示例。" : ""}
        </p>
      </div>

      {error ? <p className="banner">{error}</p> : null}

      {items && items.length === 0 ? (
        <div className="empty">
          <h2>这条筛选下没有信息</h2>
          <p>
            {showingExpired
              ? "没有已截止的记录。可以关掉「已截止」，或到录入页补一条带来源链接的信息。"
              : "默认只显示进行中的记录。已经截止的内容在「已截止」里。"}
          </p>
        </div>
      ) : null}

      <div className="stack">
        {items?.map((item) => (
          <OpportunityCard key={item.id} item={item} now={now} highlighted={item.id === created} />
        ))}
      </div>
    </section>
  )
}
