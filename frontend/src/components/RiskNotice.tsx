import { riskFlagLabels } from "../domain/risk"

/** 有标志才出现。不拦截点击，不改状态。 */
export function RiskNotice({ flags }: { flags: unknown }) {
  const labels = riskFlagLabels(flags)
  if (labels.length === 0) return null
  return (
    <aside className="risk-notice" aria-label="疑似欺骗">
      <p className="risk-kicker">疑似欺骗</p>
      <ul>
        {labels.map((label) => (
          <li key={label}>{label}</li>
        ))}
      </ul>
      <p className="risk-foot">只做提示，不会隐藏，来源仍可打开。</p>
    </aside>
  )
}
