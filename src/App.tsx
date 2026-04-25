import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, LoaderCircle, LocateFixed, MapPin, Search, ShieldCheck, TriangleAlert } from 'lucide-react'
import { Button } from './components/ui/button'
import { Card } from './components/ui/card'
import { Input } from './components/ui/input'
import { Select } from './components/ui/select'
import { EstimateTrendChart } from './components/charts/estimate-trend-chart'
import { RiskBreakdownChart } from './components/charts/risk-breakdown-chart'
import { confidenceLabel, formatCurrency } from './lib/format'
import { geocodeLocation, suggestLocations } from './lib/geocode'
import { getFallbackEstimate } from './lib/fallback'
import { getModelsForMakeYear, getVehicleMakes } from './lib/vehicle'
import type { AgeRange, DrivingHistory, EstimateRequest, EstimateResponse } from './types/estimate'

const ageRanges: AgeRange[] = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+']
const historyOptions: DrivingHistory[] = ['clean', 'ticket', 'claim', 'multiple']

function App() {
  const [request, setRequest] = useState<EstimateRequest>({
    location: '',
    vehicleYear: 2022,
    vehicleMake: '',
    vehicleModel: '',
    ageRange: '35-44',
    drivingHistory: 'clean',
  })
  const [result, setResult] = useState<EstimateResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [locationSuggestions, setLocationSuggestions] = useState<Array<{ displayName: string; lat: number; lng: number }>>([])
  const [makeSuggestions, setMakeSuggestions] = useState<Array<{ id: string; name: string }>>([])
  const [modelSuggestions, setModelSuggestions] = useState<Array<{ id: string; name: string }>>([])
  const [locationFocused, setLocationFocused] = useState(false)
  const [makeFocused, setMakeFocused] = useState(false)
  const [modelFocused, setModelFocused] = useState(false)

  const canEstimate = Boolean(request.location && request.vehicleMake && request.vehicleModel && request.vehicleYear)

  const riskData = useMemo(
    () => result?.riskFactors.map((factor) => ({ label: factor.label, score: factor.score })) ?? [],
    [result],
  )

  useEffect(() => {
    getVehicleMakes().then(setMakeSuggestions).catch(() => setMakeSuggestions([]))
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      suggestLocations(request.location)
        .then(setLocationSuggestions)
        .catch(() => setLocationSuggestions([]))
    }, 250)

    return () => clearTimeout(timer)
  }, [request.location])

  useEffect(() => {
    const timer = setTimeout(() => {
      getModelsForMakeYear(request.vehicleMake, request.vehicleYear)
        .then(setModelSuggestions)
        .catch(() => setModelSuggestions([]))
    }, 250)

    return () => clearTimeout(timer)
  }, [request.vehicleMake, request.vehicleYear])

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported in your browser.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setError(null)
        const label = `Lat ${position.coords.latitude.toFixed(3)}, Lng ${position.coords.longitude.toFixed(3)}`
        setRequest((prev) => ({
          ...prev,
          location: label,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }))
      },
      () => setError('Could not access your current location. You can enter location manually.'),
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  const runEstimate = useCallback(async () => {
    if (!canEstimate) return

    setLoading(true)
    setError(null)

    try {
      let payload = { ...request }
      if (!payload.lat || !payload.lng) {
        const geo = await geocodeLocation(payload.location)
        if (geo) {
          payload = { ...payload, location: geo.displayName, lat: geo.lat, lng: geo.lng }
          setRequest(payload)
        }
      }

      const response = await fetch('/.netlify/functions/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) throw new Error('Failed to fetch estimate')
      const data = (await response.json()) as EstimateResponse
      setResult(data)
    } catch {
      setError('Live data is temporarily unavailable. Showing robust fallback estimate.')
      setResult(getFallbackEstimate(request))
    } finally {
      setLoading(false)
    }
  }, [canEstimate, request])

  useEffect(() => {
    if (!canEstimate) return

    const timer = setTimeout(() => {
      runEstimate()
    }, 700)

    return () => clearTimeout(timer)
  }, [canEstimate, runEstimate])

  const filteredMakes = useMemo(() => {
    const query = request.vehicleMake.trim().toLowerCase()
    if (!query) return makeSuggestions.slice(0, 8)
    return makeSuggestions.filter((make) => make.name.toLowerCase().includes(query)).slice(0, 8)
  }, [makeSuggestions, request.vehicleMake])

  const filteredModels = useMemo(() => {
    const query = request.vehicleModel.trim().toLowerCase()
    if (!query) return modelSuggestions.slice(0, 8)
    return modelSuggestions.filter((model) => model.name.toLowerCase().includes(query)).slice(0, 8)
  }, [modelSuggestions, request.vehicleModel])

  return (
    <div className="min-h-screen bg-background bg-mesh px-4 pb-12 pt-6 text-foreground md:px-8">
      <div className="mx-auto grid w-full max-w-7xl gap-6">
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-3xl p-6 md:p-8"
        >
          <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/35 px-3 py-1 text-xs text-primary">
            <ShieldCheck className="h-3.5 w-3.5" /> Transparent, no-login insurance estimate tool
          </p>
          <h1 className="text-3xl font-semibold leading-tight md:text-5xl">AutoRate Atlas</h1>
          <p className="mt-3 max-w-2xl text-sm text-white/75 md:text-base">
            Live estimate updates from public data signals. This is an estimate only, not a guaranteed insurer quote.
          </p>
        </motion.header>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_1.35fr]">
          <Card className="space-y-4">
            <h2 className="text-xl font-semibold">Estimate inputs</h2>

            <div className="relative">
              <label className="mb-1 block text-sm font-medium">Location</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-white/45" />
                  <Input
                    aria-label="Location"
                    className="pl-9"
                    value={request.location}
                    onFocus={() => setLocationFocused(true)}
                    onBlur={() => setTimeout(() => setLocationFocused(false), 130)}
                    onChange={(e) => setRequest((prev) => ({ ...prev, location: e.target.value, lat: undefined, lng: undefined }))}
                    placeholder="City, ZIP, neighborhood, or address"
                  />
                </div>
                <Button onClick={detectLocation} className="px-3" aria-label="Detect location">
                  <LocateFixed className="h-4 w-4" />
                </Button>
              </div>

              {locationFocused && locationSuggestions.length > 0 && request.location.length > 2 ? (
                <div role="listbox" className="absolute z-30 mt-1 max-h-48 w-[calc(100%-3.5rem)] overflow-auto rounded-xl border border-white/15 bg-slate-950/90 p-1 backdrop-blur">
                  {locationSuggestions.map((option) => (
                    <button
                      role="option"
                      key={`${option.displayName}-${option.lat}`}
                      className="block w-full rounded-lg px-2 py-2 text-left text-sm text-white/90 hover:bg-white/10"
                      onClick={() => {
                        setRequest((prev) => ({
                          ...prev,
                          location: option.displayName,
                          lat: option.lat,
                          lng: option.lng,
                        }))
                        setLocationSuggestions([])
                        setLocationFocused(false)
                      }}
                    >
                      {option.displayName}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Vehicle year</label>
                <Input
                  type="number"
                  min={1985}
                  max={2026}
                  value={request.vehicleYear}
                  onChange={(e) => setRequest((prev) => ({ ...prev, vehicleYear: Number(e.target.value) }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Age range</label>
                <Select
                  value={request.ageRange}
                  onChange={(e) => setRequest((prev) => ({ ...prev, ageRange: e.target.value as AgeRange }))}
                >
                  {ageRanges.map((age) => (
                    <option className="bg-white text-slate-900" key={age}>
                      {age}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <label className="mb-1 block text-sm font-medium">Make</label>
                <Input
                  value={request.vehicleMake}
                  onFocus={() => setMakeFocused(true)}
                  onBlur={() => setTimeout(() => setMakeFocused(false), 130)}
                  onChange={(e) => setRequest((prev) => ({ ...prev, vehicleMake: e.target.value, vehicleModel: '' }))}
                  placeholder="Toyota"
                />
                {makeFocused && filteredMakes.length > 0 ? (
                  <div role="listbox" className="absolute z-20 mt-1 max-h-40 w-full overflow-auto rounded-xl border border-white/15 bg-slate-950/90 p-1 backdrop-blur">
                    {filteredMakes.map((make) => (
                      <button
                        role="option"
                        key={make.id}
                        className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm text-white/90 hover:bg-white/10"
                        onClick={() => {
                          setRequest((prev) => ({ ...prev, vehicleMake: make.name, vehicleModel: '' }))
                          setMakeFocused(false)
                        }}
                      >
                        {make.name}
                        {request.vehicleMake.toLowerCase() === make.name.toLowerCase() ? <Check className="h-3.5 w-3.5" /> : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="relative">
                <label className="mb-1 block text-sm font-medium">Model</label>
                <Input
                  value={request.vehicleModel}
                  onFocus={() => setModelFocused(true)}
                  onBlur={() => setTimeout(() => setModelFocused(false), 130)}
                  onChange={(e) => setRequest((prev) => ({ ...prev, vehicleModel: e.target.value }))}
                  placeholder="RAV4"
                />
                {modelFocused && filteredModels.length > 0 ? (
                  <div role="listbox" className="absolute z-20 mt-1 max-h-40 w-full overflow-auto rounded-xl border border-white/15 bg-slate-950/90 p-1 backdrop-blur">
                    {filteredModels.map((model) => (
                      <button
                        role="option"
                        key={model.id}
                        className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm text-white/90 hover:bg-white/10"
                        onClick={() => {
                          setRequest((prev) => ({ ...prev, vehicleModel: model.name }))
                          setModelFocused(false)
                        }}
                      >
                        {model.name}
                        {request.vehicleModel.toLowerCase() === model.name.toLowerCase() ? <Check className="h-3.5 w-3.5" /> : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Trim (optional)</label>
              <Input
                value={request.vehicleTrim || ''}
                onChange={(e) => setRequest((prev) => ({ ...prev, vehicleTrim: e.target.value }))}
                placeholder="XLE"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Driving history</label>
                <Select
                  value={request.drivingHistory}
                  onChange={(e) =>
                    setRequest((prev) => ({ ...prev, drivingHistory: e.target.value as DrivingHistory }))
                  }
                >
                  {historyOptions.map((opt) => (
                    <option className="bg-white text-slate-900" key={opt}>
                      {opt}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Gender (optional)</label>
                <Select
                  value={request.gender ?? ''}
                  onChange={(e) => setRequest((prev) => ({ ...prev, gender: e.target.value || undefined }))}
                >
                  <option className="bg-white text-slate-900" value="">Prefer not to say</option>
                  <option className="bg-white text-slate-900" value="female">Female</option>
                  <option className="bg-white text-slate-900" value="male">Male</option>
                  <option className="bg-white text-slate-900" value="nonbinary">Non-binary</option>
                </Select>
              </div>
            </div>

            <Button onClick={runEstimate} disabled={loading || !canEstimate}>
              {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
              Refresh estimate now
            </Button>

            <p className="text-xs text-white/70">
              Live updates run automatically after input changes. Privacy-safe: no account required.
            </p>

            {error ? (
              <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
                <TriangleAlert className="mt-0.5 h-4 w-4" />
                <span>{error}</span>
              </div>
            ) : null}
          </Card>

          <AnimatePresence mode="wait">
            {!result && !loading ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <Card className="flex min-h-[530px] flex-col items-center justify-center text-center">
                  <MapPin className="mb-3 h-10 w-10 text-primary" />
                  <h3 className="text-2xl font-semibold">Your live estimate dashboard will appear here</h3>
                  <p className="mt-2 max-w-md text-sm text-white/70">
                    Choose a real location suggestion and a real vehicle make/model from NHTSA to generate a dynamic estimate.
                  </p>
                </Card>
              </motion.div>
            ) : null}

            {loading ? (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Card className="flex min-h-[530px] items-center justify-center">
                  <LoaderCircle className="h-10 w-10 animate-spin text-primary" />
                </Card>
              </motion.div>
            ) : null}

            {result ? (
              <motion.div key="result" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                <div className="grid gap-4">
                  <Card>
                    <p className="metric-label">Estimated monthly range</p>
                    <h3 className="mt-1 text-3xl font-semibold">
                      {formatCurrency(result.lowMonthly)} — {formatCurrency(result.highMonthly)}
                    </h3>
                    <p className="mt-1 text-sm text-white/70">
                      Likely around {formatCurrency(result.likelyMonthly)}/month · yearly {formatCurrency(result.yearlyRange[0])}
                      {' - '}
                      {formatCurrency(result.yearlyRange[1])}
                    </p>
                    <p className="mt-1 text-xs text-white/60">Generated {new Date(result.generatedAt).toLocaleString()}</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-white/15 bg-black/20 p-3">
                        <p className="metric-label">Confidence</p>
                        <p className="text-lg font-semibold">{result.confidence}% · {confidenceLabel(result.confidence)}</p>
                        <p className="text-xs text-white/70">{result.confidenceReason}</p>
                      </div>
                      <div className="rounded-xl border border-white/15 bg-black/20 p-3">
                        <p className="metric-label">Risk score</p>
                        <p className="text-lg font-semibold">{result.riskScore}/100</p>
                        <p className="text-xs text-white/70">Higher values generally indicate higher premium pressure.</p>
                      </div>
                    </div>
                  </Card>

                  <Card>
                    <h4 className="mb-2 text-lg font-semibold">Estimate range over time</h4>
                    <EstimateTrendChart data={result.charts.estimateTrend} />
                  </Card>

                  <Card>
                    <h4 className="mb-2 text-lg font-semibold">Risk factor breakdown</h4>
                    <RiskBreakdownChart data={riskData} />
                    <div className="mt-3 grid gap-2">
                      {result.riskFactors.map((factor) => (
                        <div key={factor.label} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
                          <p className="font-medium">{factor.label} · {factor.score}/100</p>
                          <p className="text-white/70">{factor.reason}</p>
                          <p className="text-xs text-primary">Source: {factor.source}</p>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card>
                    <h4 className="text-lg font-semibold">Why this area?</h4>
                    <ul className="mt-2 space-y-1 text-sm text-white/80">
                      <li>• {result.context.areaSummary}</li>
                      <li>• {result.context.historicalTrend}</li>
                      <li>• {result.context.comparisonInsight}</li>
                    </ul>
                  </Card>

                  <Card>
                    <h4 className="text-lg font-semibold">Data sources</h4>
                    <div className="mt-3 grid gap-2">
                      {result.sources.map((source) => (
                        <a
                          key={source.url}
                          className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm transition hover:border-primary/40"
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <p className="font-medium">{source.name}</p>
                          <p className="text-xs text-white/70">{source.category} · {source.note}</p>
                        </a>
                      ))}
                    </div>
                  </Card>

                  <Card>
                    <h4 className="text-lg font-semibold">How this estimate is built</h4>
                    <p className="mt-2 text-sm text-white/75">
                      We combine state-level insurance baselines, Open-Meteo weather severity, and live road-density
                      signals from OpenStreetMap Overpass, plus NHTSA vehicle taxonomy and your profile modifiers.
                      Results are statistical estimates only, not carrier-issued quotes.
                    </p>
                  </Card>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

export default App
