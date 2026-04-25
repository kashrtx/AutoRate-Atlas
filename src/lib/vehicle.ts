interface Suggestion {
  id: string
  name: string
}

const MAKE_CACHE = 'atlas_vehicle_makes_v2'

const normalizeMakeName = (name: string) => name.replace(/\s+/g, ' ').trim()

const isConsumerMake = (name: string) => {
  if (name.length < 2 || name.length > 24) return false
  if (/[,/]/.test(name)) return false
  const blocked = ['TRAILER', 'IRONWORKS', 'COACH', 'MANUFACTURING', 'INDUSTRIES', 'BOAT']
  return !blocked.some((word) => name.toUpperCase().includes(word))
}

const fetchMakesForType = async (type: string) => {
  const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/GetMakesForVehicleType/${encodeURIComponent(type)}?format=json`)
  if (!response.ok) return [] as Suggestion[]

  const data = (await response.json()) as {
    Results: Array<{ MakeId: number; MakeName: string }>
  }

  return data.Results.map((make) => ({
    id: String(make.MakeId),
    name: normalizeMakeName(make.MakeName),
  }))
}

export const getVehicleMakes = async (): Promise<Suggestion[]> => {
  const cached = localStorage.getItem(MAKE_CACHE)
  if (cached) return JSON.parse(cached) as Suggestion[]

  const [cars, mpv, trucks] = await Promise.all([
    fetchMakesForType('car'),
    fetchMakesForType('multipurpose passenger vehicle (mpv)'),
    fetchMakesForType('truck'),
  ])

  const merged = [...cars, ...mpv, ...trucks]
  const unique = Array.from(new Map(merged.map((item) => [item.name.toUpperCase(), item])).values())
    .filter((item) => isConsumerMake(item.name))
    .sort((a, b) => a.name.localeCompare(b.name))

  localStorage.setItem(MAKE_CACHE, JSON.stringify(unique))
  return unique
}

export const getModelsForMakeYear = async (make: string, year: number): Promise<Suggestion[]> => {
  if (!make.trim()) return []
  const key = `atlas_vehicle_models_${make.toLowerCase()}_${year}`
  const cached = localStorage.getItem(key)
  if (cached) return JSON.parse(cached) as Suggestion[]

  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelyear/${year}?format=json`
  const response = await fetch(url)
  if (!response.ok) return []

  const data = (await response.json()) as {
    Results: Array<{ Model_ID: number; Model_Name: string }>
  }

  const models = data.Results.map((model) => ({
    id: String(model.Model_ID),
    name: model.Model_Name.trim(),
  }))

  const deduped = Array.from(new Map(models.map((model) => [model.name.toLowerCase(), model])).values())
  localStorage.setItem(key, JSON.stringify(deduped))
  return deduped
}
