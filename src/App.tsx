import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, LoaderCircle, LocateFixed, MapPin, Search, ShieldCheck, Sparkles, TriangleAlert, BrainCircuit, PowerOff, HardDrive, Download, Trash2 } from 'lucide-react'
import { Button } from './components/ui/button'
import { Card } from './components/ui/card'
import { Input } from './components/ui/input'
import { Select } from './components/ui/select'
import { EstimateTrendChart } from './components/charts/estimate-trend-chart'
import { RiskBreakdownChart } from './components/charts/risk-breakdown-chart'
import { confidenceLabel, formatCurrency, CURRENCY_LABEL } from './lib/format'
import { geocodeLocation, suggestLocations } from './lib/geocode'
import { getFallbackEstimate } from './lib/fallback'
import { getModelsForMakeYear, getVehicleMakes } from './lib/vehicle'
import { getEngine, isWebGPUAvailable, queryVehicleValuation, queryInsuranceAnalysis, clearModelCache, unloadEngine, getAutoLoad, setAutoLoad, getSelectedModelId, setSelectedModelId, getModelStorageSize, formatStorageSize, MODEL_OPTIONS, type LoadProgress } from './lib/llm-engine'
import { buildHeuristicInsights } from './lib/insights'
import { vehicleValueFactor, applyDepreciation } from './lib/vehicle-values'
import type {
  AgeRange,
  AIInsights,
  AnnualMileage,
  CoverageLevel,
  CreditTier,
  DrivingHistory,
  EstimateRequest,
  EstimateResponse,
} from './types/estimate'

const ageRanges: AgeRange[] = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+']
const historyOptions: DrivingHistory[] = ['clean', 'ticket', 'claim', 'multiple']
const coverageOptions: CoverageLevel[] = ['state-minimum', 'standard', 'full']
const mileageOptions: AnnualMileage[] = ['low', 'average', 'high']
const creditOptions: CreditTier[] = ['excellent', 'good', 'fair', 'poor']

