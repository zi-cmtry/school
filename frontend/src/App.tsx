import { BrowserRouter, Navigate, Route, Routes, useSearchParams } from "react-router-dom"
import { Shell } from "./components/Shell"
import { isKind, isStatus } from "./domain/opportunity"
import { KIND_PATH } from "./lists"
import { DetailPage } from "./pages/DetailPage"
import { ListPage } from "./pages/ListPage"
import { SettingsPage } from "./pages/SettingsPage"
import { SubmitPage } from "./pages/SubmitPage"
import { SubscriptionsPage } from "./pages/SubscriptionsPage"

function LegacyHome() {
  const [params] = useSearchParams()
  const kindParam = params.get("kind")
  const kind = kindParam && isKind(kindParam) ? kindParam : "internship"
  const next = new URLSearchParams()
  const status = params.get("status")
  const created = params.get("created")
  if (status && isStatus(status)) next.set("status", status)
  if (created) next.set("created", created)
  const search = next.toString()
  return <Navigate to={`${KIND_PATH[kind]}${search ? `?${search}` : ""}`} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route path="/" element={<LegacyHome />} />
          <Route path="/internships" element={<ListPage kind="internship" />} />
          <Route path="/campus" element={<ListPage kind="campus_recruit" />} />
          <Route path="/competitions" element={<ListPage kind="competition" />} />
          <Route path="/opportunities/:id" element={<DetailPage />} />
          <Route path="/submit" element={<SubmitPage />} />
          <Route path="/subscriptions" element={<SubscriptionsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/internships" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
