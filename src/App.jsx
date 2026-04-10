import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import AuthPage from './pages/AuthPage'
import TrackerPage from './pages/TrackerPage'
import HistoryPage from './pages/HistoryPage'
import StatsPage from './pages/StatsPage'
import SettingsPage from './pages/SettingsPage'
import Layout from './components/Layout'

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) return <Splash />

  if (!session) return (
    <Routes>
      <Route path="*" element={<AuthPage />} />
    </Routes>
  )

  return (
    <Routes>
      <Route element={<Layout session={session} />}>
        <Route index element={<TrackerPage session={session} />} />
        <Route path="history" element={<HistoryPage session={session} />} />
        <Route path="stats" element={<StatsPage session={session} />} />
        <Route path="settings" element={<SettingsPage session={session} />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function Splash() {
  return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
      <span style={{ fontSize: 48 }}>☕</span>
      <div style={{ width:28, height:28, border:'3px solid rgba(200,130,60,0.3)', borderTopColor:'#c8823c', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
    </div>
  )
}
