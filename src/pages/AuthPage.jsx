import { useState } from 'react'
import { supabase } from '../lib/supabase'
import s from './AuthPage.module.css'

export default function AuthPage() {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit() {
    setError(''); setSuccess(''); setLoading(true)
    if (!email || !password) { setError('Please fill in all fields.'); setLoading(false); return }

    if (mode === 'signup') {
      const { error: e } = await supabase.auth.signUp({ email, password })
      if (e) setError(e.message)
      else setSuccess('Account created! Check your email to confirm, then log in.')
    } else {
      const { error: e } = await supabase.auth.signInWithPassword({ email, password })
      if (e) setError(e.message)
    }
    setLoading(false)
  }

  return (
    <div className={s.bg}>
      <div className={s.grain} />
      <div className={s.card}>
        <div className={s.logo}>
          <span className={s.cup}>☕</span>
          <h1 className={s.brand}>BrewLog</h1>
          <p className={s.tagline}>Your personal coffee journal</p>
        </div>

        <div className={s.tabs}>
          <button className={mode === 'login' ? s.tabActive : s.tab} onClick={() => { setMode('login'); setError(''); setSuccess('') }}>Sign In</button>
          <button className={mode === 'signup' ? s.tabActive : s.tab} onClick={() => { setMode('signup'); setError(''); setSuccess('') }}>Create Account</button>
        </div>

        <div className={s.form}>
          <label className={s.label}>Email</label>
          <input className={s.input} type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()} autoComplete="email" />

          <label className={s.label}>Password</label>
          <input className={s.input} type="password" placeholder={mode === 'signup' ? 'Min. 6 characters' : '••••••••'} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />

          {error && <p className={s.error}>{error}</p>}
          {success && <p className={s.successMsg}>{success}</p>}

          <button className={s.btn} onClick={handleSubmit} disabled={loading}>
            {loading ? <span className={s.spinner} /> : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  )
}
