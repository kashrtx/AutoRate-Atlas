import type { EstimateRequest, EstimateResponse } from '../types/estimate'
import { lookupVehicleValue, vehicleValueFactor } from './vehicle-values'



const AGE: Record<string, number> = { '18-24':1.72,'25-34':1.18,'35-44':1.0,'45-54':0.93,'55-64':0.90,'65+':1.05 }
const HIST: Record<string, number> = { clean:0.88,ticket:1.12,claim:1.32,multiple:1.55 }
const COV: Record<string, number> = { 'state-minimum':0.62,standard:1.0,full:1.38 }
const MILE: Record<string, number> = { low:0.90,average:1.0,high:1.18 }
const CRED: Record<string, number> = { excellent:0.82,good:0.95,fair:1.15,poor:1.35 }

export const getFallbackEstimate = (request: EstimateRequest): EstimateResponse => {
  const base = 172

  // Use brand-based vehicle value instead of hardcoded $28,500
  const vehicleVal = lookupVehicleValue(request.vehicleMake, request.vehicleYear)
  const vvFactor = vehicleValueFactor(vehicleVal.currentValue)

  const factor = (AGE[request.ageRange] ?? 1) * (HIST[request.drivingHistory] ?? 1) *
    (COV[request.coverageLevel] ?? 1) * (MILE[request.annualMileage] ?? 1) * (CRED[request.creditTier] ?? 1) * vvFactor
  const likelyMonthly = Math.round(base * factor)

  return {
    lowMonthly: Math.round(likelyMonthly * 0.78),
    likelyMonthly,
    highMonthly: Math.round(likelyMonthly * 1.32),
    yearlyRange: [Math.round(likelyMonthly * 0.78 * 12), Math.round(likelyMonthly * 1.32 * 12)],
    confidence: 48,
    confidenceReason: 'Using fallback estimator — live data feeds temporarily unavailable.',
    riskScore: Math.round(Math.min(99, factor * 40)),
    vehicleValueEstimate: vehicleVal.currentValue,
    vehicleValueSource: `Brand lookup (MSRP: $${vehicleVal.msrp.toLocaleString()})`,
    riskFactors: [
      { label: 'Driver profile', score: Math.round(Math.min(98, factor * 42)),
        reason: `Age ${request.ageRange}, ${request.drivingHistory} record, ${request.creditTier} credit.`,
        source: 'Actuarial GLM fallback' },
      { label: 'National baseline', score: 50,
        reason: 'Using national average baseline of $172/mo for full coverage.',
        source: 'Insurify 2025-2026 averages' },
    ],
    context: {
      areaSummary: 'Location-level data temporarily unavailable. Using national averages.',
      historicalTrend: 'Fallback curve uses normalized seasonality.',
      comparisonInsight: 'Coverage level, credit, age, and history are the main premium drivers.',
    },
    charts: {
      estimateTrend: ['Jan','Feb','Mar','Apr','May','Jun'].map((month, i) => ({
        month,
        low: Math.round(likelyMonthly * (0.93 + i * 0.012)),
        likely: Math.round(likelyMonthly * (0.95 + i * 0.016)),
        high: Math.round(likelyMonthly * (1.1 + i * 0.018)),
      })),
      areaComparison: [
        { segment: 'Your estimate', value: likelyMonthly },
        { segment: 'National avg', value: 172 },
      ],
      ageComparison: Object.entries(AGE).map(([age, f]) => ({
        age, estimate: Math.round(base * f * (COV[request.coverageLevel] ?? 1)),
      })),
    },
    sources: [
      { name: 'Actuarial GLM Fallback', category: 'Rating model', url: 'https://en.wikipedia.org/wiki/Generalized_linear_model', note: 'Offline multiplicative rating model.' },
      { name: 'Insurify Baselines', category: 'Premium data', url: 'https://www.insurify.com/', note: 'National average baseline.' },
    ],
    generatedAt: new Date().toISOString(),
    isEstimate: true,
  }
}
