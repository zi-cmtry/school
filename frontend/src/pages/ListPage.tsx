import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { apiBaseUrl } from "../api/config"
import { explainApiError } from "../api/messages"
import { kindListQuery, listOpportunities, listRequestPath } from "../api/opportunities"
import { OpportunityCard } from "../components/OpportunityCard"
import { ApiError, isStatus, type Opportunity, type OpportunityKind, type PlaceScope } from "../domain/opportunity"
import { hideOpportunity, omitHidden, readHidden, type HiddenOpportunity } from "../hidden"
import { KIND_PAGE_TITLE } from "../lists"
import { PROFILE_CHANGE_EVENT, savedMajor } from "../profile"

const LEDE: Record<OpportunityKind, string> = {
  internship:
    "只请求实习。地点默认是成都，对应不带 region 的列表，省外岗位不会出现。切换到省内时请求 region=sichuan，同样不出现省外岗位，绵阳、宜宾等其他四川城市仍在。含成都的多地岗位两种视图都保留。已填专业时，对口的排在前面，其余仍显示，不另开栏目，也不改标题。",
  campus_recruit:
    "只请求校招。地点默认是成都，对应不带 region 的列表，省外岗位不会出现。切换到省内时请求 region=sichuan，同样不出现省外岗位，绵阳、宜宾等其他四川城市仍在。含成都的多地岗位两种视图都保留。已填专业时，对口的排在前面，其余仍显示，不另开栏目，也不改标题。",
  competition:
    "只请求竞赛，不按工作地筛选，没写工作地的也保留。已填专业时，对口的排在前面，其余仍显示，不另开栏目，也不改标题。白名单站点包括教务处、管理科学学院、材料与化学化工学院，以及四川省高校学科竞赛平台（scgxxkjs.moocollege.com 与 cp.moocollege.com）。",
}

function readableRequest(path: string): string {
  const split = path.indexOf("?")
  if (split < 0) return path
  const params = new URLSearchParams(path.slice(split + 1))
  const text = [...params.entries()].map(([key, value]) => `${key}=${value}`).join("&")
  return `${path.slice(0, split)}?${text}`
}

function useSavedMajor(): string {
  const [major, setMajor] = useState(() => savedMajor())
  useEffect(() => {
    const sync = () => setMajor(savedMajor())
    window.addEventListener(PROFILE_CHANGE_EVENT, sync)
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener(PROFILE_CHANGE_EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [])
  return major
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
  const major = useSavedMajor()
  const place: PlaceScope = params.get("place") === "sichuan" ? "sichuan" : "chengdu"
  const query = kindListQuery(kind, status, { major, place: kind === "competition" ? null : place })
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
    // requestPath 已包含 kind、status、major、region，避免 query 对象每次渲染都触发请求。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestPath])

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
        {kind === "competition" ? null : (
          <div className="filters" role="group" aria-label="地点">
            <button
              type="button"
              className="chip"
              aria-pressed={place === "chengdu"}
              onClick={() =>
                patch((next) => {
                  next.delete("place")
                })
              }
            >
              成都
            </button>
            <button
              type="button"
              className="chip"
              aria-pressed={place === "sichuan"}
              onClick={() =>
                patch((next) => {
                  next.set("place", "sichuan")
                })
              }
            >
              省内
            </button>
          </div>
        )}
        <div className="filters" role="group" aria-label="状态">
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
        {major ? (
          <p className="tier-preview">已保存专业「{major}」。对口的排在前面，其余仍显示，不另开栏目，也不改标题。</p>
        ) : (
          <p className="tier-preview">未保存专业，这次请求不带 major。</p>
        )}
        {hiddenHere > 0 ? <p className="tier-preview">有 {hiddenHere} 条已标为不感兴趣，可在设置里解除。</p> : null}
        <p className="request">本次请求 GET {readableRequest(requestPath)}</p>
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
