import { NavLink, Outlet } from "react-router-dom"

const NAV = [
  { to: "/", label: "求职", end: true },
  { to: "/competitions", label: "竞赛", end: false },
  { to: "/submit", label: "录入", end: false },
  { to: "/subscriptions", label: "订阅", end: false },
  { to: "/settings", label: "我的", end: false },
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
            <p>求职看就业网，竞赛看白名单渠道。来源没写的事实不补。</p>
          </div>
        </header>
        <Outlet />
      </div>
      <nav className="bottom-nav" aria-label="主导航">
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
