import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { LoaderCircle, LocateFixed, MapPin, ShieldCheck, TriangleAlert } from 'lucide-react'
import { Button } from './components/ui/button'
import { Card } from './components/ui/card'
import { Input } from './components/ui/input'
import { Select } from './components/ui/select'
import { EstimateTrendChart } from './components/charts/estimate-trend-chart'
import { RiskBreakdownChart } from './components/charts/risk-breakdown-chart'
import { confidenceLabel, formatCurrency } from './lib/format'
import { geocodeLocation } from './lib/geocode'
import { getFallbackEstimate } from './lib/fallback'
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

  const riskData = useMemo(
    () => result?.riskFactors.map((factor) => ({ label: factor.label, score: factor.score })) ?? [],
    [result],
  )

  const detectLocation = async () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported in your browser.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
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

  const runEstimate = async () => {
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
  }

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
            Estimate monthly and yearly auto insurance cost ranges using public risk signals, location context,
            and your profile. This is an estimate, not a guaranteed insurer quote.
          </p>
        </motion.header>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_1.35fr]">
          <Card className="space-y-4">
            <h2 className="text-xl font-semibold">Estimate inputs</h2>
            <div>
              <label className="mb-1 block text-sm font-medium">Location</label>
              <div className="flex gap-2">
                <Input
                  aria-label="Location"
                  value={request.location}
                  onChange={(e) => setRequest((prev) => ({ ...prev, location: e.target.value }))}
                  placeholder="City, ZIP, neighborhood, or address"
                />
                <Button onClick={detectLocation} className="px-3" aria-label="Detect location">
                  <LocateFixed className="h-4 w-4" />
                </Button>
              </div>
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
                    <option key={age}>{age}</option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Make</label>
                <Input
                  value={request.vehicleMake}
                  onChange={(e) => setRequest((prev) => ({ ...prev, vehicleMake: e.target.value }))}
                  placeholder="Toyota"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Model</label>
                <Input
                  value={request.vehicleModel}
                  onChange={(e) => setRequest((prev) => ({ ...prev, vehicleModel: e.target.value }))}
                  placeholder="RAV4"
                />
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
                    <option key={opt}>{opt}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Gender (optional)</label>
                <Select
                  value={request.gender ?? ''}
                  onChange={(e) => setRequest((prev) => ({ ...prev, gender: e.target.value || undefined }))}
                >
                  <option value="">Prefer not to say</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="nonbinary">Non-binary</option>
                </Select>
              </div>
            </div>

            <Button onClick={runEstimate} disabled={loading || !request.location || !request.vehicleMake || !request.vehicleModel}>
              {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
              Generate estimate
            </Button>

            <p className="text-xs text-white/70">
              Privacy-safe: no account required. Inputs are used only for this estimate request.
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
                  <h3 className="text-2xl font-semibold">Your estimate dashboard will appear here</h3>
                  <p className="mt-2 max-w-md text-sm text-white/70">
                    Add your location and vehicle profile to generate a transparent premium range with confidence,
                    risk drivers, methodology, and data sources.
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
                      We blend public crash statistics, weather severity, traffic density, theft indicators, and
                      profile-level modifiers. We then combine these signals in a weighted scoring pipeline to produce
                      low/likely/high ranges. This tool does not provide carrier quotes and should be used for planning.
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
