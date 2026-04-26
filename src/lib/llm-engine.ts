import { CreateMLCEngine, type MLCEngine } from '@mlc-ai/web-llm'

const MODEL_ID = 'Llama-3.2-1B-Instruct-q4f16_1-MLC'

let engineInstance: MLCEngine | null = null
let engineReady = false
let loadingPromise: Promise<MLCEngine | null> | null = null

export type LoadProgress = { progress: number; text: string }

export const isWebGPUAvailable = (): boolean => {
  return typeof navigator !== 'undefined' && 'gpu' in navigator
}

export const getEngine = async (
  onProgress?: (p: LoadProgress) => void,
): Promise<MLCEngine | null> => {
  if (engineReady && engineInstance) return engineInstance
  if (loadingPromise) return loadingPromise

  if (!isWebGPUAvailable()) {
    console.warn('WebGPU not available — LLM features disabled')
    return null
  }

  loadingPromise = (async () => {
    try {
      engineInstance = await CreateMLCEngine(MODEL_ID, {
        initProgressCallback: (report: { progress: number; text: string }) => {
          onProgress?.({
            progress: report.progress,
            text: report.text,
          })
        },
      })
      engineReady = true
      return engineInstance
    } catch (err) {
      console.error('Failed to load WebLLM engine:', err)
      engineInstance = null
      engineReady = false
      return null
    } finally {
      loadingPromise = null
    }
  })()

  return loadingPromise
}

export const isLLMReady = () => engineReady

export interface VehicleValuation {
  msrp: number
  currentValue: number
  insuranceGroup: number
  bodyType: string
  isLuxury: boolean
  isPerformance: boolean
  repairCostTier: string
  theftRisk: string
}

export interface InsuranceAnalysis {
  estimatedMonthly: number
  confidence: number
  factors: string[]
  tips: string[]
  summary: string
  vehicleInsight: string
  locationInsight: string
}

export const queryVehicleValuation = async (
  year: number,
  make: string,
  model: string,
  trim?: string,
): Promise<VehicleValuation | null> => {
  const engine = engineInstance
  if (!engine) return null

  const vehicleStr = `${year} ${make} ${model}${trim ? ` ${trim}` : ''}`

  try {
    const response = await engine.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are an automotive valuation expert. Return ONLY a JSON object with these exact fields. No markdown, no explanation, just the JSON object.

Fields:
- msrp: number (original MSRP in USD when new, be accurate based on real world pricing)
- currentValue: number (estimated current market value in USD considering the year/age)
- insuranceGroup: number (1-50 scale, 1=cheapest to insure, 50=most expensive. Economy cars like Civic=5-10, mid-range like Camry=10-15, luxury like BMW 3-series=25-30, sports cars like Corvette=35-40, supercars like Ferrari=45-50)
- bodyType: string (sedan, suv, truck, coupe, convertible, hatchback, van, wagon)
- isLuxury: boolean
- isPerformance: boolean  
- repairCostTier: string (low, medium, high, very-high)
- theftRisk: string (low, moderate, high, very-high)`,
        },
        {
          role: 'user',
          content: `Provide accurate valuation data for: ${vehicleStr}. Return JSON only.`,
        },
      ],
      temperature: 0.1,
      max_tokens: 300,
    })

    const content = response.choices[0]?.message?.content
    const parsed = safeParseJsonContent<VehicleValuation>(content)
    if (!parsed) return null
    if (!parsed.msrp || typeof parsed.msrp !== 'number') return null
    return parsed
  } catch (err) {
    console.error('LLM vehicle query failed:', err)
    return null
  }
}

export const queryInsuranceAnalysis = async (params: {
  vehicle: string
  location: string
  state: string
  age: string
  drivingHistory: string
  coverage: string
  mileage: string
  credit: string
  gender?: string
  vehicleValue: number
  weatherScore: number
  roadScore: number
  stateBaseline: number
}): Promise<InsuranceAnalysis | null> => {
  const engine = engineInstance
  if (!engine) return null

  try {
    const response = await engine.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are an insurance actuary AI. Analyze the driver profile and provide insurance insights. Return ONLY a JSON object with these fields:
- estimatedMonthly: number (your estimated monthly premium in USD, be realistic based on real US insurance market data)
- confidence: number (0-100, your confidence level)
- factors: string[] (top 4-5 risk factors affecting this premium, be specific)
- tips: string[] (3-4 actionable tips to lower their premium)
- summary: string (2-3 sentence plain English summary of the estimate)
- vehicleInsight: string (1-2 sentences about how this specific vehicle affects their rate)
- locationInsight: string (1-2 sentences about how their location affects their rate)`,
        },
        {
          role: 'user',
          content: `Analyze this insurance profile and return JSON:
Vehicle: ${params.vehicle} (value: $${params.vehicleValue.toLocaleString()})
Location: ${params.location}, ${params.state}
State baseline: $${params.stateBaseline}/mo for full coverage
Driver age range: ${params.age}
Driving history: ${params.drivingHistory}
Coverage level: ${params.coverage}
Annual mileage: ${params.mileage}
Credit tier: ${params.credit}
Gender: ${params.gender || 'not specified'}
Weather severity score: ${params.weatherScore}/100
Road complexity score: ${params.roadScore}/100`,
        },
      ],
      temperature: 0.2,
      max_tokens: 500,
    })

    const content = response.choices[0]?.message?.content
    return safeParseJsonContent<InsuranceAnalysis>(content)
  } catch (err) {
    console.error('LLM insurance analysis failed:', err)
    return null
  }
}

const safeParseJsonContent = <T>(content: unknown): T | null => {
  if (typeof content !== 'string' || !content.trim()) return null

  const trimmed = content.trim()
  const jsonBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  const candidate = jsonBlockMatch?.[1]?.trim() || trimmed

  try {
    return JSON.parse(candidate) as T
  } catch {
    const objectStart = candidate.indexOf('{')
    const objectEnd = candidate.lastIndexOf('}')
    if (objectStart < 0 || objectEnd <= objectStart) return null

    const extracted = candidate.slice(objectStart, objectEnd + 1)
    try {
      return JSON.parse(extracted) as T
    } catch {
      return null
    }
  }
}
