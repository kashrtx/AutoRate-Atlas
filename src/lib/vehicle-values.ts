/**
 * Brand-based vehicle value lookup — used when AI engine is off and on the server
 * as a much better fallback than the previous $28,500 hardcode for all vehicles.
 */

/** Median MSRP by brand (USD) — curated from 2025/2026 market data */
const BRAND_MSRP: Record<string, number> = {
  // Hypercars / Supercars
  KOENIGSEGG: 2_500_000,
  BUGATTI: 3_000_000,
  PAGANI: 2_800_000,
  RIMAC: 2_100_000,

  // Exotic
  FERRARI: 300_000,
  LAMBORGHINI: 280_000,
  MCLAREN: 250_000,
  'ASTON MARTIN': 190_000,
  MASERATI: 85_000,

  // Ultra-luxury
  'ROLLS-ROYCE': 350_000,
  'ROLLS ROYCE': 350_000,
  BENTLEY: 220_000,
  MAYBACH: 200_000,

  // Premium luxury
  PORSCHE: 95_000,
  'LAND ROVER': 75_000,
  JAGUAR: 68_000,
  BMW: 55_000,
  'MERCEDES-BENZ': 58_000,
  'MERCEDES BENZ': 58_000,
  MERCEDES: 58_000,
  AUDI: 52_000,
  LEXUS: 50_000,
  INFINITI: 48_000,
  GENESIS: 48_000,
  VOLVO: 46_000,
  LINCOLN: 52_000,
  CADILLAC: 55_000,
  ACURA: 42_000,
  ALFA: 45_000,
  'ALFA ROMEO': 45_000,

  // Performance
  LOTUS: 85_000,
  CORVETTE: 70_000,

  // Mainstream premium
  TESLA: 45_000,
  RIVIAN: 75_000,
  LUCID: 78_000,
  POLESTAR: 52_000,

  // Mainstream
  TOYOTA: 34_000,
  HONDA: 32_000,
  FORD: 40_000,
  CHEVROLET: 38_000,
  GMC: 45_000,
  RAM: 45_000,
  DODGE: 40_000,
  JEEP: 40_000,
  CHRYSLER: 38_000,
  BUICK: 35_000,
  SUBARU: 33_000,
  MAZDA: 33_000,
  HYUNDAI: 31_000,
  KIA: 31_000,
  NISSAN: 30_000,
  VOLKSWAGEN: 33_000,
  VW: 33_000,

  // Budget / Economy
  MITSUBISHI: 24_000,
  FIAT: 22_000,
  MINI: 30_000,
  SUZUKI: 22_000,
  SCION: 20_000,
  SMART: 18_000,
}

const DEFAULT_MSRP = 32_000

/**
 * Apply insurance-standard Actual Cash Value (ACV) depreciation based on vehicle age.
 * Insurance uses ACV which depreciates much gentler than aggressive trade-in values.
 */
export const applyDepreciation = (msrp: number, year: number): number => {
  const currentYear = new Date().getFullYear()
  const age = Math.max(0, currentYear - year)

  if (age === 0) return msrp // Current model year holds full value
  if (age === 1) return msrp * 0.90
  if (age === 2) return msrp * 0.82
  if (age === 3) return msrp * 0.75
  if (age === 4) return msrp * 0.68
  if (age === 5) return msrp * 0.62
  if (age <= 7) return msrp * 0.50
  if (age <= 10) return msrp * 0.36
  if (age <= 15) return msrp * 0.25
  return msrp * 0.15
}

/** Exception: some brands actually appreciate or hold value much better */
const APPRECIATION_BRANDS = new Set([
  'KOENIGSEGG', 'BUGATTI', 'PAGANI', 'FERRARI', 'LAMBORGHINI',
  'ROLLS-ROYCE', 'ROLLS ROYCE', 'PORSCHE',
])

/**
 * Look up estimated vehicle value by brand + year.
 * Returns { msrp, currentValue } or null if brand unknown (falls back to default).
 */
export const lookupVehicleValue = (
  make: string,
  year: number,
): { msrp: number; currentValue: number } => {
  const normalized = make.trim().toUpperCase()
  const msrp = BRAND_MSRP[normalized] ?? DEFAULT_MSRP

  let currentValue: number
  if (APPRECIATION_BRANDS.has(normalized)) {
    // Exotics/supercars depreciate much slower (or appreciate)
    const currentYear = new Date().getFullYear()
    const age = Math.max(0, currentYear - year)
    if (age <= 2) currentValue = msrp * 0.95
    else if (age <= 5) currentValue = msrp * 0.85
    else if (age <= 10) currentValue = msrp * 0.80
    else currentValue = msrp * 0.75
  } else {
    currentValue = applyDepreciation(msrp, year)
  }

  return { msrp: Math.round(msrp), currentValue: Math.round(currentValue) }
}

/**
 * Vehicle value → insurance cost multiplier.
 * Shared between client and server so the formula is consistent.
 */
export const vehicleValueFactor = (value: number): number => {
  if (value <= 15_000) return 0.78
  if (value <= 25_000) return 0.90
  if (value <= 35_000) return 1.0
  if (value <= 50_000) return 1.15
  if (value <= 75_000) return 1.32
  if (value <= 120_000) return 1.55
  if (value <= 200_000) return 1.85
  if (value <= 500_000) return 2.20
  if (value <= 1_000_000) return 2.60
  return 3.10 // Hypercars
}
