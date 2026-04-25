import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

interface TrendPoint {
  month: string
  low: number
  likely: number
  high: number
}

export function EstimateTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <AreaChart data={data}>
          <XAxis dataKey="month" stroke="rgba(255,255,255,0.55)" />
          <YAxis stroke="rgba(255,255,255,0.55)" />
          <Tooltip />
          <Area type="monotone" dataKey="high" stackId="1" stroke="#a78bfa" fill="rgba(167,139,250,0.25)" />
          <Area type="monotone" dataKey="likely" stackId="2" stroke="#38bdf8" fill="rgba(56,189,248,0.35)" />
          <Area type="monotone" dataKey="low" stackId="3" stroke="#2dd4bf" fill="rgba(45,212,191,0.35)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
