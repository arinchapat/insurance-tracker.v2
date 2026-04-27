'use client'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

export default function LogoutButton() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    setLoading(true)
    
    // 1. สั่ง Supabase ให้ล้าง Session (ออกจากระบบ)
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      alert("❌ เกิดข้อผิดพลาดตอนออกจากระบบ: " + error.message)
      setLoading(false)
      return
    }

    // 2. เด้งกลับไปหน้า Login และรีเฟรช State 
    router.push('/login')
    router.refresh() 
  }

  return (
    <button 
      onClick={handleLogout} 
      disabled={loading}
      style={{
        display: 'flex', 
        alignItems: 'center', 
        gap: 8, 
        padding: '8px 12px',
        background: 'transparent',
        border: '1px solid #cbd5e1',
        borderRadius: '8px',
        color: '#475569',
        fontSize: '14px',
        fontWeight: '600',
        cursor: loading ? 'not-allowed' : 'pointer',
        width: '100%',
        justifyContent: 'center',
        marginTop: '12px'
      }}
    >
      {loading ? 'กำลังออก...' : '🚪 ออกจากระบบ'}
    </button>
  )
}