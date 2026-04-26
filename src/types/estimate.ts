export type AgeRange =
  | '18-24'
  | '25-34'
  | '35-44'
  | '45-54'
  | '55-64'
  | '65+'

export type DrivingHistory = 'clean' | 'ticket' | 'claim' | 'multiple'
export type CoverageLevel = 'state-minimum' | 'standard' | 'full'
export type AnnualMileage = 'low' | 'average' | 'high'
export type CreditTier = 'excellent' | 'good' | 'fair' | 'poor'

export interface EstimateRequest {
  location: string
  lat?: number
  lng?: number
  vehicleYear: number
  vehicleMake: string
  vehicleModel: string
  vehicleTrim?: string
  ageRange: AgeRange
  gender?: string
  drivingHistory: DrivingHistory
  coverageLevel: CoverageLevel
  annualMileage: AnnualMileage
  creditTier: CreditTier
}

export interface RiskFactor {
  label: string
  score: number
  reason: string
  source: string
}

export interface AIInsights {
  summary: string
  vehicleInsight: string
  locationInsight: string
  tips: string[]
  factors: string[]
  llmEstimate?: number
  llmConfidence?: number
}

export interface EstimateResponse {
  lowMonthly: number
  likelyMonthly: number
  highMonthly: number
  yearlyRange: [number, number]
  confidence: number
  confidenceReason: string
  riskScore: number
  vehicleValueEstimate: number
  vehicleValueSource?: string
  riskFactors: RiskFactor[]
  context: {
    areaSummary: string
    historicalTrend: string
    comparisonInsight: string
  }
  charts: {
    estimateTrend: { month: string; low: number; likely: number; high: number }[]
    areaComparison: { segment: string; value: number }[]
    ageComparison: { age: string; estimate: number }[]
  }
  sources: { name: string; category: string; url: string; note: string }[]
  generatedAt: string
  isEstimate: true
  aiInsights?: AIInsights
  stateDetected?: string
}
