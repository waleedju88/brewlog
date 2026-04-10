import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import s from './SettingsPage.module.css'

export default function SettingsPage({ session }) {
  const [limit, setLimit]       = useState('')
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('profiles').select('daily_limit').eq('id', session.user.id).single()
      if (data?.daily_limit) setLimit(String(data.daily_limit))
    }
    load()
  }, [session])

  async function handleSave() {
    const n = parseInt(limit)
    if (isNaN(n) || n < 1) return
    setSaving(true)
    await supabase.from('profiles').upsert({ id: session.user.id, daily_limit: n })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
  }

  return (
    <div className={s.page}>
      <div className={s.header + ' fade-up'}>
        <p className={s.sub}>Preferences</p>
        <h1 className={s.title}>Settings</h1>
      </div>

      <div className={s.section + ' fade-up-2'}>
        <h2 className={s.sectionTitle}>Account</h2>
        <div className={s.row}>
          <span className={s.rowLabel}>Email</span>
          <span className={s.rowValue}>{session.user.email}</span>
        </div>
      </div>

      <div className={s.section + ' fade-up-3'}>
        <h2 className={s.sectionTitle}>Daily Limit</h2>
        <p className={s.hint}>How many cups do you allow yourself per day?</p>
        <div className={s.inputRow}>
          <input
            className={s.input} type="number" min="1" placeholder="e.g. 4"
            value={limit} onChange={e => setLimit(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
          />
          <button className={s.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? '…' : saved ? '✓ Saved' : 'Save'}
          </button>
        </div>
      </div>

      <div className={s.section + ' fade-up-4'}>
        <h2 className={s.sectionTitle}>Account Actions</h2>
        <button className={s.signOutBtn} onClick={handleSignOut} disabled={signingOut}>
          {signingOut ? 'Signing out…' : '→ Sign Out'}
        </button>
      </div>
    </div>
  )
}
