interface GeocodeResult {
  displayName: string
  lat: number
  lng: number
}

const CACHE_PREFIX = 'atlas_geocode_'
const SUGGEST_PREFIX = 'atlas_geocode_suggest_'

export const geocodeLocation = async (query: string): Promise<GeocodeResult | null> => {
  if (!query.trim()) return null
  const key = `${CACHE_PREFIX}${query.toLowerCase().trim()}`
  const cached = localStorage.getItem(key)
  if (cached) return JSON.parse(cached) as GeocodeResult

  const endpoint = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q=${encodeURIComponent(query)}`
  const response = await fetch(endpoint, {
    headers: {
      'Accept-Language': 'en-US',
    },
  })

  if (!response.ok) return null
  const data = (await response.json()) as Array<{ display_name: string; lat: string; lon: string }>
  if (!data.length) return null

  const result = {
    displayName: data[0].display_name,
    lat: Number(data[0].lat),
    lng: Number(data[0].lon),
  }
  localStorage.setItem(key, JSON.stringify(result))
  return result
}

export const suggestLocations = async (query: string) => {
  if (query.trim().length < 3) return []
  const key = `${SUGGEST_PREFIX}${query.toLowerCase().trim()}`
  const cached = localStorage.getItem(key)
  if (cached) return JSON.parse(cached) as GeocodeResult[]

  const endpoint = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&q=${encodeURIComponent(query)}`
  const response = await fetch(endpoint, {
    headers: {
      'Accept-Language': 'en-US',
    },
  })

  if (!response.ok) return []
  const data = (await response.json()) as Array<{ display_name: string; lat: string; lon: string }>
  const options = data.map((item) => ({
    displayName: item.display_name,
    lat: Number(item.lat),
    lng: Number(item.lon),
  }))

  localStorage.setItem(key, JSON.stringify(options))
  return options
}
