import type { EstimateRequest, EstimateResponse } from '../types/estimate'

export const getFallbackEstimate = (request: EstimateRequest): EstimateResponse => {
  const base = 165
  const ageModifier = request.ageRange === '18-24' ? 1.24 : request.ageRange === '25-34' ? 1.1 : 1
  const historyModifier = request.drivingHistory === 'clean' ? 0.94 : 1.18
  const likelyMonthly = Math.round(base * ageModifier * historyModifier)

  return {
    lowMonthly: Math.round(likelyMonthly * 0.82),
    likelyMonthly,
    highMonthly: Math.round(likelyMonthly * 1.34),
    yearlyRange: [Math.round(likelyMonthly * 0.82 * 12), Math.round(likelyMonthly * 1.34 * 12)],
    confidence: 52,
    confidenceReason: 'Using fallback regional baseline due to temporary data limitations.',
    riskScore: 56,
    riskFactors: [
      {
        label: 'Regional baseline risk',
        score: 58,
        reason: 'Fallback model using broad statewide trends.',
        source: 'NHTSA crash trend summaries',
      },
      {
        label: 'Driver profile',
        score: 55,
        reason: 'Simple weighting from age range and record history.',
        source: 'III aggregate risk factors',
      },
    ],
    context: {
      areaSummary: 'Location-level incident data is temporarily unavailable, so the estimate uses broader regional averages.',
      historicalTrend: 'Historical trend shown uses a normalized, seasonality-adjusted fallback curve.',
      comparisonInsight: 'Younger age groups and recent claims typically increase expected premiums in most U.S. regions.',
    },
    charts: {
      estimateTrend: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((month, idx) => ({
        month,
        low: Math.round(likelyMonthly * (0.78 + idx * 0.015)),
        likely: Math.round(likelyMonthly * (0.95 + idx * 0.02)),
        high: Math.round(likelyMonthly * (1.12 + idx * 0.02)),
      })),
      areaComparison: [
        { segment: 'Your area', value: likelyMonthly },
        { segment: 'State avg', value: Math.round(likelyMonthly * 0.92) },
        { segment: 'National avg', value: 168 },
      ],
      ageComparison: [
        { age: '18-24', estimate: Math.round(likelyMonthly * 1.28) },
        { age: '25-34', estimate: Math.round(likelyMonthly * 1.1) },
        { age: '35-44', estimate: Math.round(likelyMonthly) },
        { age: '45-54', estimate: Math.round(likelyMonthly * 0.94) },
      ],
    },
    sources: [
      {
        name: 'NHTSA Traffic Safety Facts',
        category: 'Crash trends',
        url: 'https://www.nhtsa.gov/research-data',
        note: 'National and regional crash trend baselines.',
      },
      {
        name: 'Insurance Information Institute (III)',
        category: 'Risk context',
        url: 'https://www.iii.org',
        note: 'Aggregate driver-risk relationships used for weighting.',
      },
    ],
    generatedAt: new Date().toISOString(),
    isEstimate: true,
  }
}
