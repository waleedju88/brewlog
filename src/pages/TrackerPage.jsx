import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import s from './TrackerPage.module.css'

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}
function formatDateTime(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}
function isoToLocalInput(iso) {
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function localInputToISO(val) {
  return new Date(val).toISOString()
}

export default function TrackerPage({ session }) {
  const userId = session.user.id

  const [budget, setBudget]         = useState(null)
  const [totalDrank, setTotalDrank] = useState(0)
  const [todayCups, setTodayCups]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [popping, setPopping]       = useState(false)
  const [showSetup, setShowSetup]   = useState(false)
  const [budgetInput, setBudgetInput] = useState('')
  const [saving, setSaving]         = useState(false)
  const [editingCup, setEditingCup] = useState(null)
  const [editValue, setEditValue]   = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const remaining = budget !== null ? Math.max(budget - totalDrank, 0) : null
  const isDone    = budget !== null && remaining === 0
  const pct       = budget > 0 ? Math.min((totalDrank / budget) * 100, 100) : 0

  const load = useCallback(async () => {
    setLoading(true)
    const { data: profile } = await supabase
      .from('profiles').select('cup_budget').eq('id', userId).single()
    setBudget(profile?.cup_budget ?? null)

    const { count } = await supabase
      .from('cup_logs').select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
    setTotalDrank(count || 0)

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

  function openEdit(cup) {
    setEditingCup(cup)
    setEditValue(isoToLocalInput(cup.logged_at))
  }

  async function handleSaveEdit() {
    if (!editingCup || !editValue) return
    setEditSaving(true)
    const newISO = localInputToISO(editValue)
    await supabase.from('cup_logs').update({ logged_at: newISO }).eq('id', editingCup.id)
    setTodayCups(prev =>
      prev.map(c => c.id === editingCup.id ? { ...c, logged_at: newISO } : c)
        .sort((a, b) => new Date(b.logged_at) - new Date(a.logged_at))
    )
    setEditSaving(false)
    setEditingCup(null)
  }

  if (loading) return <PageLoader />

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
      <div className={s.header + ' fade-up'}>
        <p className={s.dateLabel}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <h1 className={s.title}>BrewLog</h1>
      </div>

      <div className={s.counterBox + ' fade-up-2'}>
        <span
          className={s.bigNum + (popping ? ' ' + s.pop : '')}
          style={{ color: isDone ? 'var(--red)' : remaining <= 5 ? '#e67e22' : 'var(--gold-light)' }}
        >
          {remaining}
        </span>
        <p className={s.counterLabel}>
          {isDone ? 'budget reached!'
            : remaining === 1 ? 'cup remaining in budget'
            : 'cups remaining in budget'}
        </p>
        <p className={s.subLabel}>{totalDrank} of {budget} cups used</p>
      </div>

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
        <div className={s.barLabels}><span>0</span><span>{budget}</span></div>
      </div>

      {todayCups.length > 0 && (
        <div className={s.timeline + ' fade-up-3'}>
          <p className={s.timelineTitle}>Today's cups — tap to edit</p>
          {todayCups.map((cup, i) => (
            <button key={cup.id} className={s.timelineRow} onClick={() => openEdit(cup)}>
              <span className={s.timelineCup}>☕</span>
              <span className={s.timelineTime}>{formatTime(cup.logged_at)}</span>
              {i === 0 && <span className={s.latestBadge}>latest</span>}
              <span className={s.editHint}>✎</span>
            </button>
          ))}
        </div>
      )}

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
            <input className={s.modalInput} type="number" min="1" placeholder="Or type any number…"
              value={budgetInput} onChange={e => setBudgetInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveBudget()} />
            <button className={s.modalBtn} onClick={handleSaveBudget} disabled={saving}>
              {saving ? '…' : 'Save Budget'}
            </button>
            <button className={s.modalCancel} onClick={() => setShowSetup(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Edit time modal */}
      {editingCup && (
        <div className={s.overlay} onClick={() => setEditingCup(null)}>
          <div className={s.modal} onClick={e => e.stopPropagation()}>
            <h2 className={s.modalTitle}>Edit Cup Time</h2>
            <p className={s.modalHint}>Correct the date & time for this cup</p>
            <div className={s.editPreview}>
              <span>☕</span>
              <span>{formatDateTime(editingCup.logged_at)}</span>
              <span className={s.editArrow}>→</span>
              <span>{editValue ? formatDateTime(localInputToISO(editValue)) : '—'}</span>
            </div>
            <input
              className={s.modalInput}
              type="datetime-local"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              max={isoToLocalInput(new Date().toISOString())}
            />
            <button className={s.modalBtn} onClick={handleSaveEdit} disabled={editSaving}>
              {editSaving ? '…' : '✓ Save Time'}
            </button>
            <button className={s.modalCancel} onClick={() => setEditingCup(null)}>Cancel</button>
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
        <input className={s.modalInput} type="number" min="1" placeholder="Or type any number…"
          value={budgetInput} onChange={e => setBudgetInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSave()} />
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
