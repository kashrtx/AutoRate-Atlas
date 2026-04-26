import { CreateMLCEngine, type MLCEngine } from '@mlc-ai/web-llm'

const MODEL_ID = 'Phi-4-mini-instruct-q4f16_1-MLC'

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

/**
 * Clear the cached AI model from browser storage (Cache API + IndexedDB).
 * After clearing, the page should be reloaded so the model can be re-downloaded on next use.
 */
export const clearModelCache = async (): Promise<void> => {
  // Reset in-memory engine state
  engineInstance = null
  engineReady = false
  loadingPromise = null

  // Clear Cache API entries (WebLLM default storage)
  if ('caches' in window) {
    const cacheNames = await caches.keys()
    for (const name of cacheNames) {
      await caches.delete(name)
    }
  }

  // Clear IndexedDB databases used by WebLLM
  if ('indexedDB' in window) {
    const dbs = await indexedDB.databases()
    for (const db of dbs) {
      if (db.name) indexedDB.deleteDatabase(db.name)
    }
  }
}

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
          content: `You are an automotive valuation expert with encyclopedic knowledge of car pricing. Return ONLY a valid JSON object — no markdown, no explanation, no extra text.

CRITICAL PRICING RULES — you MUST follow these:
• Supercars and hypercars (Bugatti, Pagani, Koenigsegg, etc.) have MSRPs in the MILLIONS of dollars. A Bugatti Chiron is ~$3,000,000. A Pagani Huayra is ~$2,500,000. Never price these under $1,000,000.
• Exotic sports cars (Ferrari, Lamborghini, McLaren, Aston Martin) typically range from $200,000 to $400,000+. A Lamborghini Huracán is ~$250,000. A Ferrari 296 GTB is ~$330,000.
• Premium luxury (Bentley, Rolls-Royce, Maybach) range from $200,000 to $500,000+. A Rolls-Royce Ghost is ~$350,000.
• Luxury performance (BMW, Mercedes-Benz, Audi, Porsche, Lexus) range from $40,000 to $120,000+. A BMW M3 is ~$75,000. A Porsche 911 is ~$115,000+.
• Mainstream vehicles (Toyota, Honda, Ford, Hyundai, etc.) range from $25,000 to $50,000. A Toyota Camry is ~$30,000. A Honda Civic is ~$28,000.
• Budget/economy vehicles (Nissan Versa, Mitsubishi Mirage, Kia Rio) are under $25,000.

If you are unsure of the exact value for a specific model or trim, estimate conservatively within the correct price bracket for that brand. NEVER return an unrealistically low value for a luxury or exotic brand.

The currentValue should reflect depreciation based on the vehicle's age — newer vehicles hold more value, older ones depreciate. A 5-year-old car is typically worth 50-60% of MSRP, a 10-year-old car 25-35%.

Fields to return:
- msrp: number (original MSRP in USD when new — MUST be realistic for the brand)
- currentValue: number (estimated current market value considering year/age)
- insuranceGroup: number (1-50 scale. Economy=5-10, midrange=12-18, luxury=25-35, sports=35-42, supercars/exotics=43-50)
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
      max_tokens: 400,
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
          content: `You are an insurance actuary AI with deep knowledge of US auto insurance markets. Analyze the driver profile and provide insurance insights. Return ONLY a valid JSON object — no markdown, no extra text.

IMPORTANT PRICING CONTEXT:
• The US national average for full-coverage auto insurance is approximately $172/month (~$2,064/year).
• Vehicles worth over $100,000 commonly cost $300-$600+/month to insure.
• Supercars and exotics (Ferrari, Lamborghini, Bugatti, McLaren) commonly cost $800-$3,000+/month to insure.
• Young drivers (18-24) pay 50-70% more than average.
• Drivers with poor credit pay 30-50% more.
• Drivers with multiple violations pay 40-60% more.
• Use the provided vehicle value and state baseline as anchors for your estimate.

Fields:
- estimatedMonthly: number (your estimated monthly premium in USD — be realistic)
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
