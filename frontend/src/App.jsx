import { useEffect, useMemo, useState } from 'react'

import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap
} from 'react-leaflet'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts'

import {
  Activity,
  MapPin,
  Wind,
  Users,
  BrainCircuit,
  Plus,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Check,
  Copy,
  Scale
} from 'lucide-react'

import { getJSON, postJSON } from './api'
import { LAWS } from './lawsData'

// Default location
const CENTER = {
  latitude: 31.5204,
  longitude: 74.3587
}

// Available cities
const PRESETS = [
  { name: 'Lahore', latitude: 31.5204, longitude: 74.3587 },
  { name: 'Karachi', latitude: 24.8607, longitude: 67.0011 },
  { name: 'Delhi', latitude: 28.6139, longitude: 77.209 },
  { name: 'Mumbai', latitude: 19.076, longitude: 72.8777 },
  { name: 'London', latitude: 51.5072, longitude: -0.1276 },
  { name: 'New York', latitude: 40.7128, longitude: -74.006 }
]

// Light-theme accessible AQI colors, badge tints, and labels
function getAqiMeta(v) {
  if (v == null) {
    return {
      color: '#64748b',
      bg: '#f1f5f9',
      label: 'No reading'
    }
  }
  if (v <= 50) {
    return {
      color: '#16a34a',
      bg: '#dcfce7',
      label: 'Good'
    }
  }
  if (v <= 100) {
    return {
      color: '#ca8a04',
      bg: '#fef9c3',
      label: 'Moderate'
    }
  }
  if (v <= 150) {
    return {
      color: '#ea580c',
      bg: '#ffedd5',
      label: 'Unhealthy for sensitive groups'
    }
  }
  if (v <= 200) {
    return {
      color: '#dc2626',
      bg: '#fee2e2',
      label: 'Unhealthy'
    }
  }
  return {
    color: '#9333ea',
    bg: '#f3e8ff',
    label: 'Very unhealthy'
  }
}

// Map resize helper
function ResizeMap() {
  const map = useMap()

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize()
    }, 120)

    return () => clearTimeout(timer)
  }, [map])

  return null
}

// Move map when selected location changes
function PanToSelected({ point }) {
  const map = useMap()

  useEffect(() => {
    if (point?.latitude != null && point?.longitude != null) {
      map.flyTo([point.latitude, point.longitude], 12, { duration: 0.7 })
    }
  }, [map, point?.latitude, point?.longitude])

  return null
}

// Dashboard metric component
function Metric({ icon: Icon, title, value, detail, tint }) {
  return (
    <article className="metric">
      <div className="metric-head">
        <span>{title}</span>
        <span className="metric-icon">
          <Icon size={16} />
        </span>
      </div>

      <strong style={tint ? { color: tint } : {}}>{value}</strong>

      <small>{detail}</small>
    </article>
  )
}

