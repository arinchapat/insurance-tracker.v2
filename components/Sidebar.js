'use client'
// components/Sidebar.js
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icons } from './ui/Icons'
import LogoutButton from './LogoutButton' // <-- นำเข้าปุ่ม Logout ที่นี่

const NAV_ITEMS = [
  { section: 'เมนูหลัก' },
  { href: '/dashboard', label: 'แดชบอร์ด',            icon: Icons.home },
  { href: '/customers', label: 'ลูกค้า',                icon: Icons.users },
  { href: '/policies',  label: 'กรมธรรม์',              icon: Icons.doc },
  { section: 'รอบการเงิน' },
  { href: '/collect',   label: 'กระเป๋าซ้าย (เก็บ)',    icon: Icons.wallet,   bdg: '7' },
  { href: '/risk',      label: 'ห้องฉุกเฉิน',            icon: Icons.alert,    bdg: '2' },
  { href: '/remit',     label: 'กระเป๋าขวา (วางบิล)',    icon: Icons.building, bdg: '2', bdgAmber: true },
  { section: 'ระบบ' },
  { href: '/settings',  label: 'ตั้งค่า',               icon: Icons.gear },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside style={{
      background: '#0b1628',
      color: '#cbd5e1',
      display: 'flex',
      flexDirection: 'column',
      position: 'sticky',
      top: 0,
      height: '100vh',
      overflowY: 'auto',
      width: '240px',
      flexShrink: 0,
    }}>
      {/* Brand */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '20px 18px',
        borderBottom: '1px solid rgba(255,255,255,.06)',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
          color: '#fff', display: 'grid', placeItems: 'center',
          fontWeight: 700, fontSize: 13,
        }}>AI</div>
        <div>
          <div style={{ fontWeight: 600, color: '#fff', fontSize: 13 }}>Agent Insure</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Tracker · TH</div>
        </div>
      </div>

      {/* Nav items */}
      {NAV_ITEMS.map((item, i) => {
        if (item.section) {
          return (
            <div key={i} style={{
              fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.2px',
              color: '#475569', padding: '18px 20px 6px', fontWeight: 600,
            }}>
              {item.section}
            </div>
          )
        }

        const active = pathname === item.href || pathname.startsWith(item.href + '/')

        return (
          <Link key={item.href} href={item.href} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '9px 14px', margin: '1px 10px', borderRadius: 8,
            cursor: 'pointer', fontSize: 13, fontWeight: 500,
            textDecoration: 'none', position: 'relative',
            background: active ? '#1d2d4a' : 'transparent',
            color: active ? '#fff' : '#cbd5e1',
            transition: 'background .15s',
          }}>
            {active && (
              <span style={{
                position: 'absolute', left: -10, top: 8, bottom: 8,
                width: 3, borderRadius: '0 3px 3px 0', background: '#3b82f6',
              }}/>
            )}
            {item.icon}
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.bdg && (
              <span style={{
                background: item.bdgAmber ? '#f59e0b' : '#ef4444',
                color: '#fff', fontSize: 10, fontWeight: 600,
                padding: '1px 6px', borderRadius: 10,
              }}>{item.bdg}</span>
            )}
          </Link>
        )
      })}

      {/* Footer */}
      <div style={{
        marginTop: 'auto', padding: 14,
        borderTop: '1px solid rgba(255,255,255,.06)',
        fontSize: 11.5, color: '#64748b', lineHeight: 1.6,
      }}>
        
        {/* แสดงปุ่ม Logout ตรงนี้ */}
        <div style={{ marginTop: 16 }}>
          <LogoutButton />
        </div>
      </div>
      
    </aside>
  )
}