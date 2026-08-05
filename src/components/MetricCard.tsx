type MetricCardProps = {
  label: string
  value: string
  tone?: 'navy' | 'blue' | 'mint'
}

export default function MetricCard({ label, value, tone = 'navy' }: MetricCardProps) {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  )
}
