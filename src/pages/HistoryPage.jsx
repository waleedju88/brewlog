import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import s from './HistoryPage.module.css'

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}
function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}
function localDateKey(iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export default function HistoryPage({ session }) {
  const [grouped, setGrouped] = useState([]) // [{date, label, cups:[{id,logged_at}]}]
  const [limit, setLimit]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null) // date key of open group

  useEffect(() => {
    async function load() {
      const userId = session.user.id
      const { data: profile } = await supabase
        .from('profiles').select('daily_limit').eq('id', userId).single()
      setLimit(profile?.daily_limit ?? null)

      const { data } = await supabase
        .from('cup_logs')
        .select('id, logged_at')
        .eq('user_id', userId)
        .order('logged_at', { ascending: false })
        .limit(500)

      // Group by local date
      const map = {}
      for (const cup of (data || [])) {
        const key = localDateKey(cup.logged_at)
        if (!map[key]) map[key] = { key, cups: [] }
        map[key].cups.push(cup)
      }
      const sorted = Object.values(map).sort((a, b) => b.key.localeCompare(a.key))
      setGrouped(sorted)

      // Auto-expand today
      if (sorted.length > 0) setExpanded(sorted[0].key)
      setLoading(false)
    }
    load()
  }, [session])

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
            const count = day.cups.length
            const overLimit = limit !== null && count > limit
            const atLimit   = limit !== null && count === limit
            const isOpen    = expanded === day.key
            const dateObj   = new Date(day.cups[0].logged_at)
            const dateLabel = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

            return (
              <div key={day.key} className={s.group} style={{ animationDelay: `${i * 0.04}s` }}>
                {/* Day header — tap to expand */}
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
                    <span
                      className={s.dayCount}
                      style={{ color: overLimit ? 'var(--red)' : atLimit ? 'var(--gold)' : 'var(--cream)' }}
                    >{count}</span>
                    {overLimit && <span className={s.pill} style={{ background: 'rgba(192,57,43,0.2)', color: '#e74c3c' }}>over</span>}
                    {atLimit   && <span className={s.pill} style={{ background: 'rgba(200,130,60,0.2)', color: 'var(--gold-light)' }}>limit</span>}
                    <span className={s.chevron}>{isOpen ? '▲' : '▼'}</span>
                  </div>
                </button>

                {/* Per-cup list */}
                {isOpen && (
                  <div className={s.cupList}>
                    {day.cups.map((cup, j) => (
                      <div key={cup.id} className={s.cupRow}>
                        <span className={s.cupNum}>#{count - j}</span>
                        <span className={s.cupIcon}>☕</span>
                        <div className={s.cupInfo}>
                          <span className={s.cupTime}>{formatTime(cup.logged_at)}</span>
                          <span className={s.cupDate}>{formatDate(cup.logged_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
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
