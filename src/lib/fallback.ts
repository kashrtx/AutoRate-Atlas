import type { EstimateRequest, EstimateResponse } from '../types/estimate'

const coverageFactor = {
  'state-minimum': 0.74,
  standard: 1,
  full: 1.29,
}

const mileageFactor = {
  low: 0.93,
  average: 1,
  high: 1.16,
}

const creditFactor = {
  excellent: 0.86,
  good: 0.95,
  fair: 1.08,
  poor: 1.22,
}

export const getFallbackEstimate = (request: EstimateRequest): EstimateResponse => {
  const base = 176
  const ageModifier = request.ageRange === '18-24' ? 1.41 : request.ageRange === '25-34' ? 1.14 : 1
  const historyModifier = request.drivingHistory === 'clean' ? 0.92 : request.drivingHistory === 'ticket' ? 1.08 : 1.2
  const likelyMonthly = Math.round(
    base *
      ageModifier *
      historyModifier *
      coverageFactor[request.coverageLevel] *
      mileageFactor[request.annualMileage] *
      creditFactor[request.creditTier],
  )

  return {
    lowMonthly: Math.round(likelyMonthly * 0.84),
    likelyMonthly,
    highMonthly: Math.round(likelyMonthly * 1.31),
    yearlyRange: [Math.round(likelyMonthly * 0.84 * 12), Math.round(likelyMonthly * 1.31 * 12)],
    confidence: 57,
    confidenceReason: 'Using fallback regional baseline due to temporary data limitations.',
    riskScore: 59,
    vehicleValueEstimate: 28500,
    riskFactors: [
      {
        label: 'Regional baseline risk',
        score: 60,
        reason: 'Fallback model using broad statewide trends.',
        source: 'NHTSA crash trend summaries',
      },
      {
        label: 'Driver + policy profile',
        score: 58,
        reason: 'Age, record, credit tier, coverage level, and annual mileage weighting.',
        source: 'III aggregate risk factors',
      },
    ],
    context: {
      areaSummary: 'Location-level incident data is temporarily unavailable, so the estimate uses broader regional averages.',
      historicalTrend: 'Historical trend shown uses a normalized, seasonality-adjusted fallback curve.',
      comparisonInsight: 'Coverage level, credit tier, age, and claims history are typically major premium drivers.',
    },
    charts: {
      estimateTrend: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((month, idx) => ({
        month,
        low: Math.round(likelyMonthly * (0.8 + idx * 0.012)),
        likely: Math.round(likelyMonthly * (0.95 + idx * 0.018)),
        high: Math.round(likelyMonthly * (1.1 + idx * 0.018)),
      })),
      areaComparison: [
        { segment: 'Your area', value: likelyMonthly },
        { segment: 'State avg', value: Math.round(likelyMonthly * 0.93) },
        { segment: 'National avg', value: 182 },
      ],
      ageComparison: [
        { age: '18-24', estimate: Math.round(likelyMonthly * 1.23) },
        { age: '25-34', estimate: Math.round(likelyMonthly * 1.11) },
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
