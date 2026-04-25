import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export function RiskBreakdownChart({ data }: { data: { label: string; score: number }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={data}>
          <XAxis dataKey="label" stroke="rgba(255,255,255,0.55)" />
          <YAxis stroke="rgba(255,255,255,0.55)" domain={[0, 100]} />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.08)' }}
            contentStyle={{
              backgroundColor: 'rgba(8, 12, 24, 0.96)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '12px',
              color: '#f8fafc',
            }}
            itemStyle={{ color: '#7dd3fc' }}
            labelStyle={{ color: '#e2e8f0' }}
          />
          <Bar dataKey="score" fill="rgba(56,189,248,0.85)" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
