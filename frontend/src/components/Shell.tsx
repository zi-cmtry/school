import { NavLink, Outlet } from "react-router-dom"
import { OnboardingDialog } from "./OnboardingDialog"

const PRIMARY = [
  { to: "/internships", label: "实习" },
  { to: "/campus", label: "校招" },
  { to: "/competitions", label: "竞赛" },
]

const SECONDARY = [
  { to: "/subscriptions", label: "订阅" },
  { to: "/settings", label: "设置" },
]

export function Shell() {
  return (
    <div className="app">
      <div className="shell">
        <header className="masthead">
          <div className="seal" aria-hidden="true">
            成理
            <br />
            可信
          </div>
          <div>
            <p className="kicker">成都理工大学</p>
            <h1>校园可信信息聚合助手</h1>
            <p>实习、校招、竞赛分开看。来源没写的事实不补。</p>
          </div>
        </header>
        <nav className="kind-nav" aria-label="信息类型">
          {PRIMARY.map((item) => (
            <NavLink key={item.to} to={item.to}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <Outlet />
      </div>
      <nav className="bottom-nav" aria-label="其他">
        {SECONDARY.map((item) => (
          <NavLink key={item.to} to={item.to}>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <OnboardingDialog />
    </div>
  )
}
