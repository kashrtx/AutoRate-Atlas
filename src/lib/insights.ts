import type { EstimateRequest, EstimateResponse, AIInsights } from '../types/estimate'

const mileageTips: Record<EstimateRequest['annualMileage'], string> = {
  low: 'Ask carriers about low-mileage programs and usage-based insurance discounts.',
  average: 'Bundle auto with renters/home policies to offset standard-mileage pricing.',
  high: 'Consider telematics plans to prove safe driving habits even with high annual mileage.',
}

const historyTips: Record<EstimateRequest['drivingHistory'], string> = {
  clean: 'Maintain your clean record and request claims-free / safe-driver discounts every renewal.',
  ticket: 'Complete an approved defensive driving course to soften violation-related surcharges.',
  claim: 'Raise your deductible only if your emergency fund can cover it to reduce monthly premium cost.',
  multiple: 'Shop at least 3 carriers now; multi-incident pricing differences can be very large.',
}

export const buildHeuristicInsights = (request: EstimateRequest, result: EstimateResponse): AIInsights => {
  const topFactors = [...result.riskFactors].sort((a, b) => b.score - a.score).slice(0, 3)
  const topFactorLabels = topFactors.map((factor) => factor.label)
  const topFactorSummary = topFactors.map((factor) => `${factor.label} (${factor.score}/100)`).join(', ')

  const vehicleInsight =
    result.vehicleValueEstimate >= 55000
      ? `Your vehicle's estimated value (${formatMoney(result.vehicleValueEstimate)}) is above average, which increases collision and comprehensive payout exposure.`
      : `Your vehicle's estimated value (${formatMoney(result.vehicleValueEstimate)}) is moderate, helping keep physical damage coverage costs more controlled.`

  const locationInsight = `Regional signals in ${request.location} create premium pressure from ${topFactorLabels.join(', ').toLowerCase()}.`

  return {
    summary: `Your projected premium centers around ${formatMoney(result.likelyMonthly)}/month with ${result.confidence}% confidence. The strongest pricing drivers are ${topFactorSummary}.`,
    vehicleInsight,
    locationInsight,
    tips: [historyTips[request.drivingHistory], mileageTips[request.annualMileage], 'Re-quote limits and deductibles before renewal to avoid paying for unused coverage headroom.'],
    factors: topFactorLabels,
  }
}

const formatMoney = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount)
}
