import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { Shell } from "./components/Shell"
import { DetailPage } from "./pages/DetailPage"
import { ListPage } from "./pages/ListPage"
import { SettingsPage } from "./pages/SettingsPage"
import { SubmitPage } from "./pages/SubmitPage"
import { SubscriptionsPage } from "./pages/SubscriptionsPage"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route path="/" element={<ListPage stream="jobs" />} />
          <Route path="/competitions" element={<ListPage stream="competitions" />} />
          <Route path="/opportunities/:id" element={<DetailPage />} />
          <Route path="/submit" element={<SubmitPage />} />
          <Route path="/subscriptions" element={<SubscriptionsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
