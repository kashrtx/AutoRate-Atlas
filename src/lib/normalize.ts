import type { DrivingHistory } from '../types/estimate'

export const normalizeDrivingHistory = (history: DrivingHistory) => {
  switch (history) {
    case 'clean':
      return 0.9
    case 'ticket':
      return 1.08
    case 'claim':
      return 1.2
    case 'multiple':
      return 1.35
    default:
      return 1
  }
}

export const normalizeAgeRange = (ageRange: string) => {
  const values: Record<string, number> = {
    '18-24': 1.35,
    '25-34': 1.12,
    '35-44': 1,
    '45-54': 0.94,
    '55-64': 0.92,
    '65+': 1.02,
  }

  return values[ageRange] ?? 1
}
