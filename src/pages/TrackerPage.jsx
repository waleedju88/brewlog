import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import s from './TrackerPage.module.css'

function localDayBounds() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  return { start: start.toISOString(), end: end.toISOString() }
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

export default function TrackerPage({ session }) {
  const userId = session.user.id

  const [limit, setLimit]       = useState(null)
  const [todayCups, setTodayCups] = useState([]) // array of {id, logged_at}
  const [loading, setLoading]   = useState(true)
  const [popping, setPopping]   = useState(false)
  const [settingLimit, setSettingLimit] = useState(false)
  const [limitInput, setLimitInput]     = useState('')

  const drank     = todayCups.length
  const remaining = limit !== null ? Math.max(limit - drank, 0) : null
  const isDone    = limit !== null && remaining === 0

  const load = useCallback(async () => {
    setLoading(true)
    const { data: profile } = await supabase
      .from('profiles').select('daily_limit').eq('id', userId).single()
    setLimit(profile?.daily_limit ?? null)

    const { start, end } = localDayBounds()
    const { data: cups } = await supabase
      .from('cup_logs')
      .select('id, logged_at')
      .eq('user_id', userId)
      .gte('logged_at', start)
      .lte('logged_at', end)
      .order('logged_at', { ascending: false })
    setTodayCups(cups || [])
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  async function handleDrink() {
    if (isDone) return
    const { data } = await supabase
      .from('cup_logs')
      .insert({ user_id: userId })
      .select('id, logged_at')
      .single()
    if (data) {
      setTodayCups(prev => [data, ...prev])
      setPopping(true)
      setTimeout(() => setPopping(false), 400)
    }
  }

  async function handleUndo() {
    if (todayCups.length === 0) return
    const last = todayCups[0]
    await supabase.from('cup_logs').delete().eq('id', last.id)
    setTodayCups(prev => prev.slice(1))
  }

  async function handleSetLimit() {
    const n = parseInt(limitInput)
    if (isNaN(n) || n < 1) return
    await supabase.from('profiles').upsert({ id: userId, daily_limit: n })
    setLimit(n)
    setSettingLimit(false)
    setLimitInput('')
  }

  if (loading) return <PageLoader />

  return (
    <div className={s.page}>
      {/* Header */}
      <div className={s.header + ' fade-up'}>
        <p className={s.dateLabel}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <h1 className={s.title}>Today's Brew</h1>
      </div>

      {/* Cup grid */}
      {limit !== null && (
        <div className={s.cupGrid + ' fade-up-2'}>
          {Array.from({ length: limit }).map((_, i) => (
            <span key={i} className={i < drank ? s.cupDone : s.cupFresh}>☕</span>
          ))}
        </div>
      )}

      {/* Big counter */}
      <div className={s.counterBox + ' fade-up-2'}>
        <span
          className={s.bigNum + (popping ? ' ' + s.pop : '')}
          style={{ color: isDone ? 'var(--red)' : 'var(--gold-light)' }}
        >
          {limit !== null ? remaining : drank}
        </span>
        <p className={s.counterLabel}>
          {limit !== null
            ? isDone ? 'limit reached' : remaining === 1 ? 'cup remaining' : 'cups remaining'
            : drank === 1 ? 'cup today' : 'cups today'}
        </p>
      </div>

      {/* Progress bar */}
      {limit !== null && (
        <div className={s.barWrap + ' fade-up-3'}>
          <div className={s.barTrack}>
            <div className={s.barFill} style={{
              width: `${Math.min((drank / limit) * 100, 100)}%`,
              background: isDone
                ? 'linear-gradient(90deg,var(--red),#922b21)'
                : 'linear-gradient(90deg,var(--gold),#7b4a1e)'
            }} />
          </div>
          <p className={s.progressText}>{drank} of {limit} cups</p>
        </div>
      )}

      {/* Today's timeline */}
      {todayCups.length > 0 && (
        <div className={s.timeline + ' fade-up-3'}>
          <p className={s.timelineTitle}>Today's log</p>
          {todayCups.map((cup, i) => (
            <div key={cup.id} className={s.timelineRow}>
              <span className={s.timelineCup}>☕</span>
              <span className={s.timelineTime}>{formatTime(cup.logged_at)}</span>
              {i === 0 && <span className={s.latestBadge}>latest</span>}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className={s.actions + ' fade-up-4'}>
        {!isDone || limit === null ? (
          <button className={s.drinkBtn} onClick={handleDrink}>☕ I drank a cup</button>
        ) : (
          <div className={s.doneBox}>
            <p className={s.doneText}>🚫 Daily limit reached!</p>
          </div>
        )}

        {drank > 0 && (
          <button className={s.undoBtn} onClick={handleUndo}>↩ Undo last cup</button>
        )}

        <button className={s.limitBtn} onClick={() => setSettingLimit(true)}>
          {limit !== null ? `⚙ Change limit (${limit})` : '⚙ Set daily limit'}
        </button>
      </div>

      {/* Limit modal */}
      {settingLimit && (
        <div className={s.overlay} onClick={() => setSettingLimit(false)}>
          <div className={s.modal} onClick={e => e.stopPropagation()}>
            <h2 className={s.modalTitle}>Set Daily Limit</h2>
            <div className={s.quickRow}>
              {[2, 3, 4, 5, 6].map(n => (
                <button
                  key={n} className={s.quickBtn}
                  onClick={() => setLimitInput(String(n))}
                  style={{
                    borderColor: limitInput === String(n) ? 'var(--gold)' : undefined,
                    color: limitInput === String(n) ? 'var(--gold-light)' : undefined
                  }}
                >{n}</button>
              ))}
            </div>
            <input
              className={s.modalInput} type="number" min="1" placeholder="Custom number…"
              value={limitInput} onChange={e => setLimitInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSetLimit()}
            />
            <button className={s.modalBtn} onClick={handleSetLimit}>Save</button>
            <button className={s.modalCancel} onClick={() => setSettingLimit(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

function PageLoader() {
  return (
    <div style={{ height: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 28, height: 28, border: '3px solid rgba(200,130,60,0.3)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )
}