export default function App() {
  // Location states
  const [places, setPlaces] = useState([])

  const [selected, setSelected] = useState({
    id: 'central',
    name: 'Lahore Central',
    ...CENTER
  })

  const [area, setArea] = useState({
    name: 'Lahore',
    ...CENTER
  })

  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState([])
  const [locationMessage, setLocationMessage] = useState('')

  // Air quality states
  const [air, setAir] = useState(null)
  const [insight, setInsight] = useState(null)
  const [hotspots, setHotspots] = useState(null)

  // Community report states
  const [reports, setReports] = useState([])
  const [community, setCommunity] = useState(null)

  // General states
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [modal, setModal] = useState(false)
  const [copied, setCopied] = useState(false)

  // Laws filter state
  const [lawFilter, setLawFilter] = useState('all')

  const filteredLaws = useMemo(() => {
    if (lawFilter === 'all') return LAWS
    return LAWS.filter(law => law.jurisdiction === lawFilter)
  }, [lawFilter])

  // Complaint tracking states
  const [trackingCode, setTrackingCode] = useState('')
  const [trackInput, setTrackInput] = useState('')
  const [trackedReport, setTrackedReport] = useState(null)
  const [trackError, setTrackError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [trackingBusy, setTrackingBusy] = useState(false)

  // Report form
  const [form, setForm] = useState({
    category: 'smoke',
    description: '',
    location_name: 'Lahore',
    latitude: CENTER.latitude,
    longitude: CENTER.longitude,
    is_anonymous: true
  })

  // Clear previous tracking information when location changes
  function clearTracking() {
    setTrackingCode('')
    setTrackInput('')
    setTrackedReport(null)
    setTrackError('')
    setCopied(false)
  }

  // Fetch nearby reports and community insights
  async function refreshReports(a = area) {
    try {
      const q = `latitude=${a.latitude}&longitude=${a.longitude}&radius_km=15`

      const [r, c] = await Promise.all([
        getJSON(`/api/reports?${q}`),
        getJSON(`/api/community-insights?${q}`)
      ])

      setReports(r)
      setCommunity(c)
    } catch (e) {
      setError(e.message)
    }
  }

  // Fetch nearby hotspot locations
  async function refreshHotspots(a = area) {
    try {
      const h = await getJSON(
        `/api/hotspots?latitude=${a.latitude}&longitude=${a.longitude}&name=${encodeURIComponent(a.name)}`
      )

      setHotspots(h)

      setPlaces(
        h.locations.map(({ id, name, latitude, longitude }) => ({
          id,
          name,
          latitude,
          longitude
        }))
      )
    } catch (e) {
      setError(e.message)
    }
  }

  // Change selected city or area
  function chooseArea(a) {
    const next = {
      name: a.name,
      latitude: a.latitude,
      longitude: a.longitude
    }

    setArea(next)
    setSelected({
      id: 'centre',
      ...next
    })

    // Clear previous city's data
    setReports([])
    setCommunity(null)
    setHotspots(null)
    clearTracking()

    // Update report form location
    setForm(f => ({
      ...f,
      latitude: next.latitude,
      longitude: next.longitude,
      location_name: next.name
    }))

    setMatches([])
    setQuery('')
    setLocationMessage('')
    setError('')

    refreshHotspots(next)
    refreshReports(next)
  }

  // Search for a city
  async function search(e) {
    e.preventDefault()

    if (query.trim().length < 2) return

    try {
      const r = await getJSON(`/api/geocode?q=${encodeURIComponent(query.trim())}`)
      setMatches(r)
      setLocationMessage(
        r.length ? 'Choose a match below.' : 'No place found. Try another spelling.'
      )
    } catch (err) {
      setError(err.message)
    }
  }

  // Use browser location
  function useMyLocation() {
    setLocationMessage('Getting your location...')

    navigator.geolocation.getCurrentPosition(
      pos => {
        const latitude = pos.coords.latitude
        const longitude = pos.coords.longitude

        const a = {
          name: 'Your current area',
          latitude,
          longitude
        }

        setArea(a)
        setSelected({
          id: 'your-location',
          name: 'Your current area',
          latitude,
          longitude
        })

        setPlaces([])
        setReports([])
        setCommunity(null)
        setHotspots(null)
        clearTracking()

        setForm(f => ({
          ...f,
          latitude,
          longitude,
          location_name: 'Your current area'
        }))

        refreshHotspots(a)
        refreshReports(a)

        setLocationMessage('Location detected successfully!')
      },
      err => {
        console.error('GEOLOCATION:', err)
        setLocationMessage(`Location failed (${err.code}): ${err.message}`)
      },
      {
        enableHighAccuracy: false,
        timeout: 60000,
        maximumAge: 60000
      }
    )
  }

  // Refresh air quality and statistical insights
  async function refreshAir(place = selected) {
    setBusy(true)
    setError('')

    try {
      const q = `latitude=${place.latitude}&longitude=${place.longitude}&past_days=2`

      const [a, i] = await Promise.all([
        getJSON(`/api/air-quality?${q}`),
        getJSON(`/api/insights?latitude=${place.latitude}&longitude=${place.longitude}`)
      ])

      setAir(a)
      setInsight(i)
    } catch (e) {
      setError(e.message)
      setAir(null)
      setInsight(null)
    } finally {
      setBusy(false)
    }
  }

  // Submit community report
  async function submit(e) {
    e.preventDefault()
    setSubmitting(true)

    try {
      const result = await postJSON('/api/reports', form)

      setTrackingCode(result.tracking_code)
      setCopied(false)
      setTrackedReport(null)
      setTrackInput('')
      setTrackError('')
      setModal(false)

      setForm(f => ({
        ...f,
        description: ''
      }))

      await refreshReports(area)
    } catch (err) {
      alert(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Track complaint using tracking code
  async function trackComplaint(e) {
    e.preventDefault()

    if (!trackInput.trim()) {
      setTrackError('Please enter your tracking code.')
      return
    }

    setTrackingBusy(true)
    setTrackError('')
    setTrackedReport(null)

    try {
      const result = await getJSON(
        `/api/reports/track/${encodeURIComponent(trackInput.trim())}`
      )
      setTrackedReport(result)
    } catch {
      setTrackError('Complaint not found. Please check your tracking code.')
    } finally {
      setTrackingBusy(false)
    }
  }

  // Copy tracking code helper
  function handleCopyCode() {
    navigator.clipboard.writeText(trackingCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Initial loading
  useEffect(() => {
    refreshReports(area)
    refreshHotspots(area)
  }, [])

  // Refresh air data when selected point changes
  useEffect(() => {
    refreshAir(selected)
  }, [selected.latitude, selected.longitude])

  // Current air quality
  const current = air?.current || {}
  const aqi = current.us_aqi
  const aqiMeta = getAqiMeta(aqi)

  // Prepare chart data
  const chart = useMemo(() => {
    const h = air?.hourly
    if (!h?.time) return []

    return h.time
      .map((t, i) => ({
        time: new Date(t).toLocaleString([], {
          month: 'short',
          day: 'numeric',
          hour: 'numeric'
        }),
        aqi: h.us_aqi?.[i]
      }))
      .filter(x => x.aqi != null)
  }, [air])

  return (
    <div className="shell">
      {/* HEADER */}
      <header>
        <a className="brand" href="#top">
          <span className="brand-icon">
            <Wind />
          </span>

          <span>
            AirWatch <b>AI</b>
            <small>COMMUNITY AIR INTELLIGENCE</small>
          </span>
        </a>

        <nav>
          <a href="#map">Explore map</a>
          <a href="#hotspots">Hotspots</a>
          <a href="#trends">Analytics</a>
          <a href="#reports">Reports</a>
          <a href="#laws">Laws &amp; Policy</a>
        </nav>

        <button className="button" onClick={() => setModal(true)}>
          <Plus size={16} /> Report pollution
        </button>
      </header>

      <main id="top">
        {/* HERO */}
        <section className="hero">
          <div>
            <div className="eyebrow">● LIVE AIR QUALITY INTELLIGENCE</div>

            <h1>
              Know the air.
              <br />
              <em>Protect your community.</em>
            </h1>

            <p>
              Explore modeled air-quality conditions, spot emerging patterns,
              and share what you see on the ground.
            </p>

            <a className="link" href="#map">
              Explore your area ↗
            </a>
          </div>

          <div className="hero-score">
            <div className="hero-score-icon">
              <Wind size={22} />
            </div>

            <small>LOCAL AIR SNAPSHOT</small>

            <strong style={{ color: aqiMeta.color }}>{aqi ?? '—'}</strong>

            <span
              className="aqi-badge"
              style={{
                background: aqiMeta.bg,
                color: aqiMeta.color
              }}
            >
              {aqi != null ? aqiMeta.label : busy ? 'Loading readings…' : 'No reading'}
            </span>

            <small>{selected.name} · US AQI</small>
          </div>
        </section>

        {/* ERROR MESSAGE */}
        {error && (
          <div className="error">
            <AlertTriangle size={16} />
            <span>{error}</span>
            <button onClick={() => refreshAir()}>Retry</button>
          </div>
        )}

        {/* METRICS */}
        <section className="metrics">
          <Metric
            icon={Activity}
            title="US AIR QUALITY INDEX"
            value={aqi ?? '—'}
            detail={aqi != null ? aqiMeta.label : 'Waiting for data'}
            tint={aqi != null ? aqiMeta.color : undefined}
          />

          <Metric
            icon={Wind}
            title="PM2.5"
            value={current.pm2_5 != null ? current.pm2_5.toFixed(1) : '—'}
            detail="µg/m³ · fine particles"
          />

          <Metric
            icon={Activity}
            title="PM10"
            value={current.pm10 != null ? current.pm10.toFixed(1) : '—'}
            detail="µg/m³ · coarse particles"
          />

          <Metric
            icon={Users}
            title="COMMUNITY REPORTS"
            value={reports.length}
            detail={`${reports.filter(r => r.status === 'pending').length} awaiting review`}
          />
        </section>

        {/* AQI SCALE LEGEND */}
        <div className="aqi-scale" aria-label="US AQI reference scale">
          <span className="aqi-scale-title">US AQI Scale</span>
          <div className="aqi-scale-items">
            <span className="aqi-scale-item">
              <i className="dot" style={{ background: '#16a34a' }} /> 0–50 Good
            </span>
            <span className="aqi-scale-item">
              <i className="dot" style={{ background: '#ca8a04' }} /> 51–100 Moderate
            </span>
            <span className="aqi-scale-item">
              <i className="dot" style={{ background: '#ea580c' }} /> 101–150 Sensitive
            </span>
            <span className="aqi-scale-item">
              <i className="dot" style={{ background: '#dc2626' }} /> 151–200 Unhealthy
            </span>
            <span className="aqi-scale-item">
              <i className="dot" style={{ background: '#9333ea' }} /> 200+ Very Unhealthy
            </span>
          </div>
        </div>

        {/* MAP SECTION */}
        <section className="section" id="map">
          <div className="section-head">
            <div>
              <div className="eyebrow">01 / EXPLORE</div>
              <h2>Pollution across your area</h2>
              <p>
                Search a city, pick a preset, or share your browser location to
                inspect nearby model estimates.
              </p>

              {/* CITY SEARCH */}
              <form className="geo-search" onSubmit={search}>
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search any city or town worldwide…"
                  aria-label="Search city"
                />
                <button className="secondary" type="submit">
                  Search
                </button>
              </form>

              {/* SEARCH RESULTS */}
              {matches.length > 0 && (
                <div className="geo-matches">
                  {matches.map(m => (
                    <button type="button" key={m.id} onClick={() => chooseArea(m)}>
                      {m.name}
                    </button>
                  ))}
                </div>
              )}

              {/* CITY PRESETS */}
              <div className="geo-matches">
                {PRESETS.map(p => (
                  <button
                    type="button"
                    key={p.name}
                    className={area.name === p.name ? 'active-pill' : ''}
                    onClick={() => chooseArea(p)}
                  >
                    {p.name}
                  </button>
                ))}
              </div>

              {locationMessage && (
                <small className="location-message">{locationMessage}</small>
              )}
            </div>

            <div className="section-actions">
              <button className="secondary" onClick={useMyLocation}>
                <MapPin size={15} /> Use my location
              </button>

              <button
                className="secondary"
                onClick={() => {
                  refreshAir()
                  refreshReports(area)
                  refreshHotspots(area)
                }}
              >
                <RefreshCw size={15} className={busy ? 'spin' : ''} /> Refresh
              </button>
            </div>
          </div>

          {/* MAP AND SIDEBAR */}
          <div className="map-layout">
            <div className="map-card">
              <MapContainer
                center={[area.latitude, area.longitude]}
                zoom={11}
                scrollWheelZoom
              >
                <ResizeMap />
                <PanToSelected point={selected} />

                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                />

                {/* MONITORING POINTS */}
                {places.map(p => (
                  <CircleMarker
                    key={p.id}
                    center={[p.latitude, p.longitude]}
                    radius={selected.id === p.id ? 12 : 8}
                    pathOptions={{
                      color: '#ffffff',
                      weight: 2.5,
                      fillColor:
                        selected.id === p.id ? aqiMeta.color : '#0d9488',
                      fillOpacity: 0.92
                    }}
                    eventHandlers={{
                      click: () => setSelected(p)
                    }}
                  >
                    <Popup>
                      <b>{p.name}</b>
                      <br />
                      Click to inspect air-quality readings for this point.
                    </Popup>
                  </CircleMarker>
                ))}

                {/* USER LOCATION */}
                {selected.id === 'your-location' && (
                  <CircleMarker
                    center={[selected.latitude, selected.longitude]}
                    radius={12}
                    pathOptions={{
                      color: '#ffffff',
                      weight: 3,
                      fillColor: '#2563eb',
                      fillOpacity: 1
                    }}
                  >
                    <Popup>Your shared location · modeled estimate</Popup>
                  </CircleMarker>
                )}

                {/* COMMUNITY REPORT MARKERS */}
                {reports.map(r => (
                  <CircleMarker
                    key={`r${r.id}`}
                    center={[r.latitude, r.longitude]}
                    radius={7}
                    pathOptions={{
                      color: '#ffffff',
                      weight: 1.5,
                      fillColor:
                        r.status === 'verified' ? '#ea580c' : '#64748b',
                      fillOpacity: 0.9
                    }}
                  >
                    <Popup>
                      <b>{r.category} report</b>
                      <br />
                      {r.description}
                      <br />
                      Status: {r.status}
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>

              <div className="legend">
                <span>
                  <i className="dot" style={{ background: '#0d9488' }} /> Model query point
                </span>
                <span>
                  <i className="dot" style={{ background: '#ea580c' }} /> Verified report
                </span>
                <span>
                  <i className="dot" style={{ background: '#64748b' }} /> Pending report
                </span>
              </div>
            </div>

            {/* MAP SIDEBAR */}
            <aside className="side">
              <div>
                <h3>Monitoring locations</h3>
                <p>Select a point to load its data.</p>

                <div className="places">
                  {places.map(p => (
                    <button
                      key={p.id}
                      className={selected.id === p.id ? 'place active' : 'place'}
                      onClick={() => setSelected(p)}
                    >
                      <MapPin size={15} />

                      <span>
                        {p.name}
                        <small>
                          {p.latitude.toFixed(3)}, {p.longitude.toFixed(3)}
                        </small>
                      </span>

                      <span>›</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="selected">
                <small>SELECTED AREA</small>
                <h3>{selected.name}</h3>

                <strong style={{ color: aqiMeta.color }}>
                  {aqi ?? '—'} <small>US AQI</small>
                </strong>

                <b>
                  {aqi != null
                    ? aqiMeta.label
                    : busy
                      ? 'Loading…'
                      : 'No reading'}
                </b>

                <p>
                  {air?.note ||
                    'Readings are supplied by the air-quality model.'}
                </p>
              </div>
            </aside>
          </div>

          <p className="attribution">
            Map © OpenStreetMap contributors, © CARTO. Air-quality data:
            Open-Meteo / CAMS. Model grid estimates are not street-level sensor
            measurements.
          </p>
        </section>

        {/* HOTSPOTS */}
        <section className="section" id="hotspots">
          <div className="section-head">
            <div>
              <div className="eyebrow">02 / COMPARE</div>
              <h2>Pollution hotspot watch</h2>
              <p>
                Compare modeled AQI across query points around {area.name}.
              </p>
            </div>

            <button
              className="secondary"
              onClick={() => refreshHotspots(area)}
            >
              <RefreshCw size={15} /> Update comparison
            </button>
          </div>

          <div className="hotspot-grid">
            {(hotspots?.locations || []).map(p => {
              const pMeta = getAqiMeta(p.aqi)
              return (
                <button
                  key={p.id}
                  className={`hotspot-card ${selected.id === p.id ? 'chosen' : ''}`}
                  onClick={() => setSelected(p)}
                >
                  <span>{p.name}</span>

                  <strong style={{ color: pMeta.color }}>
                    {p.aqi ?? '—'}
                  </strong>

                  <small>
                    {p.aqi != null ? pMeta.label : 'No current reading'} · US AQI
                  </small>

                  <small>
                    PM2.5:{' '}
                    {p.pm2_5 != null
                      ? `${Number(p.pm2_5).toFixed(1)} µg/m³`
                      : '—'}
                  </small>
                </button>
              )
            })}
          </div>

          <p className="attribution">
            {hotspots?.highest
              ? `Highest estimate: ${hotspots.highest.name} (${hotspots.highest.aqi} AQI). `
              : ''}
            {hotspots?.lowest
              ? `Lowest: ${hotspots.lowest.name} (${hotspots.lowest.aqi} AQI). `
              : ''}
            {hotspots?.note || 'Loading comparison…'}
          </p>
        </section>

        {/* COMMUNITY PATTERNS */}
        <section className="section" id="community-patterns">
          <div className="section-head">
            <div>
              <div className="eyebrow">03 / COMMUNITY SIGNALS</div>
              <h2>Community pattern analysis</h2>
              <p>
                Summarizes resident observations, excluding rejected
                submissions.
              </p>
            </div>
          </div>

          <div className="pattern-panel">
            <div className="pattern-stats">
              <div>
                <strong>{community?.total_reports ?? 0}</strong>
                <small>Reports analyzed</small>
              </div>

              <div>
                <strong>{community?.pending_reports ?? 0}</strong>
                <small>Pending review</small>
              </div>

              <div>
                <strong>{community?.verified_reports ?? 0}</strong>
                <small>Verified reports</small>
              </div>
            </div>

            <div>
              <h3>Frequently reported pollution types</h3>

              <div className="category-bars">
                {Object.entries(community?.category_counts || {})
                  .sort((a, b) => b[1] - a[1])
                  .map(([name, count]) => (
                    <div className="category-row" key={name}>
                      <span>{name}</span>

                      <div>
                        <i
                          style={{
                            width: `${Math.max(
                              5,
                              (count /
                                Math.max(
                                  1,
                                  ...Object.values(
                                    community?.category_counts || {}
                                  )
                                )) *
                                100
                            )}%`
                          }}
                        />
                      </div>

                      <b>{count}</b>
                    </div>
                  ))}
              </div>

              <p className="action-tip">
                <b>Suggested community action:</b>{' '}
                {community?.suggested_action ||
                  'As reports arrive, AirWatch will identify common observation types and suggest practical next steps.'}
              </p>
            </div>
          </div>

          <p className="attribution">
            {community?.note ||
              'Community observations are not verified measurements.'}
          </p>
        </section>

        {/* ANALYTICS */}
        <section className="section" id="trends">
          <div className="section-head">
            <div>
              <div className="eyebrow">04 / UNDERSTAND</div>
              <h2>Air quality over time</h2>
              <p>
                Recent and forecast hourly model values for {selected.name}.
              </p>
            </div>

            <span className="pill">HOURLY SERIES</span>
          </div>

          <div className="analytics">
            <div className="chart-card">
              <h3>US AQI trend</h3>
              <p>Historical context + forecast series</p>

              <div className="chart">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chart}>
                    <defs>
                      <linearGradient id="aqiFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0d9488" stopOpacity={0.24} />
                        <stop offset="95%" stopColor="#0d9488" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />

                    <XAxis
                      dataKey="time"
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                      minTickGap={35}
                    />

                    <YAxis
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />

                    <Tooltip
                      contentStyle={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: 12,
                        boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.1)',
                        color: '#0f172a',
                        fontSize: 12
                      }}
                      labelStyle={{ fontWeight: 700, color: '#0f172a', marginBottom: 4 }}
                      itemStyle={{ color: '#0d9488', fontWeight: 600 }}
                    />

                    <Area
                      type="monotone"
                      dataKey="aqi"
                      name="US AQI"
                      stroke="#0d9488"
                      fill="url(#aqiFill)"
                      strokeWidth={2.2}
                      connectNulls
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* INSIGHTS */}
            <div className="insight">
              <BrainCircuit size={26} />

              <div className="eyebrow">AIRWATCH INTELLIGENCE</div>
              <h3>What the data suggests</h3>

              <p>
                {insight?.summary ||
                  'Loading the available air-quality series…'}
              </p>

              <b>
                {insight
                  ? insight.anomaly
                    ? '⚠ Unusual increase detected'
                    : '✓ No unusual increase detected'
                  : 'Analyzing…'}
              </b>

              <small>
                {insight?.prediction != null
                  ? `Baseline estimate: ${insight.prediction} AQI · ${insight.confidence}`
                  : 'Prediction unavailable'}
              </small>

              <div className="disclaimer">
                Experimental statistical insight, not an official alert or
                validated ML forecast.
              </div>
            </div>
          </div>
        </section>

        {/* COMMUNITY REPORTS AND TRACKING */}
        <section className="section" id="reports">
          <div className="section-head">
            <div>
              <div className="eyebrow">05 / TAKE ACTION</div>
              <h2>Community observations</h2>
              <p>
                Local knowledge helps flag events a regional model may not
                capture.
              </p>
            </div>

            <button className="button" onClick={() => setModal(true)}>
              <Plus size={16} /> Submit a report
            </button>
          </div>

          {/* TRACKING CODE AFTER SUBMISSION */}
          {trackingCode && (
            <div className="tracking-success">
              <div>
                <h3>Complaint submitted successfully!</h3>
                <p>
                  Save your tracking code below so you can check the review
                  status anytime.
                </p>
              </div>

              <div className="tracking-code-box">
                <strong>{trackingCode}</strong>
                <button
                  type="button"
                  className="secondary"
                  onClick={handleCopyCode}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied!' : 'Copy code'}
                </button>
              </div>
            </div>
          )}

          {/* TRACK EXISTING COMPLAINT */}
          <div className="track-panel" id="track">
            <div className="eyebrow">COMPLAINT TRACKING</div>
            <h3>Track My Complaint</h3>
            <p>
              Enter the tracking code you received after submitting your
              report.
            </p>

            <form className="geo-search" onSubmit={trackComplaint}>
              <input
                value={trackInput}
                onChange={e => setTrackInput(e.target.value)}
                placeholder="Enter your complaint tracking code"
                required
              />

              <button
                className="secondary"
                type="submit"
                disabled={trackingBusy}
              >
                {trackingBusy ? 'Checking...' : 'Track complaint'}
              </button>
            </form>

            {trackError && <p className="error">{trackError}</p>}

            {trackedReport && (
              <div className="tracked-result">
                <h4>Complaint #{trackedReport.id}</h4>

                <div className="tracked-grid">
                  <p>
                    <b>Category:</b> {trackedReport.category}
                  </p>
                  <p>
                    <b>Location:</b>{' '}
                    {trackedReport.location_name || 'Not provided'}
                  </p>
                  <p>
                    <b>Status:</b>{' '}
                    <span className={`status ${trackedReport.status}`}>
                      {trackedReport.status.replace('_', ' ')}
                    </span>
                  </p>
                  <p>
                    <b>Submitted:</b>{' '}
                    {new Date(trackedReport.created_at).toLocaleString()}
                  </p>
                </div>

                {trackedReport.review_note && (
                  <p className="tracked-note">
                    <b>Moderator note:</b> {trackedReport.review_note}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* REPORT LIST */}
          <div className="reports">
            {reports.length === 0 ? (
              <div className="empty">
                <Users size={28} />
                <h3>No community reports yet</h3>
                <p>Be the first to share an observation in this area.</p>
              </div>
            ) : (
              reports.slice(0, 9).map(r => (
                <article className="report" key={r.id}>
                  <div>
                    <div className="report-head">
                      <b>{r.category}</b>
                      <span className={`status ${r.status}`}>
                        {r.status.replace('_', ' ')}
                      </span>
                    </div>

                    <p>{r.description}</p>
                  </div>

                  <small>
                    <MapPin size={13} />
                    <span>
                      {r.location_name ||
                        `${r.latitude.toFixed(3)}, ${r.longitude.toFixed(3)}`}{' '}
                      · {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </small>
                </article>
              ))
            )}
          </div>
        </section>

        {/* LEGAL & POLICY FRAMEWORK */}
        <section className="section" id="laws">
          <div className="section-head">
            <div>
              <div className="eyebrow">06 / LEGAL &amp; POLICY FRAMEWORK</div>
              <h2>Environmental &amp; climate change laws</h2>
              <p>
                Key Pakistani statutes and international treaties governing air
                quality, emissions, and climate resilience.
              </p>
            </div>

            <div className="geo-matches">
              <button
                type="button"
                className={lawFilter === 'all' ? 'active-pill' : ''}
                onClick={() => setLawFilter('all')}
              >
                All ({LAWS.length})
              </button>
              <button
                type="button"
                className={lawFilter === 'pakistan' ? 'active-pill' : ''}
                onClick={() => setLawFilter('pakistan')}
              >
                Pakistan
              </button>
              <button
                type="button"
                className={lawFilter === 'international' ? 'active-pill' : ''}
                onClick={() => setLawFilter('international')}
              >
                International
              </button>
            </div>
          </div>

          <div className="laws-grid">
            {filteredLaws.map(law => (
              <article className="law-card" key={law.id}>
                <div className="law-head">
                  <span className={`law-badge ${law.jurisdiction}`}>
                    {law.badge}
                  </span>
                  <span className="law-year">{law.year}</span>
                </div>

                <h3>{law.title}</h3>
                <p className="law-summary">{law.summary}</p>

                <ul className="law-points">
                  {law.keyPoints.map((point, idx) => (
                    <li key={idx}>{point}</li>
                  ))}
                </ul>

                <div className="law-relevance">
                  <Scale size={14} />
                  <span>{law.relevance}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="cta">
          <div>
            <div className="eyebrow">A CLEARER PICTURE STARTS LOCALLY</div>
            <h2>Your observation matters.</h2>
            <p>
              Help your community build a richer picture of the air around
              them.
            </p>
          </div>

          <button className="button" onClick={() => setModal(true)}>
            <Plus size={16} /> Report pollution
          </button>
        </section>
      </main>

      {/* FOOTER */}
      <footer>
        <b>
          AirWatch <em>AI</em>
        </b>
        <span>Community-powered environmental intelligence</span>
        <span>Open-Meteo / CAMS · OpenStreetMap</span>
      </footer>

      {/* REPORT MODAL */}
      {modal && (
        <div className="backdrop" onClick={() => setModal(false)}>
          <form
            className="modal"
            onSubmit={submit}
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              className="close"
              onClick={() => setModal(false)}
              aria-label="Close modal"
            >
              ×
            </button>

            <div className="eyebrow">COMMUNITY REPORT</div>
            <h2>What are you noticing?</h2>
            <p>
              Reports remain pending until reviewed by a human moderator.
            </p>

            {/* CATEGORY */}
            <label>
              Observation type
              <select
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
              >
                <option value="smoke">Smoke</option>
                <option value="dust">Dust</option>
                <option value="burning">Open burning</option>
                <option value="industrial">Industrial emissions</option>
                <option value="other">Other</option>
              </select>
            </label>

            {/* LOCATION NAME */}
            <label>
              Location name
              <input
                value={form.location_name}
                onChange={e =>
                  setForm({ ...form, location_name: e.target.value })
                }
                placeholder="Neighborhood or nearby landmark"
              />
            </label>

            {/* COORDINATES */}
            <div className="form-row">
              <label>
                Latitude
                <input
                  type="number"
                  step="any"
                  required
                  value={form.latitude}
                  onChange={e =>
                    setForm({ ...form, latitude: Number(e.target.value) })
                  }
                />
              </label>

              <label>
                Longitude
                <input
                  type="number"
                  step="any"
                  required
                  value={form.longitude}
                  onChange={e =>
                    setForm({ ...form, longitude: Number(e.target.value) })
                  }
                />
              </label>
            </div>

            {/* ANONYMOUS REPORTING */}
            <label className="anonymous-option">
              <input
                type="checkbox"
                checked={form.is_anonymous}
                onChange={e =>
                  setForm({ ...form, is_anonymous: e.target.checked })
                }
              />
              <span>Submit anonymously</span>
            </label>

            <small className="form-note">
              <ShieldCheck size={14} />
              <span>
                Do not include private or identifying information. Anonymous
                reporting does not guarantee that server logs contain no
                technical information.
              </span>
            </small>

            {/* DESCRIPTION */}
            <label>
              Description
              <textarea
                minLength="10"
                maxLength="1200"
                required
                value={form.description}
                onChange={e =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Describe what you observed, when, and for how long…"
              />
            </label>

            <button
              className="button submit"
              type="submit"
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : 'Submit for human review →'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
