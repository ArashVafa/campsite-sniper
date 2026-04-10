import { useState, useEffect } from "react"
import axios from "axios"

const API = "http://localhost:8000"

const PATTERNS = [
  { value: "summer_weekends", label: "Summer weekends",        desc: "Fri + Sat nights" },
  { value: "any_weekend",     label: "Any weekend",            desc: "Sat + Sun nights" },
  { value: "weekend_friday",  label: "Weekend + Friday",       desc: "Fri + Sat + Sun nights" },
  { value: "weekdays_only",   label: "Weekdays only",          desc: "Mon–Thu nights" },
  { value: "any_consecutive", label: "Any consecutive nights", desc: "Any nights in range" },
  { value: "exact",           label: "Exact dates",            desc: "Manual date entry" },
]

// ── Auth helpers ─────────────────────────────────────────────────────────

function getToken() { return localStorage.getItem("cs_token") }
function setToken(t) { localStorage.setItem("cs_token", t) }
function clearToken() { localStorage.removeItem("cs_token") }

function authAxios() {
  return axios.create({ headers: { Authorization: `Bearer ${getToken()}` } })
}

// ── Auth screens ──────────────────────────────────────────────────────────

function AuthScreen({ onLogin }) {
  const [mode, setMode]       = useState("login") // "login" | "register"
  const [email, setEmail]     = useState("")
  const [name, setName]       = useState("")
  const [password, setPassword] = useState("")
  const [error, setError]     = useState("")
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setError("")
    setLoading(true)
    try {
      const url = mode === "login" ? `${API}/api/auth/login` : `${API}/api/auth/register`
      const body = mode === "login" ? { email, password } : { email, name, password }
      const resp = await axios.post(url, body)
      setToken(resp.data.token)
      onLogin(resp.data.user)
    } catch (e) {
      setError(e.response?.data?.detail || "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", fontFamily: "system-ui" }}>
      <div style={{ ...cardStyle, width: 360, padding: "2rem" }}>
        <h2 style={{ margin: "0 0 1.5rem", textAlign: "center" }}>🏕 Campsite Sniper</h2>

        <div style={{ display: "flex", marginBottom: "1.5rem", borderRadius: 8, overflow: "hidden", border: "1px solid #e2e8f0" }}>
          {["login", "register"].map(m => (
            <button key={m} onClick={() => { setMode(m); setError("") }}
              style={{ flex: 1, padding: "0.6rem", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.9rem",
                background: mode === m ? "#2563eb" : "#fff", color: mode === m ? "#fff" : "#64748b" }}>
              {m === "login" ? "Sign In" : "Create Account"}
            </button>
          ))}
        </div>

        {mode === "register" && (
          <>
            <label style={labelStyle}>Name</label>
            <input style={inputStyle} placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
          </>
        )}

        <label style={labelStyle}>Email</label>
        <input style={inputStyle} type="email" placeholder="you@example.com"
          value={email} onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()} />

        <label style={labelStyle}>Password</label>
        <input style={inputStyle} type="password" placeholder="••••••••"
          value={password} onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()} />

        {error && <div style={{ color: "#dc2626", fontSize: "0.88rem", marginBottom: 10 }}>{error}</div>}

        <button onClick={submit} disabled={loading} style={{ ...btnStyle("#2563eb"), width: "100%", padding: "0.65rem" }}>
          {loading ? "…" : mode === "login" ? "Sign In" : "Create Account"}
        </button>
      </div>
    </div>
  )
}

// ── Profile modal ─────────────────────────────────────────────────────────

