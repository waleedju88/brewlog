import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import s from './GoalsPage.module.css'

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
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
function localDateKey(iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

const STATUS_COLORS = {
  active:    { bg: 'rgba(200,130,60,0.15)', color: 'var(--gold-light)', label: 'Active' },
  completed: { bg: 'rgba(46,125,82,0.15)',  color: '#4caf80',           label: 'Completed' },
  closed:    { bg: 'rgba(100,100,100,0.15)', color: 'var(--muted)',     label: 'Closed Early' },
}

export default function GoalsPage({ session }) {
  const userId = session.user.id
  const [goals, setGoals]         = useState([])
  const [cupCounts, setCupCounts] = useState({}) // goalId -> count
  const [expanded, setExpanded]   = useState(null)
  const [goalCups, setGoalCups]   = useState({}) // goalId -> [cups]
  const [loading, setLoading]     = useState(true)

  // Edit goal modal
  const [editingGoal, setEditingGoal]   = useState(null)
  const [editTitle, setEditTitle]       = useState('')
  const [editBudget, setEditBudget]     = useState('')
  const [editSaving, setEditSaving]     = useState(false)

  // Delete goal modal
  const [deletingGoal, setDeletingGoal] = useState(null)
  const [deleting, setDeleting]         = useState(false)

  // Edit cup time modal
  const [editingCup, setEditingCup]     = useState(null)
  const [editCupValue, setEditCupValue] = useState('')
  const [editCupSaving, setEditCupSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: goalsData } = await supabase
      .from('goals').select('*').eq('user_id', userId)
      .order('created_at', { ascending: false })
    setGoals(goalsData || [])

    // Get cup counts per goal
    const counts = {}
    for (const g of (goalsData || [])) {
      const { count } = await supabase
        .from('cup_logs').select('*', { count: 'exact', head: true }).eq('goal_id', g.id)
      counts[g.id] = count || 0
    }
    setCupCounts(counts)
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  async function loadGoalCups(goalId) {
    if (goalCups[goalId]) return // already loaded
    const { data } = await supabase
      .from('cup_logs').select('id, logged_at')
      .eq('goal_id', goalId)
      .order('logged_at', { ascending: false })
    setGoalCups(prev => ({ ...prev, [goalId]: data || [] }))
  }

  function toggleExpand(goalId) {
    if (expanded === goalId) { setExpanded(null); return }
    setExpanded(goalId)
    loadGoalCups(goalId)
  }

  function openEditGoal(goal) {
    setEditingGoal(goal)
    setEditTitle(goal.title || '')
    setEditBudget(String(goal.budget))
  }

  async function handleSaveGoal() {
    const n = parseInt(editBudget)
    if (isNaN(n) || n < 1) return
    setEditSaving(true)
    await supabase.from('goals').update({ title: editTitle.trim() || null, budget: n }).eq('id', editingGoal.id)
    setGoals(prev => prev.map(g => g.id === editingGoal.id ? { ...g, title: editTitle.trim() || null, budget: n } : g))
    setEditSaving(false)
    setEditingGoal(null)
  }

  async function handleDeleteGoal() {
    if (!deletingGoal) return
    setDeleting(true)
    // Delete all cups first, then goal
    await supabase.from('cup_logs').delete().eq('goal_id', deletingGoal.id)
    await supabase.from('goals').delete().eq('id', deletingGoal.id)
    setGoals(prev => prev.filter(g => g.id !== deletingGoal.id))
    setDeleting(false)
    setDeletingGoal(null)
  }

  function openEditCup(cup) {
    setEditingCup(cup)
    setEditCupValue(isoToLocalInput(cup.logged_at))
  }

  async function handleSaveEditCup() {
    if (!editingCup || !editCupValue) return
    setEditCupSaving(true)
    const newISO = localInputToISO(editCupValue)
    await supabase.from('cup_logs').update({ logged_at: newISO }).eq('id', editingCup.id)
    // Update in local state
    const goalId = Object.keys(goalCups).find(gid =>
      goalCups[gid].some(c => c.id === editingCup.id)
    )
    if (goalId) {
      setGoalCups(prev => ({
        ...prev,
        [goalId]: prev[goalId].map(c => c.id === editingCup.id ? { ...c, logged_at: newISO } : c)
          .sort((a, b) => new Date(b.logged_at) - new Date(a.logged_at))
      }))
    }
    setEditCupSaving(false)
    setEditingCup(null)
  }

  if (loading) return <Loader />

  return (
    <div className={s.page}>
      <div className={s.header + ' fade-up'}>
        <p className={s.sub}>{goals.length} goal{goals.length !== 1 ? 's' : ''} total</p>
        <h1 className={s.title}>Goals</h1>
      </div>

      {goals.length === 0 ? (
        <div className={s.empty + ' fade-up-2'}>
          <span>🎯</span>
          <p>No goals yet. Start one from the Today tab!</p>
        </div>
      ) : (
        <div className={s.list + ' fade-up-2'}>
          {goals.map((goal, i) => {
            const count   = cupCounts[goal.id] ?? 0
            const pct     = Math.min((count / goal.budget) * 100, 100)
            const isOpen  = expanded === goal.id
            const st      = STATUS_COLORS[goal.status] || STATUS_COLORS.closed
            const cups    = goalCups[goal.id] || []

            // Group cups by day for display
            const byDay = {}
            for (const c of cups) {
              const k = localDateKey(c.logged_at)
              if (!byDay[k]) byDay[k] = []
              byDay[k].push(c)
            }
            const days = Object.keys(byDay).sort((a,b) => b.localeCompare(a))

            return (
              <div key={goal.id} className={s.goalCard} style={{ animationDelay: `${i * 0.05}s` }}>
                {/* Goal header */}
                <div className={s.goalHeader}>
                  <div className={s.goalInfo} onClick={() => toggleExpand(goal.id)}>
                    <div className={s.goalTop}>
                      <span className={s.goalName}>{goal.title || `Goal #${goals.length - i}`}</span>
                      <span className={s.statusPill} style={{ background: st.bg, color: st.color }}>{st.label}</span>
                    </div>
                    <p className={s.goalMeta}>
                      {formatDate(goal.started_at)}
                      {goal.ended_at ? ` → ${formatDate(goal.ended_at)}` : ' → now'}
                    </p>
                    <div className={s.goalBar}>
                      <div className={s.goalBarFill} style={{
                        width: `${pct}%`,
                        background: goal.status === 'completed'
                          ? 'linear-gradient(90deg,#2e7d52,#1a4d32)'
                          : goal.status === 'active'
                          ? 'linear-gradient(90deg,var(--gold),#7b4a1e)'
                          : 'linear-gradient(90deg,#666,#444)'
                      }} />
                    </div>
                    <p className={s.goalCount}>{count} of {goal.budget} cups</p>
                  </div>

                  {/* Action buttons */}
                  <div className={s.goalActions}>
                    <button className={s.actionBtn} onClick={() => openEditGoal(goal)} title="Edit">✎</button>
                    <button className={s.actionBtnRed} onClick={() => setDeletingGoal(goal)} title="Delete">🗑</button>
                    <button className={s.chevronBtn} onClick={() => toggleExpand(goal.id)}>
                      {isOpen ? '▲' : '▼'}
                    </button>
                  </div>
                </div>

                {/* Expanded cups grouped by day */}
                {isOpen && (
                  <div className={s.cupSection}>
                    {cups.length === 0 ? (
                      <p className={s.noCups}>No cups logged for this goal yet.</p>
                    ) : (
                      days.map(dayKey => {
                        const dayCups = byDay[dayKey]
                        const dayLabel = new Date(dayCups[0].logged_at)
                          .toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
                        return (
                          <div key={dayKey} className={s.dayGroup}>
                            <p className={s.dayLabel}>{dayLabel} <span className={s.dayCount}>·  {dayCups.length} cups</span></p>
                            {dayCups.map((cup, j) => (
                              <button key={cup.id} className={s.cupRow} onClick={() => openEditCup(cup)}>
                                <span className={s.cupNum}>#{dayCups.length - j}</span>
                                <span className={s.cupIcon}>☕</span>
                                <span className={s.cupTime}>{formatTime(cup.logged_at)}</span>
                                <span className={s.editHint}>✎</span>
                              </button>
                            ))}
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Edit goal modal */}
      {editingGoal && (
        <div className={s.overlay} onClick={() => setEditingGoal(null)}>
          <div className={s.modal} onClick={e => e.stopPropagation()}>
            <h2 className={s.modalTitle}>Edit Goal</h2>
            <input className={s.modalInput} type="text" placeholder="Goal name (optional)…"
              value={editTitle} onChange={e => setEditTitle(e.target.value)} />
            <label className={s.modalLabel}>Cup Budget</label>
            <input className={s.modalInput} type="number" min="1" placeholder="e.g. 50"
              value={editBudget} onChange={e => setEditBudget(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveGoal()} />
            <button className={s.modalBtn} onClick={handleSaveGoal} disabled={editSaving}>
              {editSaving ? '…' : '✓ Save Changes'}
            </button>
            <button className={s.modalCancel} onClick={() => setEditingGoal(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Delete goal modal */}
      {deletingGoal && (
        <div className={s.overlay} onClick={() => setDeletingGoal(null)}>
          <div className={s.modal} onClick={e => e.stopPropagation()}>
            <h2 className={s.modalTitle}>Delete Goal?</h2>
            <p className={s.modalHint}>
              This will permanently delete "{deletingGoal.title || 'this goal'}" and all {cupCounts[deletingGoal.id] || 0} cup logs inside it. This cannot be undone.
            </p>
            <button className={s.modalBtnRed} onClick={handleDeleteGoal} disabled={deleting}>
              {deleting ? '…' : 'Yes, delete it'}
            </button>
            <button className={s.modalCancel} onClick={() => setDeletingGoal(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Edit cup time modal */}
      {editingCup && (
        <div className={s.overlay} onClick={() => setEditingCup(null)}>
          <div className={s.modal} onClick={e => e.stopPropagation()}>
            <h2 className={s.modalTitle}>Edit Cup Time</h2>
            <p className={s.modalHint}>Correct the date & time for this cup</p>
            <div className={s.editPreview}>
              <span>☕</span>
              <span>{formatDateTime(editingCup.logged_at)}</span>
              <span className={s.editArrow}>→</span>
              <span>{editCupValue ? formatDateTime(localInputToISO(editCupValue)) : '—'}</span>
            </div>
            <input className={s.modalInput} type="datetime-local" value={editCupValue}
              onChange={e => setEditCupValue(e.target.value)}
              max={isoToLocalInput(new Date().toISOString())} />
            <button className={s.modalBtn} onClick={handleSaveEditCup} disabled={editCupSaving}>
              {editCupSaving ? '…' : '✓ Save Time'}
            </button>
            <button className={s.modalCancel} onClick={() => setEditingCup(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

function Loader() {
  return <div style={{ height:'60vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
    <div style={{ width:28, height:28, border:'3px solid rgba(200,130,60,0.3)', borderTopColor:'var(--gold)', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
  </div>
}
