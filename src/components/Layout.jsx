import { Outlet, NavLink } from 'react-router-dom'
import s from './Layout.module.css'

const NAV = [
  { to: '/',        icon: '☕', label: 'Today'   },
  { to: '/history', icon: '📅', label: 'History' },
  { to: '/stats',   icon: '📊', label: 'Stats'   },
  { to: '/settings',icon: '⚙️', label: 'Settings'},
]

export default function Layout() {
  return (
    <div className={s.shell}>
      <main className={s.main}>
        <Outlet />
      </main>
      <nav className={s.nav}>
        {NAV.map(({ to, icon, label }) => (
          <NavLink key={to} to={to} end={to==='/'} className={({ isActive }) => isActive ? s.linkActive : s.link}>
            <span className={s.icon}>{icon}</span>
            <span className={s.navLabel}>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