function ProfileModal({ user, onClose, onUpdated }) {
  const [ntfy, setNtfy]       = useState(user.ntfy_topic || "")
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await authAxios().patch(`${API}/api/auth/profile`, { ntfy_topic: ntfy })
      onUpdated({ ...user, ntfy_topic: ntfy })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {/* ignore */} finally { setSaving(false) }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ ...cardStyle, width: 380, padding: "1.75rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <h3 style={{ margin: 0 }}>Profile</h3>
          <button onClick={onClose} style={{ ...btnStyle("#94a3b8"), padding: "0.2rem 0.6rem" }}>✕</button>
        </div>

        <div style={{ marginBottom: "1rem", color: "#374151" }}>
          <div style={{ fontWeight: 600 }}>{user.name}</div>
          <div style={{ fontSize: "0.88rem", color: "#64748b" }}>{user.email}</div>
        </div>

        <label style={labelStyle}>
          ntfy.sh topic <span style={{ fontWeight: 400, color: "#94a3b8" }}>(optional — for push notifications)</span>
        </label>
        <input style={inputStyle} placeholder="e.g. my-campsite-alerts"
          value={ntfy} onChange={e => setNtfy(e.target.value)} />
        {ntfy && (
          <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: -8, marginBottom: 8 }}>
            Subscribe at: <a href={`https://ntfy.sh/${ntfy}`} target="_blank" rel="noreferrer" style={{ color: "#2563eb" }}>ntfy.sh/{ntfy}</a>
          </div>
        )}

        <button onClick={save} disabled={saving} style={btnStyle("#16a34a")}>
          {saved ? "Saved ✓" : saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  )
}

// ── Main app ──────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser]     = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [showProfile, setShowProfile] = useState(false)

  // Check stored token on load
  useEffect(() => {
    const token = getToken()
    if (!token) { setAuthChecked(true); return }
    axios.get(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { setUser(r.data); setAuthChecked(true) })
      .catch(() => { clearToken(); setAuthChecked(true) })
  }, [])

  const logout = () => { clearToken(); setUser(null) }

  if (!authChecked) return null // brief flash prevention
  if (!user) return <AuthScreen onLogin={u => setUser(u)} />

  return (
    <>
      <MainApp user={user} onLogout={logout}
        onOpenProfile={() => setShowProfile(true)} />
      {showProfile && (
        <ProfileModal user={user}
          onClose={() => setShowProfile(false)}
          onUpdated={u => setUser(u)} />
      )}
    </>
  )
}

// ── Main logged-in view ───────────────────────────────────────────────────