function App() {
  const [request, setRequest] = useState<EstimateRequest>({
    location: '',
    vehicleYear: 2022,
    vehicleMake: '',
    vehicleModel: '',
    ageRange: '35-44',
    drivingHistory: 'clean',
    coverageLevel: 'standard',
    annualMileage: 'average',
    creditTier: 'good',
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
  const [llmProgress, setLlmProgress] = useState<LoadProgress | null>(null)
  const [llmReady, setLlmReady] = useState(false)
  const [llmSupported] = useState(isWebGPUAvailable)
  const [aiInsights, setAiInsights] = useState<AIInsights | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const llmInitRef = useRef(false)
  const [selectedModelId, setSelectedModelState] = useState(getSelectedModelId)
  const [autoLoadEnabled, setAutoLoadEnabled] = useState(getAutoLoad)
  const [storageSize, setStorageSize] = useState(0)
  const [aiDisabledBanner, setAiDisabledBanner] = useState(!getAutoLoad())
  const [modelSwitching, setModelSwitching] = useState(false)
  const [showLoadConfirm, setShowLoadConfirm] = useState(false)
  const storagePollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const selectedModelOption = useMemo(() => MODEL_OPTIONS.find(m => m.id === selectedModelId) || MODEL_OPTIONS[0], [selectedModelId])

  const canEstimate = Boolean(request.location && request.vehicleMake && request.vehicleModel && request.vehicleYear)

  const riskData = useMemo(
    () => result?.riskFactors.map((factor) => ({ label: factor.label, score: factor.score })) ?? [],
    [result],
  )

  // Initialize LLM engine on mount — only if auto-load is enabled
  useEffect(() => {
    if (llmInitRef.current || !llmSupported || !autoLoadEnabled) return
    llmInitRef.current = true
    getEngine((p) => setLlmProgress(p), selectedModelId).then((eng) => {
      if (eng) setLlmReady(true)
      setLlmProgress(null)
    })
  }, [llmSupported, autoLoadEnabled, selectedModelId])

  // Poll storage size
  useEffect(() => {
    const poll = () => { getModelStorageSize().then(setStorageSize).catch(() => {}) }
    poll()
    storagePollRef.current = setInterval(poll, llmProgress ? 5000 : 30000)
    return () => { if (storagePollRef.current) clearInterval(storagePollRef.current) }
  }, [llmProgress])

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
    setAiInsights(null)

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
      const baselineInsights = buildHeuristicInsights(payload, data)
      setAiInsights(baselineInsights)

      // LLM enhancement: get vehicle valuation + fully recalculate
      if (llmReady) {
        setAiLoading(true)
        try {
          const valuation = await queryVehicleValuation(
            payload.vehicleYear, payload.vehicleMake, payload.vehicleModel, payload.vehicleTrim
          )
          if (valuation && valuation.msrp > 0) {
            const aiAcv = applyDepreciation(valuation.msrp, payload.vehicleYear)
            data.vehicleValueEstimate = aiAcv
            data.vehicleValueSource = `AI Valuation (MSRP: $${valuation.msrp.toLocaleString()}, Group: ${valuation.insuranceGroup}/50)`

            // FULL recalculate using AI vehicle value — don't blend with server's placeholder
            const vvFact = vehicleValueFactor(aiAcv)
            const igFactor = 0.7 + (valuation.insuranceGroup / 50) * 1.5
            const combined = (vvFact * 0.6 + igFactor * 0.4)
            const adjusted = Math.round(data.likelyMonthly * combined)
            data.likelyMonthly = adjusted
            data.lowMonthly = Math.round(adjusted * 0.78)
            data.highMonthly = Math.round(adjusted * 1.32)
            data.yearlyRange = [data.lowMonthly * 12, data.highMonthly * 12]
          }

          // Get AI analysis — include trim so AI sees e.g. "2025 Mazda CX-5 Signature Turbo"
          const analysis = await queryInsuranceAnalysis({
            vehicle: `${payload.vehicleYear} ${payload.vehicleMake} ${payload.vehicleModel}${payload.vehicleTrim ? ` ${payload.vehicleTrim}` : ''}`,
            location: payload.location,
            state: data.stateDetected || 'US',
            age: payload.ageRange,
            drivingHistory: payload.drivingHistory,
            coverage: payload.coverageLevel,
            mileage: payload.annualMileage,
            credit: payload.creditTier,
            gender: payload.gender,
            vehicleValue: data.vehicleValueEstimate,
            weatherScore: data.riskFactors.find(f => f.label === 'Weather severity')?.score ?? 45,
            roadScore: data.riskFactors.find(f => f.label === 'Road network complexity')?.score ?? 45,
            stateBaseline: data.riskFactors.find(f => f.label === 'State insurance baseline')?.score ? data.likelyMonthly : 172,
          })
          if (analysis) {
            setAiInsights({
              summary: analysis.summary,
              vehicleInsight: analysis.vehicleInsight,
              locationInsight: analysis.locationInsight,
              tips: analysis.tips,
              factors: analysis.factors,
              llmEstimate: analysis.estimatedMonthly,
              llmConfidence: analysis.confidence,
            })
            // Blend LLM estimate with actuarial (40% LLM, 60% actuarial) — AI gets more weight now
            if (analysis.estimatedMonthly > 0) {
              const blended = Math.round(data.likelyMonthly * 0.6 + analysis.estimatedMonthly * 0.4)
              data.likelyMonthly = blended
              data.lowMonthly = Math.round(blended * 0.78)
              data.highMonthly = Math.round(blended * 1.32)
              data.yearlyRange = [data.lowMonthly * 12, data.highMonthly * 12]
              data.confidence = Math.min(96, data.confidence + 8)
            }
          }
          if (!analysis) {
            setAiInsights(buildHeuristicInsights(payload, data))
          }
        } catch (llmErr) {
          console.warn('LLM enhancement failed, using server estimate:', llmErr)
          setAiInsights(buildHeuristicInsights(payload, data))
        } finally {
          setAiLoading(false)
        }
      } else {
        // Non-AI path: server already uses brand lookup, build heuristic insights
        setAiInsights(buildHeuristicInsights(payload, data))
      }

      setResult(data)
    } catch {
      setError('Live data is temporarily unavailable. Showing robust fallback estimate.')
      setResult(getFallbackEstimate(request))
    } finally {
      setLoading(false)
    }
  }, [canEstimate, request, llmReady])

  const [clearingCache, setClearingCache] = useState(false)

  const handleClearCache = useCallback(async () => {
    setClearingCache(true)
    try {
      await clearModelCache()
      setLlmReady(false)
      setAutoLoadEnabled(false)
      setAiDisabledBanner(true)
      llmInitRef.current = false
      setClearingCache(false)
    } catch (err) {
      console.error('Failed to clear cache:', err)
      setClearingCache(false)
    }
  }, [])

  const handleLoadModelClick = useCallback(() => {
    if (!llmSupported) return
    setShowLoadConfirm(true)
  }, [llmSupported])

  const confirmLoadModel = useCallback(async () => {
    setShowLoadConfirm(false)
    setAiDisabledBanner(false)
    setAutoLoad(true)
    setAutoLoadEnabled(true)
    llmInitRef.current = true
    getEngine((p) => setLlmProgress(p), selectedModelId).then((eng) => {
      if (eng) setLlmReady(true)
      setLlmProgress(null)
    })
  }, [selectedModelId])

  const handleUnloadModel = useCallback(async () => {
    await unloadEngine()
    setLlmReady(false)
    setLlmProgress(null)
    llmInitRef.current = false
  }, [])

  const handleModelSwitch = useCallback(async (newModelId: string) => {
    if (newModelId === selectedModelId) return
    setModelSwitching(true)
    // Unload current model
    await unloadEngine()
    setLlmReady(false)
    setLlmProgress(null)
    llmInitRef.current = false
    // Set new model
    setSelectedModelId(newModelId)
    setSelectedModelState(newModelId)
    // Load new model
    setAiDisabledBanner(false)
    setAutoLoad(true)
    setAutoLoadEnabled(true)
    llmInitRef.current = true
    getEngine((p) => setLlmProgress(p), newModelId).then((eng) => {
      if (eng) setLlmReady(true)
      setLlmProgress(null)
      setModelSwitching(false)
    })
  }, [selectedModelId])

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
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <p className="inline-flex items-center gap-2 rounded-full border border-primary/50 bg-primary/10 px-3 py-1 text-xs text-primary">
              <ShieldCheck className="h-3.5 w-3.5" /> AI-Powered Insurance Estimator
            </p>
            {llmSupported && (
              <p className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-all ${
                llmReady ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-400' :
                llmProgress ? 'border-amber-400/50 bg-amber-400/10 text-amber-400' :
                aiDisabledBanner ? 'border-red-400/50 bg-red-400/10 text-red-400' :
                'border-white/20 bg-white/5 text-white/50'
              }`}>
                <BrainCircuit className="h-3.5 w-3.5" />
                {llmReady ? `AI Engine Ready · ${selectedModelOption.label}` : llmProgress ? `Loading ${selectedModelOption.label}: ${(llmProgress.progress * 100).toFixed(0)}%` : aiDisabledBanner ? 'AI Engine Disabled' : 'AI Standby'}
              </p>
            )}
          </div>
          <h1 className="bg-gradient-to-r from-cyan-300 via-sky-300 to-fuchsia-300 bg-clip-text text-3xl font-semibold leading-tight text-transparent md:text-5xl">
            AutoRate Atlas
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-white/75 md:text-base">
            Insurance estimates powered by {llmReady ? `an in-browser AI (${selectedModelOption.label})` : 'brand-calibrated vehicle data'}, actuarial GLM model, and live public data feeds. State-calibrated baselines for all 50 states. No account required.
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
                  max={2027}
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

            <div className="grid grid-cols-2 gap-3"> 
              <div>
                <label className="mb-1 block text-sm font-medium">Coverage level</label>
                <Select
                  value={request.coverageLevel}
                  onChange={(e) => setRequest((prev) => ({ ...prev, coverageLevel: e.target.value as CoverageLevel }))}
                >
                  {coverageOptions.map((opt) => (
                    <option className="bg-white text-slate-900" key={opt}>
                      {opt}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Annual mileage</label>
                <Select
                  value={request.annualMileage}
                  onChange={(e) => setRequest((prev) => ({ ...prev, annualMileage: e.target.value as AnnualMileage }))}
                >
                  {mileageOptions.map((opt) => (
                    <option className="bg-white text-slate-900" key={opt}>
                      {opt}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Insurance credit tier</label>
              <Select
                value={request.creditTier}
                onChange={(e) => setRequest((prev) => ({ ...prev, creditTier: e.target.value as CreditTier }))}
              >
                {creditOptions.map((opt) => (
                  <option className="bg-white text-slate-900" key={opt}>
                    {opt}
                  </option>
                ))}
              </Select>
            </div>

            <Button onClick={runEstimate} disabled={loading || !canEstimate}>
              {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
              Get My Estimate
            </Button>

            <p className="text-xs text-white/70">
              Press the button when you're ready. {llmReady ? `🧠 AI engine active — vehicle values & insights powered by local ${selectedModelOption.label}.` : llmSupported && !aiDisabledBanner ? '⏳ AI engine loading...' : llmSupported ? '📊 Using statistical model with brand-calibrated data.' : '📊 Using actuarial model (WebGPU not available).'}
            </p>

            {llmSupported && (
              <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-white/90">
                  <BrainCircuit className="h-4 w-4 text-violet-400" />
                  <span>AI Engine</span>
                  {storageSize > 0 && (
                    <span className="ml-auto inline-flex items-center gap-1 text-xs text-white/50">
                      <HardDrive className="h-3 w-3" />
                      {formatStorageSize(storageSize)} stored
                    </span>
                  )}
                </div>

                {/* AI Disabled Banner */}
                {aiDisabledBanner && !llmReady && !llmProgress && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 p-2.5 text-xs text-amber-200">
                    <PowerOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>AI engine disabled — using statistical model with brand-calibrated vehicle data. Select a model and click "Load" to re-enable AI insights.</span>
                  </div>
                )}

                {/* Model selector + load/unload */}
                <div className="flex flex-wrap gap-2">
                  <select
                    value={selectedModelId}
                    onChange={(e) => handleModelSwitch(e.target.value)}
                    disabled={modelSwitching || !!llmProgress}
                    className="flex-1 min-w-[140px] rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-white/90 outline-none transition focus:border-violet-400/50 disabled:opacity-50"
                  >
                    {MODEL_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id} className="bg-slate-900 text-white">
                        {opt.label} ({opt.sizeHint})
                      </option>
                    ))}
                  </select>

                  {!llmReady && !llmProgress ? (
                    <button
                      onClick={handleLoadModelClick}
                      disabled={modelSwitching}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
                    >
                      <Download className="h-3 w-3" />
                      Load Model
                    </button>
                  ) : llmReady ? (
                    <button
                      onClick={handleUnloadModel}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300 transition hover:bg-amber-500/20"
                    >
                      <PowerOff className="h-3 w-3" />
                      Unload
                    </button>
                  ) : null}
                </div>

                {/* Loading progress bar */}
                {llmProgress && (
                  <div className="space-y-1">
                    <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${(llmProgress.progress * 100).toFixed(0)}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                    <p className="text-[10px] text-white/40 truncate">{llmProgress.text}</p>
                  </div>
                )}

                {modelSwitching && !llmProgress && (
                  <div className="flex items-center gap-2 text-xs text-violet-300">
                    <LoaderCircle className="h-3 w-3 animate-spin" />
                    <span>Switching model...</span>
                  </div>
                )}

                {/* Clear cache button */}
                <button
                  onClick={handleClearCache}
                  disabled={clearingCache}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-400/20 bg-red-500/5 px-2.5 py-1 text-[11px] text-red-300/80 transition hover:bg-red-500/15 disabled:opacity-50"
                >
                  {clearingCache ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  {clearingCache ? 'Clearing...' : 'Clear cache & disable auto-load'}
                </button>
              </div>
            )}

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
                    <div className="flex items-baseline justify-between">
                      <p className="metric-label">Estimated monthly range <span className="text-[10px] text-white/40 ml-1">({CURRENCY_LABEL})</span></p>
                      {llmReady && <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-300"><Sparkles className="h-2.5 w-2.5" /> AI-Enhanced</span>}
                    </div>
                    <h3 className="mt-1 text-3xl font-semibold">
                      {formatCurrency(result.lowMonthly)} — {formatCurrency(result.highMonthly)}
                      <span className="ml-2 text-base font-normal text-white/50">{CURRENCY_LABEL}</span>
                    </h3>
                    <p className="mt-1 text-sm text-white/70">
                      Likely around {formatCurrency(result.likelyMonthly)}/month · yearly {formatCurrency(result.yearlyRange[0])}
                      {' – '}
                      {formatCurrency(result.yearlyRange[1])} {CURRENCY_LABEL}
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
                      <div className="rounded-xl border border-white/15 bg-black/20 p-3 sm:col-span-2">
                        <p className="metric-label">Estimated vehicle value <span className="text-[10px] text-white/40 ml-1">({CURRENCY_LABEL})</span></p>
                        <p className="text-lg font-semibold">{formatCurrency(result.vehicleValueEstimate)} <span className="text-sm font-normal text-white/50">{CURRENCY_LABEL}</span></p>
                        <p className="text-xs text-white/70">Source: {result.vehicleValueSource ?? 'Fallback model'}.</p>
                      </div>
                    </div>
                  </Card>

                  {/* AI Insights Panel — placed ABOVE risk breakdown for prominence */}
                  {(aiInsights || aiLoading) && (
                    <Card>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 border border-violet-400/30">
                          <Sparkles className="h-4 w-4 text-violet-300" />
                        </div>
                        <div>
                          <h4 className="text-lg font-semibold">{llmReady ? 'AI Insights' : 'Analysis'}</h4>
                          <p className="text-xs text-violet-300/70">{llmReady ? `Powered by ${selectedModelOption.label} · Running locally in your browser` : 'Powered by statistical model · Brand-calibrated data'}</p>
                        </div>
                      </div>
                      {aiLoading && !aiInsights ? (
                        <div className="flex items-center gap-3 py-6">
                          <LoaderCircle className="h-5 w-5 animate-spin text-violet-400" />
                          <span className="text-sm text-white/60">AI is analyzing your profile...</span>
                        </div>
                      ) : aiInsights ? (
                        <div className="space-y-3">
                          <p className="text-sm text-white/85 leading-relaxed">{aiInsights.summary}</p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div className="rounded-xl border border-violet-400/20 bg-violet-500/10 p-3">
                              <p className="text-xs font-medium text-violet-300 mb-1">🚗 Vehicle</p>
                              <p className="text-sm text-white/80">{aiInsights.vehicleInsight}</p>
                            </div>
                            <div className="rounded-xl border border-violet-400/20 bg-violet-500/10 p-3">
                              <p className="text-xs font-medium text-violet-300 mb-1">📍 Location</p>
                              <p className="text-sm text-white/80">{aiInsights.locationInsight}</p>
                            </div>
                          </div>
                          {aiInsights.tips.length > 0 && (
                            <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3">
                              <p className="text-xs font-medium text-emerald-300 mb-2">💡 Tips to lower your premium</p>
                              <ul className="space-y-1">
                                {aiInsights.tips.map((tip, i) => (
                                  <li key={i} className="text-sm text-white/75">• {tip}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {aiInsights.llmEstimate ? (
                            <p className="text-xs text-white/50">AI independent estimate: {formatCurrency(aiInsights.llmEstimate)} {CURRENCY_LABEL}/mo (blended 40% into final result)</p>
                          ) : null}
                        </div>
                      ) : null}
                    </Card>
                  )}

                  <Card>
                    <h4 className="mb-2 text-lg font-semibold">Estimate range over time <span className="text-xs font-normal text-white/40">({CURRENCY_LABEL})</span></h4>
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
                      All monetary values are in <strong>USD (United States Dollars)</strong>. AutoRate Atlas uses a three-layer architecture: <strong>Layer 1</strong> — Real state-level insurance baselines
                      (all 50 states + DC) calibrated from 2025/2026 Insurify and Experian data. <strong>Layer 2</strong> — An actuarial
                      Generalized Linear Model (GLM) with multiplicative rating factors for age, credit, coverage, mileage, history,
                      vehicle age, and environmental signals (weather, road density, Census income/density). <strong>Layer 3</strong>{' — '}
                      {llmReady
                        ? `${selectedModelOption.label} AI model running locally in your browser (via WebLLM/WebGPU) that provides vehicle valuation, insurance group classification, and personalized analysis. The AI estimate is blended 40/60 with the actuarial model for maximum accuracy.`
                        : 'Brand-calibrated vehicle valuation with curated MSRP data for 50+ brands and depreciation modeling (AI engine available via WebGPU browser).'}
                      {' '}Results are statistical estimates only, not carrier-issued quotes.
                    </p>
                  </Card>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {showLoadConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl"
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/20">
                  <BrainCircuit className="h-5 w-5 text-violet-400" />
                </div>
                <h3 className="text-xl font-semibold text-white">Enable AI Engine</h3>
              </div>
              
              <p className="mb-4 text-sm text-white/80">
                You are about to download the <strong>{selectedModelOption.label}</strong> AI model to run directly in your browser. This enables hyper-accurate vehicle valuation and personalized insurance insights without sending your data to the cloud.
              </p>
              
              <div className="mb-6 space-y-2 rounded-xl bg-black/30 p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/60">Model Size:</span>
                  <span className="font-medium text-white">{selectedModelOption.sizeHint}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Storage:</span>
                  <span className="font-medium text-white">Cached locally after download</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Requirements:</span>
                  <span className="font-medium text-white">WebGPU-capable browser</span>
                </div>
              </div>
              
              <div className="flex justify-end gap-3">
                <Button className="bg-transparent border border-white/20 text-white hover:bg-white/10" onClick={() => setShowLoadConfirm(false)}>
                  Cancel
                </Button>
                <Button onClick={confirmLoadModel} className="bg-violet-600 hover:bg-violet-700 text-white border-0">
                  <Download className="mr-2 h-4 w-4" /> Start Download
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
