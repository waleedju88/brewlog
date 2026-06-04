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
function localInputToISO(val) { return new Date(val).toISOString() }

export default function TrackerPage({ session }) {
  const userId = session.user.id

  const [activeGoal, setActiveGoal]   = useState(null)
  const [totalDrank, setTotalDrank]   = useState(0)
  const [todayCups, setTodayCups]     = useState([])
  const [loading, setLoading]         = useState(true)
  const [popping, setPopping]         = useState(false)

  // New goal setup
  const [showSetup, setShowSetup]     = useState(false)
  const [budgetInput, setBudgetInput] = useState('')
  const [titleInput, setTitleInput]   = useState('')
  const [saving, setSaving]           = useState(false)

  // Edit time
  const [editingCup, setEditingCup]   = useState(null)
  const [editValue, setEditValue]     = useState('')
  const [editSaving, setEditSaving]   = useState(false)

  // Close goal early
  const [showClose, setShowClose]     = useState(false)
  const [closing, setClosing]         = useState(false)

  const budget    = activeGoal?.budget ?? null
  const remaining = budget !== null ? Math.max(budget - totalDrank, 0) : null
  const isDone    = budget !== null && remaining === 0
  const pct       = budget > 0 ? Math.min((totalDrank / budget) * 100, 100) : 0

  const load = useCallback(async () => {
    setLoading(true)
    // Get active goal
    const { data: goals } = await supabase
      .from('goals').select('*').eq('user_id', userId).eq('status', 'active')
      .order('created_at', { ascending: false }).limit(1)
    const goal = goals?.[0] ?? null
    setActiveGoal(goal)

    if (goal) {
      // Count all cups for this goal
      const { count } = await supabase
        .from('cup_logs').select('*', { count: 'exact', head: true })
        .eq('goal_id', goal.id)
      setTotalDrank(count || 0)

      // Today's cups for this goal
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString()
      const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString()
      const { data: cups } = await supabase
        .from('cup_logs').select('id, logged_at')
        .eq('goal_id', goal.id)
        .gte('logged_at', start).lte('logged_at', end)
        .order('logged_at', { ascending: false })
      setTodayCups(cups || [])
    } else {
      setTotalDrank(0)
      setTodayCups([])
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  async function handleDrink() {
    if (isDone || !activeGoal) return
    const { data } = await supabase
      .from('cup_logs').insert({ user_id: userId, goal_id: activeGoal.id })
      .select('id, logged_at').single()
    if (data) {
      setTotalDrank(d => d + 1)
      setTodayCups(prev => [data, ...prev])
      setPopping(true)
      setTimeout(() => setPopping(false), 400)
      // Auto-complete if hit budget
      if (totalDrank + 1 >= budget) {
        await supabase.from('goals').update({ status: 'completed', ended_at: new Date().toISOString() }).eq('id', activeGoal.id)
        setActiveGoal(prev => ({ ...prev, status: 'completed', ended_at: new Date().toISOString() }))
      }
    }
  }

  async function handleUndo() {
    if (todayCups.length === 0) return
    const last = todayCups[0]
    await supabase.from('cup_logs').delete().eq('id', last.id)
    setTotalDrank(d => Math.max(d - 1, 0))
    setTodayCups(prev => prev.slice(1))
  }

  async function handleStartGoal() {
    const n = parseInt(budgetInput)
    if (isNaN(n) || n < 1) return
    setSaving(true)
    const { data } = await supabase.from('goals')
      .insert({ user_id: userId, budget: n, title: titleInput.trim() || null })
      .select('*').single()
    setActiveGoal(data)
    setTotalDrank(0)
    setTodayCups([])
    setSaving(false)
    setShowSetup(false)
    setBudgetInput('')
    setTitleInput('')
  }

  async function handleCloseGoal() {
    if (!activeGoal) return
    setClosing(true)
    await supabase.from('goals').update({ status: 'closed', ended_at: new Date().toISOString() }).eq('id', activeGoal.id)
    setActiveGoal(null)
    setTotalDrank(0)
    setTodayCups([])
    setClosing(false)
    setShowClose(false)
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

  // No active goal
  if (!activeGoal) {
    return <SetupScreen
      budgetInput={budgetInput} setBudgetInput={setBudgetInput}
      titleInput={titleInput} setTitleInput={setTitleInput}
      onSave={handleStartGoal} saving={saving}
    />
  }

  return (
    <div className={s.page}>
      <div className={s.header + ' fade-up'}>
        <p className={s.dateLabel}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <h1 className={s.title}>{activeGoal.title || 'BrewLog'}</h1>
        {activeGoal.title && <p className={s.goalSub}>Active Goal</p>}
      </div>

      <div className={s.counterBox + ' fade-up-2'}>
        <span
          className={s.bigNum + (popping ? ' ' + s.pop : '')}
          style={{ color: isDone ? 'var(--red)' : remaining <= 5 ? '#e67e22' : 'var(--gold-light)' }}
        >
          {remaining}
        </span>
        <p className={s.counterLabel}>
          {isDone ? 'goal reached!'
            : remaining === 1 ? 'cup remaining'
            : 'cups remaining'}
        </p>
        <p className={s.subLabel}>{totalDrank} of {budget} cups used</p>
      </div>

      <div className={s.barWrap + ' fade-up-2'}>
        <div className={s.barTrack}>
          <div className={s.barFill} style={{
            width: `${pct}%`,
            background: isDone ? 'linear-gradient(90deg,var(--red),#922b21)'
              : pct > 80 ? 'linear-gradient(90deg,#e67e22,#d35400)'
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
            <p className={s.doneText}>Goal "{activeGoal.title || `${budget} cups`}" completed!</p>
            <button className={s.newBudgetBtn} onClick={() => { setBudgetInput(''); setTitleInput(''); setShowSetup(true) }}>
              Start new goal
            </button>
          </div>
        )}

        {todayCups.length > 0 && !isDone && (
          <button className={s.undoBtn} onClick={handleUndo}>↩ Undo last cup</button>
        )}

        {!isDone && (
          <button className={s.closeBtn} onClick={() => setShowClose(true)}>
            ✕ Close this goal early
          </button>
        )}
      </div>

      {/* New goal modal */}
      {showSetup && (
        <div className={s.overlay} onClick={() => setShowSetup(false)}>
          <div className={s.modal} onClick={e => e.stopPropagation()}>
            <h2 className={s.modalTitle}>Start New Goal</h2>
            <p className={s.modalHint}>Name it and set your cup budget</p>
            <input className={s.modalInput} type="text" placeholder="Goal name (optional)…"
              value={titleInput} onChange={e => setTitleInput(e.target.value)} />
            <div className={s.quickRow}>
              {[20, 30, 50, 100].map(n => (
                <button key={n} className={s.quickBtn}
                  onClick={() => setBudgetInput(String(n))}
                  style={{ borderColor: budgetInput === String(n) ? 'var(--gold)' : undefined, color: budgetInput === String(n) ? 'var(--gold-light)' : undefined }}
                >{n}</button>
              ))}
            </div>
            <input className={s.modalInput} type="number" min="1" placeholder="Or type any number…"
              value={budgetInput} onChange={e => setBudgetInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleStartGoal()} />
            <button className={s.modalBtn} onClick={handleStartGoal} disabled={saving || !budgetInput}>
              {saving ? '…' : 'Start Goal'}
            </button>
            <button className={s.modalCancel} onClick={() => setShowSetup(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Close goal early modal */}
      {showClose && (
        <div className={s.overlay} onClick={() => setShowClose(false)}>
          <div className={s.modal} onClick={e => e.stopPropagation()}>
            <h2 className={s.modalTitle}>Close Goal Early?</h2>
            <p className={s.modalHint}>
              You've used {totalDrank} of {budget} cups. This goal will be saved as "closed early" in your Goals history.
            </p>
            <button className={s.modalBtnRed} onClick={handleCloseGoal} disabled={closing}>
              {closing ? '…' : 'Yes, close it'}
            </button>
            <button className={s.modalCancel} onClick={() => setShowClose(false)}>Cancel</button>
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
            <input className={s.modalInput} type="datetime-local" value={editValue}
              onChange={e => setEditValue(e.target.value)}
              max={isoToLocalInput(new Date().toISOString())} />
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

function SetupScreen({ budgetInput, setBudgetInput, titleInput, setTitleInput, onSave, saving }) {
  return (
    <div className={s.setupPage}>
      <div className={s.setupCard}>
        <span className={s.setupEmoji}>☕</span>
        <h1 className={s.setupTitle}>Start Your Goal</h1>
        <p className={s.setupHint}>Give your goal a name and set how many cups you want to track.</p>
        <input className={s.modalInput} type="text" placeholder="Goal name (optional)…"
          value={titleInput} onChange={e => setTitleInput(e.target.value)} style={{ marginBottom: 12 }} />
        <div className={s.quickRow} style={{ justifyContent: 'center', marginBottom: 16 }}>
          {[20, 30, 50, 100].map(n => (
            <button key={n} className={s.quickBtn}
              onClick={() => setBudgetInput(String(n))}
              style={{ borderColor: budgetInput === String(n) ? 'var(--gold)' : undefined, color: budgetInput === String(n) ? 'var(--gold-light)' : undefined }}
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