function MainApp({ user, onLogout, onOpenProfile }) {
  const [watches, setWatches]   = useState([])
  const [activity, setActivity] = useState([])
  const [stats, setStats]       = useState({})
  const [showForm, setShowForm] = useState(false)

  // ── Campground search ───────────────────────────────────
  const [searchQuery,   setSearchQuery]   = useState("")
  const [searchRadius,  setSearchRadius]  = useState(50)
  const [searchResults, setSearchResults] = useState([])
  const [searching,     setSearching]     = useState(false)
  const [searchError,   setSearchError]   = useState("")

  // ── Selected campgrounds ────────────────────────────────
  const [selectedCampgrounds, setSelectedCampgrounds] = useState([])

  // ── Date params ─────────────────────────────────────────
  const [dateStart,        setDateStart]        = useState("")
  const [dateEnd,          setDateEnd]          = useState("")
  const [selectedPatterns, setSelectedPatterns] = useState(["summer_weekends"])
  const [minNights,        setMinNights]        = useState(2)
  const [maxNights,        setMaxNights]        = useState("")
  const [exactDates,       setExactDates]       = useState("")

  // ── Preview ─────────────────────────────────────────────
  const [preview,    setPreview]    = useState(null)
  const [previewing, setPreviewing] = useState(false)

  const ax = authAxios()

  const fetchAll = async () => {
    try {
      const [w, a, s] = await Promise.all([
        ax.get(`${API}/api/watches`),
        ax.get(`${API}/api/activity`),
        ax.get(`${API}/api/stats`),
      ])
      setWatches(w.data)
      setActivity(a.data)
      setStats(s.data)
    } catch { /* token expired handled by auth layer */ }
  }

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 30000)
    return () => clearInterval(interval)
  }, [])

  // Auto-expand date combos
  useEffect(() => {
    const nonExact = selectedPatterns.filter(p => p !== "exact")
    if (nonExact.length === 0 || !dateStart || !dateEnd) { setPreview(null); return }
    let cancelled = false
    const run = async () => {
      setPreviewing(true)
      try {
        const responses = await Promise.all(
          nonExact.map(p => axios.post(`${API}/api/dates/expand`, {
            start: dateStart, end: dateEnd, pattern: p,
            min_nights: Number(minNights),
            max_nights: maxNights ? Number(maxNights) : null,
          }))
        )
        const seen = new Set()
        const merged = []
        for (const resp of responses)
          for (const combo of resp.data.combinations || []) {
            const key = combo.join(",")
            if (!seen.has(key)) { seen.add(key); merged.push(combo) }
          }
        merged.sort((a, b) => a[0].localeCompare(b[0]))
        const allDates = [...new Set(merged.flat())].sort()
        if (!cancelled) setPreview({ combinations: merged, all_dates: allDates, total_combinations: merged.length, total_dates: allDates.length })
      } catch {
        if (!cancelled) setPreview(null)
      } finally {
        if (!cancelled) setPreviewing(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [dateStart, dateEnd, selectedPatterns.join(","), minNights, maxNights]) // eslint-disable-line

  const searchCampgrounds = async () => {
    if (!searchQuery.trim()) return
    setSearching(true); setSearchError(""); setSearchResults([])
    try {
      const resp = await ax.get(`${API}/api/campgrounds/search`, { params: { q: searchQuery, radius: searchRadius } })
      if (resp.data.error) { setSearchError(resp.data.error) }
      else {
        const results = resp.data.results || []
        setSearchResults(results)
        if (results.length === 0) setSearchError("No campgrounds found in that area")
      }
    } catch (e) {
      setSearchError("Search failed: " + (e.response?.data?.detail || e.message))
    } finally { setSearching(false) }
  }

  const addCampground = async (facility) => {
    if (selectedCampgrounds.find(c => c.id === facility.id)) return
    setSelectedCampgrounds(prev => [...prev, { ...facility, minStay: 1, loadingAttrs: true }])
    try {
      const resp = await ax.get(`${API}/api/campgrounds/${facility.id}/attributes`)
      const ms = resp.data.min_stay || 1
      setSelectedCampgrounds(prev => prev.map(c => c.id === facility.id ? { ...c, minStay: ms, loadingAttrs: false } : c))
      if (ms > 1 && Number(minNights) < ms) setMinNights(ms)
    } catch {
      setSelectedCampgrounds(prev => prev.map(c => c.id === facility.id ? { ...c, loadingAttrs: false } : c))
    }
  }

  const removeCampground = (id) => setSelectedCampgrounds(prev => prev.filter(c => c.id !== id))

  const togglePattern = (value) =>
    setSelectedPatterns(prev => prev.includes(value) ? prev.filter(p => p !== value) : [...prev, value])

  const resetForm = () => {
    setSelectedCampgrounds([]); setSearchQuery(""); setSearchResults([]); setSearchError("")
    setDateStart(""); setDateEnd(""); setSelectedPatterns(["summer_weekends"])
    setMinNights(2); setMaxNights(""); setExactDates(""); setPreview(null)
  }

  const hasExact    = selectedPatterns.includes("exact")
  const hasNonExact = selectedPatterns.some(p => p !== "exact")
  const maxMinStay  = Math.max(1, ...selectedCampgrounds.map(c => c.minStay || 1))

  const saveWatch = async () => {
    if (selectedCampgrounds.length === 0) { alert("Please select at least one campground"); return }
    if (selectedPatterns.length === 0)    { alert("Please select at least one date pattern"); return }

    let dates, dateCombinations
    if (!hasNonExact && hasExact) {
      dates = exactDates.split(",").map(d => d.trim()).filter(Boolean)
      if (dates.length === 0) { alert("Please enter at least one date"); return }
      dateCombinations = [dates]
    } else {
      if (!preview || preview.total_combinations === 0) { alert("No date combinations found. Adjust your date range or patterns."); return }
      dates = preview.all_dates
      dateCombinations = preview.combinations
      if (hasExact && exactDates.trim()) {
        const extra = exactDates.split(",").map(d => d.trim()).filter(Boolean)
        if (extra.length > 0) {
          dateCombinations = [...dateCombinations, extra]
          dates = [...new Set([...dates, ...extra])].sort()
        }
      }
    }

    try {
      await Promise.all(selectedCampgrounds.map(cg =>
        ax.post(`${API}/api/watches`, {
          campground_id: cg.id, name: cg.name, dates,
          min_nights: Number(minNights),
          max_nights: maxNights ? Number(maxNights) : null,
          date_combinations: dateCombinations,
          patterns: selectedPatterns,
          pattern: selectedPatterns[0],
          search_location: [cg.city, cg.state].filter(Boolean).join(", "),
          min_stay_required: cg.minStay > 1 ? cg.minStay : null,
        })
      ))
      setShowForm(false); resetForm(); fetchAll()
    } catch (e) {
      alert("Error saving: " + (e.response?.data?.detail || e.message))
    }
  }

  const removeWatch = async (watchId) => {
    try { await ax.delete(`${API}/api/watches/${watchId}`); fetchAll() }
    catch (e) { alert("Error removing: " + (e.response?.data?.detail || e.message)) }
  }

  const watchPatternLabels = (w) => {
    const list = w.patterns || (w.pattern ? [w.pattern] : [])
    return list.map(v => PATTERNS.find(p => p.value === v)?.label || v)
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "2rem", fontFamily: "system-ui" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0 }}>🏕 Campsite Sniper</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={onOpenProfile} style={{ ...btnStyle("#64748b"), fontSize: "0.85rem" }}>
            {user.name}
          </button>
          <button onClick={onLogout} style={{ ...btnStyle("#94a3b8"), fontSize: "0.85rem" }}>Sign out</button>
          <button onClick={() => { setShowForm(!showForm); if (showForm) resetForm() }} style={btnStyle("#2563eb")}>
            {showForm ? "Cancel" : "+ Add Watch"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
        <StatCard label="Snapshots"           value={stats.total_snapshots ?? 0} />
        <StatCard label="Cancellations found" value={stats.total_cancellations ?? 0} />
        <StatCard label="Last poll"           value={stats.last_poll ? stats.last_poll.slice(11, 19) : "—"} />
      </div>

      {/* ── Form ─────────────────────────────────────────── */}
      {showForm && (
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>New Watch</h3>

          {/* Search */}
          <label style={labelStyle}>Search Campgrounds</label>
          <div style={{ display: "flex", gap: 8, marginBottom: "0.5rem" }}>
            <input style={{ ...inputStyle, marginBottom: 0, flex: 1 }} placeholder="e.g. Big Sur, CA"
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && searchCampgrounds()} />
            <select value={searchRadius} onChange={e => setSearchRadius(Number(e.target.value))}
              style={{ ...inputStyle, marginBottom: 0, width: 110 }}>
              <option value={10}>10 miles</option>
              <option value={25}>25 miles</option>
              <option value={50}>50 miles</option>
              <option value={100}>100 miles</option>
            </select>
            <button onClick={searchCampgrounds} disabled={searching} style={btnStyle("#2563eb")}>
              {searching ? "…" : "Search"}
            </button>
          </div>

          {searchError && <div style={{ color: "#dc2626", fontSize: "0.88rem", marginBottom: 8 }}>{searchError}</div>}

          {searchResults.length > 0 && (
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: "0.75rem", maxHeight: 220, overflowY: "auto" }}>
              {searchResults.map(r => {
                const added = selectedCampgrounds.some(c => c.id === r.id)
                return (
                  <div key={r.id} onClick={() => !added && addCampground(r)}
                    style={{ padding: "0.55rem 0.9rem", cursor: added ? "default" : "pointer",
                      borderBottom: "1px solid #f1f5f9", display: "flex",
                      justifyContent: "space-between", alignItems: "center", opacity: added ? 0.5 : 1 }}
                    onMouseEnter={e => { if (!added) e.currentTarget.style.background = "#f8fafc" }}
                    onMouseLeave={e => { e.currentTarget.style.background = "" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.93rem" }}>{r.name}</div>
                      <div style={{ fontSize: "0.78rem", color: "#64748b" }}>{[r.city, r.state].filter(Boolean).join(", ")}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {r.distance != null && <span style={{ fontSize: "0.83rem", color: "#64748b" }}>{r.distance} mi</span>}
                      {added ? <span style={{ fontSize: "0.78rem", color: "#16a34a" }}>✓ Added</span>
                              : <span style={{ fontSize: "0.78rem", color: "#2563eb" }}>+ Add</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {selectedCampgrounds.length > 0 && (
            <div style={{ marginBottom: "0.75rem" }}>
              {selectedCampgrounds.map(cg => (
                <div key={cg.id} style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8,
                  padding: "0.5rem 0.9rem", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{cg.name}</span>
                    <span style={{ color: "#555", marginLeft: 8, fontSize: "0.85rem" }}>
                      {[cg.city, cg.state].filter(Boolean).join(", ")}{cg.distance ? ` · ${cg.distance} mi` : ""}
                    </span>
                    {cg.loadingAttrs && <span style={{ color: "#64748b", marginLeft: 8, fontSize: "0.78rem" }}>checking…</span>}
                    {!cg.loadingAttrs && cg.minStay > 1 && <span style={{ ...minStayBadge, marginLeft: 8 }}>⚠ {cg.minStay} night min</span>}
                  </div>
                  <button onClick={() => removeCampground(cg.id)}
                    style={{ ...btnStyle("#94a3b8"), padding: "0.2rem 0.55rem", fontSize: "0.8rem" }}>✕</button>
                </div>
              ))}
            </div>
          )}

          <div style={divider} />

          {/* Date range */}
          <label style={labelStyle}>Date Range</label>
          <div style={{ display: "flex", gap: 8, marginBottom: "0.75rem" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: 2 }}>Start</div>
              <input type="date" style={{ ...inputStyle, marginBottom: 0 }} value={dateStart} onChange={e => setDateStart(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: 2 }}>End</div>
              <input type="date" style={{ ...inputStyle, marginBottom: 0 }} value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
            </div>
          </div>

          {/* Patterns */}
          <label style={labelStyle}>Patterns <span style={{ fontWeight: 400, color: "#94a3b8" }}>(select one or more)</span></label>
          <div style={{ marginBottom: "0.75rem" }}>
            {PATTERNS.map(p => (
              <label key={p.value} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, cursor: "pointer" }}>
                <input type="checkbox" checked={selectedPatterns.includes(p.value)} onChange={() => togglePattern(p.value)} />
                <span style={{ fontWeight: 500, fontSize: "0.9rem" }}>{p.label}</span>
                <span style={{ color: "#64748b", fontSize: "0.8rem" }}>— {p.desc}</span>
              </label>
            ))}
          </div>

          {hasExact && (
            <>
              <label style={labelStyle}>Exact dates (comma-separated, YYYY-MM-DD)</label>
              <input style={inputStyle} placeholder="e.g. 2026-08-15, 2026-08-16"
                value={exactDates} onChange={e => setExactDates(e.target.value)} />
            </>
          )}

          {hasNonExact && (
            <div style={{ display: "flex", gap: 12, marginBottom: "0.75rem", alignItems: "flex-start" }}>
              <div>
                <label style={labelStyle}>Min nights</label>
                <input type="number" min={1} max={14} style={{ ...inputStyle, marginBottom: 0, width: 80 }}
                  value={minNights} onChange={e => setMinNights(Number(e.target.value))} />
                {maxMinStay > 1 && Number(minNights) < maxMinStay && (
                  <div style={{ color: "#dc2626", fontSize: "0.76rem", marginTop: 3 }}>⚠ Must be ≥ {maxMinStay}</div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Max nights <span style={{ fontWeight: 400, color: "#94a3b8" }}>(optional)</span></label>
                <input type="number" min={1} max={30} style={{ ...inputStyle, marginBottom: 0, width: 100 }}
                  value={maxNights} placeholder="—" onChange={e => setMaxNights(e.target.value)} />
              </div>
            </div>
          )}

          {hasNonExact && (
            <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "0.55rem 0.9rem", marginBottom: "0.75rem", fontSize: "0.9rem" }}>
              {previewing ? (
                <span style={{ color: "#64748b" }}>Calculating combinations…</span>
              ) : preview && preview.total_combinations > 0 ? (
                <span style={{ color: "#1d4ed8", fontWeight: 600 }}>
                  Will watch {preview.total_combinations} combination{preview.total_combinations !== 1 ? "s" : ""} · {preview.total_dates} unique dates
                  {selectedCampgrounds.length > 1 && ` · ${selectedCampgrounds.length} campgrounds = ${selectedCampgrounds.length} watches`}
                </span>
              ) : (
                <span style={{ color: "#64748b" }}>Select a date range to preview combinations</span>
              )}
            </div>
          )}

          <div style={{ marginTop: "1rem" }}>
            <button onClick={saveWatch} style={btnStyle("#16a34a")}>
              Save {selectedCampgrounds.length > 1 ? `${selectedCampgrounds.length} Watches` : "Watch"}
            </button>
          </div>
        </div>
      )}

      {/* ── Watches ───────────────────────────────────────── */}
      <h2>Active Watches ({watches.length})</h2>
      {watches.length === 0 && <p style={{ color: "#888" }}>No watches yet. Add one above!</p>}
      {watches.map(w => (
        <div key={w.id} style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <strong style={{ fontSize: "1.1rem" }}>{w.name}</strong>
                {w.min_stay_required > 1 && <span style={minStayBadge}>⚠ {w.min_stay_required} night minimum</span>}
              </div>
              <div style={{ color: "#555", marginTop: 4, fontSize: "0.87rem" }}>
                ID: {w.campground_id}
                {w.search_location ? ` · ${w.search_location}` : ""}
                {" · "}Min {w.min_nights} night{w.min_nights > 1 ? "s" : ""}
              </div>
              {watchPatternLabels(w).length > 0 && (
                <div style={{ marginTop: 5, display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {watchPatternLabels(w).map(lbl => <span key={lbl} style={patternTag}>{lbl}</span>)}
                </div>
              )}
              <div style={{ marginTop: 6 }}>
                {w.date_combinations && w.date_combinations.length > 0 ? (
                  <span style={{ ...dateBadge, background: "#f0fdf4", color: "#166534" }}>
                    {w.date_combinations.length} combination{w.date_combinations.length !== 1 ? "s" : ""} · {w.dates.length} dates watched
                  </span>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {w.dates.slice(0, 8).map(d => <span key={d} style={dateBadge}>{d}</span>)}
                    {w.dates.length > 8 && <span style={dateBadge}>+{w.dates.length - 8} more</span>}
                  </div>
                )}
              </div>
            </div>
            <button onClick={() => removeWatch(w.id)} style={btnStyle("#dc2626")}>Remove</button>
          </div>
        </div>
      ))}

      {/* ── Activity ──────────────────────────────────────── */}
      <h2>Recent Cancellations</h2>
      {activity.length === 0 && <p style={{ color: "#888" }}>No cancellations detected yet — poller is watching!</p>}
      {activity.map((a, i) => (
        <div key={i} style={{ ...cardStyle, borderLeft: "4px solid #16a34a" }}>
          <strong>🏕 Site {a.site_id}</strong> at campground {a.campground_id}
          <div style={{ color: "#555", marginTop: 4 }}>
            Date: {a.date} · Detected: {a.detected_at.slice(0, 19).replace("T", " ")}
          </div>
          <a href={`https://www.recreation.gov/camping/campgrounds/${a.campground_id}`}
            target="_blank" rel="noreferrer"
            style={{ color: "#2563eb", marginTop: 6, display: "inline-block" }}>
            Book now →
          </a>
        </div>
      ))}

    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div style={{ flex: 1, background: "#f1f5f9", borderRadius: 8, padding: "0.75rem 1rem" }}>
      <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: "0.8rem", color: "#64748b" }}>{label}</div>
    </div>
  )
}

const cardStyle = {
  background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
  padding: "1rem 1.25rem", marginBottom: "0.75rem", boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
}
const divider    = { borderTop: "1px solid #f1f5f9", margin: "0.75rem 0" }
const dateBadge  = { background: "#eff6ff", color: "#1d4ed8", borderRadius: 6, padding: "2px 8px", fontSize: "0.85rem" }
const patternTag = { background: "#f1f5f9", color: "#475569", borderRadius: 5, padding: "2px 8px", fontSize: "0.78rem", fontWeight: 500 }
const minStayBadge = { background: "#fef3c7", color: "#92400e", borderRadius: 4, padding: "2px 7px", fontSize: "0.78rem", fontWeight: 600 }
const inputStyle = {
  width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #cbd5e1",
  borderRadius: 6, fontSize: "0.95rem", marginBottom: "0.75rem", boxSizing: "border-box",
}
const labelStyle = { display: "block", marginBottom: 4, fontSize: "0.85rem", fontWeight: 600, color: "#374151" }
function btnStyle(bg) {
  return { background: bg, color: "#fff", border: "none", borderRadius: 6,
    padding: "0.5rem 1rem", cursor: "pointer", fontSize: "0.9rem", fontWeight: 600 }
}
