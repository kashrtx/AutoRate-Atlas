import { clamp } from './utils'

export interface ScoringSignal {
  weight: number
  value: number
}

export const weightedScore = (signals: ScoringSignal[]) => {
  const totalWeight = signals.reduce((sum, signal) => sum + signal.weight, 0)
  if (!totalWeight) return 50

  const raw = signals.reduce((sum, signal) => sum + signal.value * signal.weight, 0) / totalWeight
  return Math.round(clamp(raw, 0, 100))
}

export const estimateBandFromScore = (riskScore: number, baseline = 170) => {
  const multiplier = 0.65 + riskScore / 100
  const likely = Math.round(baseline * multiplier)
  return {
    low: Math.round(likely * 0.82),
    likely,
    high: Math.round(likely * 1.26),
  }
}
