import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import s from './SettingsPage.module.css'

export default function SettingsPage({ session }) {
  const [budget, setBudget]     = useState('')
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('profiles').select('cup_budget').eq('id', session.user.id).single()
      if (data?.cup_budget) setBudget(String(data.cup_budget))
    }
    load()
  }, [session])

  async function handleSave() {
    const n = parseInt(budget)
    if (isNaN(n) || n < 1) return
    setSaving(true)
    await supabase.from('profiles').upsert({ id: session.user.id, cup_budget: n })
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
        <h2 className={s.sectionTitle}>Cup Budget</h2>
        <p className={s.hint}>Your total cup budget. Every cup you log counts down from this number.</p>
        <div className={s.inputRow}>
          <input
            className={s.input} type="number" min="1" placeholder="e.g. 50"
            value={budget} onChange={e => setBudget(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
          />
          <button className={s.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? '…' : saved ? '✓ Saved' : 'Save'}
          </button>
        </div>
        <p className={s.hintSmall}>⚠ Changing this resets your countdown from the new number.</p>
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
