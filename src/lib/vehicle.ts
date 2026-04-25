interface Suggestion {
  id: string
  name: string
}

const MAKE_CACHE = 'atlas_vehicle_makes'

export const getVehicleMakes = async (): Promise<Suggestion[]> => {
  const cached = localStorage.getItem(MAKE_CACHE)
  if (cached) return JSON.parse(cached) as Suggestion[]

  const response = await fetch('https://vpic.nhtsa.dot.gov/api/vehicles/getallmakes?format=json')
  if (!response.ok) return []
  const data = (await response.json()) as {
    Results: Array<{ Make_ID: number; Make_Name: string }>
  }

  const makes = data.Results.slice(0, 1500).map((make) => ({
    id: String(make.Make_ID),
    name: make.Make_Name,
  }))

  localStorage.setItem(MAKE_CACHE, JSON.stringify(makes))
  return makes
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

  const models = data.Results.slice(0, 100).map((model) => ({
    id: String(model.Model_ID),
    name: model.Model_Name,
  }))

  localStorage.setItem(key, JSON.stringify(models))
  return models
}
