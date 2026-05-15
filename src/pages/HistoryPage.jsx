import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import s from './HistoryPage.module.css'

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}
function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}
function formatDateTime(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}
function localDateKey(iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function isoToLocalInput(iso) {
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function localInputToISO(val) {
  return new Date(val).toISOString()
}

export default function HistoryPage({ session }) {
  const [allCups, setAllCups]   = useState([])
  const [budget, setBudget]     = useState(null)
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [editingCup, setEditingCup] = useState(null)
  const [editValue, setEditValue]   = useState('')
  const [editSaving, setEditSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const userId = session.user.id
      const { data: profile } = await supabase
        .from('profiles').select('cup_budget').eq('id', userId).single()
      setBudget(profile?.cup_budget ?? null)

      const { data } = await supabase
        .from('cup_logs').select('id, logged_at')
        .eq('user_id', userId)
        .order('logged_at', { ascending: false })
        .limit(500)
      setAllCups(data || [])

      // Auto-expand today
      if (data && data.length > 0) setExpanded(localDateKey(data[0].logged_at))
      setLoading(false)
    }
    load()
  }, [session])

  // Group cups by local date
  const grouped = (() => {
    const map = {}
    for (const cup of allCups) {
      const key = localDateKey(cup.logged_at)
      if (!map[key]) map[key] = { key, cups: [] }
      map[key].cups.push(cup)
    }
    return Object.values(map).sort((a, b) => b.key.localeCompare(a.key))
  })()

  function openEdit(cup) {
    setEditingCup(cup)
    setEditValue(isoToLocalInput(cup.logged_at))
  }

  async function handleSaveEdit() {
    if (!editingCup || !editValue) return
    setEditSaving(true)
    const newISO = localInputToISO(editValue)
    await supabase.from('cup_logs').update({ logged_at: newISO }).eq('id', editingCup.id)
    setAllCups(prev =>
      prev.map(c => c.id === editingCup.id ? { ...c, logged_at: newISO } : c)
        .sort((a, b) => new Date(b.logged_at) - new Date(a.logged_at))
    )
    setEditSaving(false)
    setEditingCup(null)
  }

  if (loading) return <Loader />

  return (
    <div className={s.page}>
      <div className={s.header + ' fade-up'}>
        <p className={s.sub}>Every cup logged</p>
        <h1 className={s.title}>History</h1>
      </div>

      {grouped.length === 0 ? (
        <div className={s.empty + ' fade-up-2'}>
          <span>📅</span>
          <p>No logs yet. Start tracking today!</p>
        </div>
      ) : (
        <div className={s.list + ' fade-up-2'}>
          {grouped.map((day, i) => {
            const count   = day.cups.length
            const isOpen  = expanded === day.key
            const dateLabel = new Date(day.cups[0].logged_at)
              .toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

            return (
              <div key={day.key} className={s.group} style={{ animationDelay: `${i * 0.04}s` }}>
                <button className={s.dayHeader} onClick={() => setExpanded(isOpen ? null : day.key)}>
                  <div className={s.dayLeft}>
                    <p className={s.dayLabel}>{dateLabel}</p>
                    <div className={s.cupDots}>
                      {Array.from({ length: Math.min(count, 10) }).map((_, j) => (
                        <span key={j} className={s.dot}>☕</span>
                      ))}
                      {count > 10 && <span className={s.moreDots}>+{count - 10}</span>}
                    </div>
                  </div>
                  <div className={s.dayRight}>
                    <span className={s.dayCount}>{count}</span>
                    <span className={s.chevron}>{isOpen ? '▲' : '▼'}</span>
                  </div>
                </button>

                {isOpen && (
                  <div className={s.cupList}>
                    {day.cups.map((cup, j) => (
                      <button key={cup.id} className={s.cupRow} onClick={() => openEdit(cup)}>
                        <span className={s.cupNum}>#{count - j}</span>
                        <span className={s.cupIcon}>☕</span>
                        <div className={s.cupInfo}>
                          <span className={s.cupTime}>{formatTime(cup.logged_at)}</span>
                          <span className={s.cupDate}>{formatDate(cup.logged_at)}</span>
                        </div>
                        <span className={s.editHint}>✎</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
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

function Loader() {
  return (
    <div style={{ height: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 28, height: 28, border: '3px solid rgba(200,130,60,0.3)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )
}
