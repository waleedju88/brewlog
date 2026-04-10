import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import s from './StatsPage.module.css'

const BADGES = [
  { id: 'first_cup',     icon: '🌱', name: 'First Sip',       desc: 'Logged your first cup',              check: st => st.total >= 1 },
  { id: 'ten_cups',      icon: '🔟', name: 'Ten Down',        desc: 'Logged 10 cups total',               check: st => st.total >= 10 },
  { id: 'fifty_cups',    icon: '💯', name: 'Fifty Brews',     desc: 'Logged 50 cups total',               check: st => st.total >= 50 },
  { id: 'streak_3',      icon: '🔥', name: 'On Fire',         desc: '3-day tracking streak',              check: st => st.currentStreak >= 3 },
  { id: 'streak_7',      icon: '⚡', name: 'Weekly Warrior',  desc: '7-day tracking streak',              check: st => st.currentStreak >= 7 },
  { id: 'streak_30',     icon: '🏆', name: 'Iron Brewer',     desc: '30-day tracking streak',             check: st => st.currentStreak >= 30 },
  { id: 'under_limit_3', icon: '😇', name: 'Self Control',    desc: 'Stayed under limit 3 days in a row', check: st => st.underLimitStreak >= 3 },
  { id: 'under_limit_7', icon: '🎯', name: 'Discipline',      desc: 'Stayed under limit 7 days in a row', check: st => st.underLimitStreak >= 7 },
  { id: 'early_bird',    icon: '🌅', name: 'Early Bird',      desc: 'Tracked 5 different days',           check: st => st.daysLogged >= 5 },
]

function localDateKey(iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function computeStats(cups, limit) {
  const total = cups.length

  // Group by local date
  const byDay = {}
  for (const c of cups) {
    const k = localDateKey(c.logged_at)
    byDay[k] = (byDay[k] || 0) + 1
  }
  const days = Object.keys(byDay).sort()
  const daysLogged = days.length
  const avg = daysLogged > 0 ? (total / daysLogged).toFixed(1) : 0

  // Streaks
  let longestStreak = 0, temp = 0
  let underLimitStreak = 0, bestUnder = 0, tempUnder = 0

  for (let i = 0; i < days.length; i++) {
    const prev = i > 0 ? new Date(days[i-1] + 'T12:00:00') : null
    const curr = new Date(days[i] + 'T12:00:00')
    const consecutive = prev ? (curr - prev) / 86400000 === 1 : true
    temp = consecutive ? temp + 1 : 1
    longestStreak = Math.max(longestStreak, temp)

    if (limit !== null && byDay[days[i]] <= limit) {
      tempUnder = consecutive ? tempUnder + 1 : 1
      bestUnder = Math.max(bestUnder, tempUnder)
    } else {
      tempUnder = 0
    }
  }
  underLimitStreak = bestUnder

  // Current streak backwards from today
  let currentStreak = 0
  const daySet = new Set(days)
  const check = new Date()
  while (true) {
    const k = `${check.getFullYear()}-${String(check.getMonth()+1).padStart(2,'0')}-${String(check.getDate()).padStart(2,'0')}`
    if (daySet.has(k)) { currentStreak++; check.setDate(check.getDate() - 1) }
    else break
  }

  // Most active hour
  const hourCount = Array(24).fill(0)
  for (const c of cups) hourCount[new Date(c.logged_at).getHours()]++
  const peakHour = hourCount.indexOf(Math.max(...hourCount))
  const peakLabel = cups.length > 0
    ? new Date(2000, 0, 1, peakHour).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })
    : '—'

  return { total, daysLogged, currentStreak, longestStreak, underLimitStreak, avg, peakLabel }
}

export default function StatsPage({ session }) {
  const [cups, setCups]   = useState([])
  const [limit, setLimit] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const userId = session.user.id
      const { data: profile } = await supabase
        .from('profiles').select('daily_limit').eq('id', userId).single()
      setLimit(profile?.daily_limit ?? null)
      const { data } = await supabase
        .from('cup_logs').select('logged_at').eq('user_id', userId)
      setCups(data || [])
      setLoading(false)
    }
    load()
  }, [session])

  if (loading) return <Loader />

  const st = computeStats(cups, limit)
  const unlocked = BADGES.filter(b => b.check(st))
  const locked   = BADGES.filter(b => !b.check(st))

  return (
    <div className={s.page}>
      <div className={s.header + ' fade-up'}>
        <p className={s.sub}>All time</p>
        <h1 className={s.title}>Your Stats</h1>
      </div>

      <div className={s.grid + ' fade-up-2'}>
        <StatCard label="Total Cups"     value={st.total}           icon="☕" />
        <StatCard label="Days Tracked"   value={st.daysLogged}      icon="📅" />
        <StatCard label="Avg / Day"      value={st.avg}             icon="📈" />
        <StatCard label="Peak Hour"      value={st.peakLabel}       icon="⏰" small />
        <StatCard label="Current Streak" value={`${st.currentStreak}d`} icon="🔥" />
        <StatCard label="Longest Streak" value={`${st.longestStreak}d`} icon="⚡" />
        {limit && <StatCard label="Daily Limit" value={limit} icon="🎯" />}
      </div>

      <div className={s.badgeSection + ' fade-up-3'}>
        <h2 className={s.sectionTitle}>Badges</h2>
        {unlocked.length > 0 && (
          <>
            <p className={s.badgeSub}>Earned</p>
            <div className={s.badgeGrid}>
              {unlocked.map(b => (
                <div key={b.id} className={s.badge}>
                  <span className={s.badgeIcon}>{b.icon}</span>
                  <p className={s.badgeName}>{b.name}</p>
                  <p className={s.badgeDesc}>{b.desc}</p>
                </div>
              ))}
            </div>
          </>
        )}
        {locked.length > 0 && (
          <>
            <p className={s.badgeSub} style={{ marginTop: unlocked.length ? 20 : 0 }}>Locked</p>
            <div className={s.badgeGrid}>
              {locked.map(b => (
                <div key={b.id} className={s.badge + ' ' + s.badgeLocked}>
                  <span className={s.badgeIcon} style={{ filter: 'grayscale(1) opacity(0.4)' }}>{b.icon}</span>
                  <p className={s.badgeName}>{b.name}</p>
                  <p className={s.badgeDesc}>{b.desc}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, small }) {
  return (
    <div className={s.statCard}>
      <span className={s.statIcon}>{icon}</span>
      <p className={s.statValue} style={{ fontSize: small ? '22px' : undefined }}>{value}</p>
      <p className={s.statLabel}>{label}</p>
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
