import { useState } from 'react'
import { supabase } from '../lib/supabase'
import s from './SettingsPage.module.css'

export default function SettingsPage({ session }) {
  const [signingOut, setSigningOut] = useState(false)
  async function handleSignOut() { setSigningOut(true); await supabase.auth.signOut() }
  return (
    <div className={s.page}>
      <div className={s.header+' fade-up'}><p className={s.sub}>Preferences</p><h1 className={s.title}>Settings</h1></div>
      <div className={s.section+' fade-up-2'}>
        <h2 className={s.sectionTitle}>Account</h2>
        <div className={s.row}><span className={s.rowLabel}>Email</span><span className={s.rowValue}>{session.user.email}</span></div>
      </div>
      <div className={s.section+' fade-up-3'}>
        <h2 className={s.sectionTitle}>Goals</h2>
        <p className={s.hint}>Manage your cup goals from the Goals tab. Each goal has its own budget and full cup history.</p>
      </div>
      <div className={s.section+' fade-up-4'}>
        <h2 className={s.sectionTitle}>Account Actions</h2>
        <button className={s.signOutBtn} onClick={handleSignOut} disabled={signingOut}>{signingOut?'Signing out…':'→ Sign Out'}</button>
      </div>
    </div>
  )
}
