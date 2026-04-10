import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import s from './TrackerPage.module.css'

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

export default function TrackerPage({ session }) {
  const userId = session.user.id

  const [budget, setBudget]     = useState(null)  // total budget
  const [totalDrank, setTotalDrank] = useState(0) // all-time cups logged
  const [todayCups, setTodayCups]   = useState([])// today's cups [{id, logged_at}]
  const [loading, setLoading]   = useState(true)
  const [popping, setPopping]   = useState(false)
  const [showSetup, setShowSetup] = useState(false)
  const [budgetInput, setBudgetInput] = useState('')
  const [saving, setSaving]     = useState(false)

  const remaining = budget !== null ? Math.max(budget - totalDrank, 0) : null
  const isDone    = budget !== null && remaining === 0
  const pct       = budget > 0 ? Math.min((totalDrank / budget) * 100, 100) : 0

  const load = useCallback(async () => {
    setLoading(true)

    // Load profile
    const { data: profile } = await supabase
      .from('profiles').select('cup_budget').eq('id', userId).single()
    setBudget(profile?.cup_budget ?? null)

    // Total cups ever
    const { count } = await supabase
      .from('cup_logs').select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
    setTotalDrank(count || 0)

    // Today's cups
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString()
    const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString()
    const { data: cups } = await supabase
      .from('cup_logs').select('id, logged_at')
      .eq('user_id', userId)
      .gte('logged_at', start).lte('logged_at', end)
      .order('logged_at', { ascending: false })
    setTodayCups(cups || [])

    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  async function handleDrink() {
    if (isDone) return
    const { data } = await supabase
      .from('cup_logs').insert({ user_id: userId })
      .select('id, logged_at').single()
    if (data) {
      setTotalDrank(d => d + 1)
      setTodayCups(prev => [data, ...prev])
      setPopping(true)
      setTimeout(() => setPopping(false), 400)
    }
  }

  async function handleUndo() {
    if (todayCups.length === 0) return
    const last = todayCups[0]
    await supabase.from('cup_logs').delete().eq('id', last.id)
    setTotalDrank(d => Math.max(d - 1, 0))
    setTodayCups(prev => prev.slice(1))
  }

  async function handleSaveBudget() {
    const n = parseInt(budgetInput)
    if (isNaN(n) || n < 1) return
    setSaving(true)
    await supabase.from('profiles').upsert({ id: userId, cup_budget: n })
    setBudget(n)
    setSaving(false)
    setShowSetup(false)
    setBudgetInput('')
  }

  if (loading) return <PageLoader />

  // First time — no budget set yet
  if (budget === null) {
    return <SetupScreen
      budgetInput={budgetInput}
      setBudgetInput={setBudgetInput}
      onSave={handleSaveBudget}
      saving={saving}
    />
  }

  return (
    <div className={s.page}>
      {/* Header */}
      <div className={s.header + ' fade-up'}>
        <p className={s.dateLabel}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <h1 className={s.title}>BrewLog</h1>
      </div>

      {/* Big countdown */}
      <div className={s.counterBox + ' fade-up-2'}>
        <span
          className={s.bigNum + (popping ? ' ' + s.pop : '')}
          style={{ color: isDone ? 'var(--red)' : remaining <= 5 ? '#e67e22' : 'var(--gold-light)' }}
        >
          {remaining}
        </span>
        <p className={s.counterLabel}>
          {isDone
            ? 'budget reached!'
            : remaining === 1 ? 'cup remaining in budget'
            : 'cups remaining in budget'}
        </p>
        <p className={s.subLabel}>{totalDrank} of {budget} cups used</p>
      </div>

      {/* Progress arc / bar */}
      <div className={s.barWrap + ' fade-up-2'}>
        <div className={s.barTrack}>
          <div className={s.barFill} style={{
            width: `${pct}%`,
            background: isDone
              ? 'linear-gradient(90deg,var(--red),#922b21)'
              : pct > 80
              ? 'linear-gradient(90deg,#e67e22,#d35400)'
              : 'linear-gradient(90deg,var(--gold),#7b4a1e)'
          }} />
        </div>
        <div className={s.barLabels}>
          <span>0</span><span>{budget}</span>
        </div>
      </div>

      {/* Today's log */}
      {todayCups.length > 0 && (
        <div className={s.timeline + ' fade-up-3'}>
          <p className={s.timelineTitle}>Today's cups</p>
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
        {!isDone ? (
          <button className={s.drinkBtn} onClick={handleDrink}>☕ I drank a cup</button>
        ) : (
          <div className={s.doneBox}>
            <p className={s.doneEmoji}>🏁</p>
            <p className={s.doneText}>You've finished your budget of {budget} cups!</p>
            <button className={s.newBudgetBtn} onClick={() => { setBudgetInput(''); setShowSetup(true) }}>
              Set a new budget
            </button>
          </div>
        )}

        {todayCups.length > 0 && !isDone && (
          <button className={s.undoBtn} onClick={handleUndo}>↩ Undo last cup</button>
        )}

        {!isDone && (
          <button className={s.limitBtn} onClick={() => { setBudgetInput(String(budget)); setShowSetup(true) }}>
            ⚙ Change budget ({budget})
          </button>
        )}
      </div>

      {/* Budget modal */}
      {showSetup && (
        <div className={s.overlay} onClick={() => setShowSetup(false)}>
          <div className={s.modal} onClick={e => e.stopPropagation()}>
            <h2 className={s.modalTitle}>Set Cup Budget</h2>
            <p className={s.modalHint}>How many cups total do you want to track?</p>
            <div className={s.quickRow}>
              {[20, 30, 50, 100].map(n => (
                <button key={n} className={s.quickBtn}
                  onClick={() => setBudgetInput(String(n))}
                  style={{
                    borderColor: budgetInput === String(n) ? 'var(--gold)' : undefined,
                    color: budgetInput === String(n) ? 'var(--gold-light)' : undefined
                  }}
                >{n}</button>
              ))}
            </div>
            <input
              className={s.modalInput} type="number" min="1"
              placeholder="Or type any number…"
              value={budgetInput} onChange={e => setBudgetInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveBudget()}
            />
            <button className={s.modalBtn} onClick={handleSaveBudget} disabled={saving}>
              {saving ? '…' : 'Save Budget'}
            </button>
            <button className={s.modalCancel} onClick={() => setShowSetup(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

function SetupScreen({ budgetInput, setBudgetInput, onSave, saving }) {
  return (
    <div className={s.setupPage}>
      <div className={s.setupCard}>
        <span className={s.setupEmoji}>☕</span>
        <h1 className={s.setupTitle}>Welcome to BrewLog</h1>
        <p className={s.setupHint}>Set your total cup budget to get started. Every cup you log will count down from this number.</p>
        <div className={s.quickRow} style={{ justifyContent: 'center', marginBottom: 16 }}>
          {[20, 30, 50, 100].map(n => (
            <button key={n} className={s.quickBtn}
              onClick={() => setBudgetInput(String(n))}
              style={{
                borderColor: budgetInput === String(n) ? 'var(--gold)' : undefined,
                color: budgetInput === String(n) ? 'var(--gold-light)' : undefined
              }}
            >{n}</button>
          ))}
        </div>
        <input
          className={s.modalInput} type="number" min="1"
          placeholder="Or type any number…"
          value={budgetInput} onChange={e => setBudgetInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSave()}
        />
        <button className={s.modalBtn} onClick={onSave} disabled={saving || !budgetInput}>
          {saving ? '…' : "Let's go →"}
        </button>
      </div>
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
