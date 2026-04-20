// app/(app)/dashboard/page.js
import { createClient } from '@/lib/supabase/server'
import { Icons, fmtB, fmt } from '@/components/ui/Icons'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()

  // ── ดึงข้อมูลจริงจาก DB ──
  const [
    { count: totalPolicies },
    { count: activePolicies },
    { data: overduePolicies },
    { data: recentPolicies },
    { data: agentCodes },
    { data: companies },
    { data: overdueInst },
    { data: dueSoonInst },
  ] = await Promise.all([
    supabase.from('policies').select('*', { count: 'exact', head: true }),
    supabase.from('policies').select('*', { count: 'exact', head: true }).eq('policy_status', 'active'),
    supabase.from('policies').select('id, customer_id, customers(name), agent_code, premium').eq('policy_status', 'overdue').limit(5),
    supabase.from('policies').select('id, coverage_type, customers(name), premium, policy_status, created_at').order('created_at', { ascending: false }).limit(6),
    supabase.from('agent_codes').select('*, companies(name, color)').eq('is_active', true),
    supabase.from('companies').select('*').eq('is_active', true),
    supabase.from('installments')
      .select('*, policies(id, agent_code, customers(name, phone))')
      .is('paid_at', null)
      .lte('due_date', new Date().toISOString().split('T')[0])
      .order('due_date'),
    supabase.from('installments')
      .select('*, policies(id, agent_code, customers(name, phone))')
      .is('paid_at', null)
      .gt('due_date', new Date().toISOString().split('T')[0])
      .lte('due_date', new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0])
      .order('due_date'),
  ])

  const today = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
  const overdueCount = overdueInst?.length ?? 0
  const dueSoonCount = dueSoonInst?.length ?? 0
  const urgentCount  = overdueCount + (overdueInst?.filter(i => {
    const days = Math.floor((new Date() - new Date(i.due_date)) / 86400000)
    return days > 20
  }).length ?? 0)

  // คำนวณยอดรวมรอเก็บ
  const totalDue = [...(overdueInst ?? []), ...(dueSoonInst ?? [])].reduce((s, i) => s + Number(i.amount_due), 0)

  return (
    <div>
      {/* Topbar */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 28px', background: '#fff',
        borderBottom: '1px solid #e5eaf1',
        position: 'sticky', top: 0, zIndex: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#64748b' }}>
          <span style={{ color: '#0f172a', fontWeight: 600 }}>แดชบอร์ด</span>
        </div>
        <div style={{ flex: 1 }} />
        <Link href="/policies/new" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
          background: '#2563eb', color: '#fff', textDecoration: 'none',
        }}>
          {Icons.plus} สร้างกรมธรรม์
        </Link>
      </header>

      <div style={{ padding: '26px 32px' }}>
        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 22 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-.3px' }}>
              สวัสดี 👋
            </h1>
            <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
              วันนี้ {today}
              {urgentCount > 0 && <> · มี <b style={{ color: '#dc2626' }}>{urgentCount} งานเร่งด่วน</b></>}
              {dueSoonCount > 0 && <> และ <b style={{ color: '#d97706' }}>{dueSoonCount} งวดใกล้ครบกำหนด</b></>}
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 18 }}>
          <KpiCard
            label="กรมธรรม์ใช้งานอยู่"
            value={fmt(activePolicies ?? 0)}
            sub={`จากทั้งหมด ${fmt(totalPolicies ?? 0)} ฉบับ`}
            icon={Icons.doc}
            color="blue"
          />
          <KpiCard
            label="ยอดรอเก็บ"
            value={fmtB(totalDue)}
            sub={`${overdueCount + dueSoonCount} งวด`}
            icon={Icons.wallet}
            color="amber"
          />
          <KpiCard
            label="ค้างชำระ / เกิน due"
            value={fmt(overdueCount)}
            sub="งวดที่เกินกำหนดแล้ว"
            icon={Icons.alert}
            color="red"
          />
          <KpiCard
            label="บริษัทที่ใช้งาน"
            value={fmt(companies?.length ?? 0)}
            sub={`${agentCodes?.length ?? 0} รหัสตัวแทน`}
            icon={Icons.building}
            color="green"
          />
        </div>

        {/* Main grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 18 }}>

          {/* Urgent tasks */}
          <div className="card">
            <div className="card-h">
              <div style={{ width: 32, height: 32, background: '#fef2f2', color: '#dc2626', borderRadius: 8, display: 'grid', placeItems: 'center' }}>
                {Icons.flash}
              </div>
              <div style={{ flex: 1 }}>
                <h3 className="card-t">งานที่ต้องทำ</h3>
                <div className="card-s">งวดเกิน due + ใกล้ครบกำหนด</div>
              </div>
              <Link href="/collect" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 500, color: '#64748b', textDecoration: 'none', background: '#f8fafc', border: '1px solid #e5eaf1' }}>
                ดูทั้งหมด
              </Link>
            </div>
            <div style={{ padding: '6px 8px' }}>
              {/* Overdue */}
              {overdueInst && overdueInst.length > 0 && (
                <>
                  <div style={{ padding: '8px 12px 4px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: .8 }}>
                    ค้างชำระ · {overdueInst.length} ราย
                  </div>
                  {overdueInst.slice(0, 3).map(inst => (
                    <Link key={inst.id} href="/collect" style={{ textDecoration: 'none' }}>
                      <div className="ulist">
                        <div className="ui r">{Icons.phone}</div>
                        <div className="ub">
                          <div className="ut">{inst.policies?.customers?.name} · งวด {inst.installment_no}/{inst.total_inst}</div>
                          <div className="um">{fmtB(inst.amount_due)} · ดิว {new Date(inst.due_date).toLocaleDateString('th-TH', { month: 'short', day: 'numeric' })}</div>
                        </div>
                        <span className="pill r">ค้าง</span>
                      </div>
                    </Link>
                  ))}
                </>
              )}

              {/* Due soon */}
              {dueSoonInst && dueSoonInst.length > 0 && (
                <>
                  <div style={{ padding: '12px 12px 4px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: .8 }}>
                    ถึงกำหนดใน 7 วัน · {dueSoonInst.length} ราย
                  </div>
                  {dueSoonInst.slice(0, 3).map(inst => (
                    <Link key={inst.id} href="/collect" style={{ textDecoration: 'none' }}>
                      <div className="ulist">
                        <div className="ui b">{Icons.clock}</div>
                        <div className="ub">
                          <div className="ut">{inst.policies?.customers?.name} · งวด {inst.installment_no}/{inst.total_inst}</div>
                          <div className="um">{fmtB(inst.amount_due)} · ดิว {new Date(inst.due_date).toLocaleDateString('th-TH', { month: 'short', day: 'numeric' })}</div>
                        </div>
                        <span className="pill w">เร็วๆ นี้</span>
                      </div>
                    </Link>
                  ))}
                </>
              )}

              {overdueCount === 0 && dueSoonCount === 0 && (
                <div className="empty">
                  <div className="ei">{Icons.check}</div>
                  ไม่มีงานค้างอยู่ 🎉
                </div>
              )}
            </div>
          </div>

          {/* Agent codes summary */}
          <div className="card">
            <div className="card-h">
              <h3 className="card-t">รหัสตัวแทน</h3>
              <div className="card-s" style={{ marginLeft: 'auto' }}>{agentCodes?.length ?? 0} รหัส</div>
            </div>
            <table className="data">
              <thead>
                <tr>
                  <th>รหัส</th>
                  <th>บริษัท</th>
                  <th>กฎ</th>
                  <th>รอบบิล</th>
                </tr>
              </thead>
              <tbody>
                {agentCodes?.map(ac => (
                  <tr key={ac.code}>
                    <td>
                      <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontSize: 11.5 }}>
                        {ac.code}
                      </code>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, background: '#f1f5f9', padding: '2px 8px', borderRadius: 999 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: ac.companies?.color ?? '#64748b' }}/>
                        {ac.companies?.name}
                      </span>
                    </td>
                    <td><span className="pill b">{ac.cancel_after_days} วัน</span></td>
                    <td style={{ color: '#64748b', fontSize: 12.5 }}>วันที่ {ac.bill_cycle_day}</td>
                  </tr>
                ))}
                {(!agentCodes || agentCodes.length === 0) && (
                  <tr><td colSpan={4}>
                    <div className="empty" style={{ padding: '20px' }}>
                      <Link href="/settings" style={{ color: '#2563eb' }}>ไปตั้งค่ารหัสตัวแทนก่อน →</Link>
                    </div>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent policies */}
        <div className="card" style={{ marginTop: 18 }}>
          <div className="card-h">
            <h3 className="card-t">กรมธรรม์ล่าสุด</h3>
            <Link href="/policies" style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 500, color: '#64748b', textDecoration: 'none', background: '#f8fafc', border: '1px solid #e5eaf1' }}>
              ดูทั้งหมด
            </Link>
          </div>
          <table className="data">
            <thead>
              <tr>
                <th>เลขที่</th>
                <th>ลูกค้า</th>
                <th>ประเภท</th>
                <th>สถานะ</th>
                <th style={{ textAlign: 'right' }}>เบี้ย</th>
              </tr>
            </thead>
            <tbody>
              {recentPolicies?.map(p => (
                <tr key={p.id} className="clk">
                  <td><code style={{ color: '#2563eb', fontSize: 11.5 }}>{p.id}</code></td>
                  <td style={{ fontWeight: 500 }}>{p.customers?.name}</td>
                  <td><span className="badge b-bl">{p.coverage_type}</span></td>
                  <td>
                    <span className={`badge ${p.policy_status === 'active' ? 'b-gr' : p.policy_status === 'overdue' ? 'b-rd' : 'b-sl'}`}>
                      <span className="dot"/>
                      {p.policy_status === 'active' ? 'ใช้งานอยู่' : p.policy_status === 'overdue' ? 'ค้างชำระ' : p.policy_status}
                    </span>
                  </td>
                  <td className="tnum" style={{ textAlign: 'right' }}>{fmtB(p.premium)}</td>
                </tr>
              ))}
              {(!recentPolicies || recentPolicies.length === 0) && (
                <tr><td colSpan={5}>
                  <div className="empty">
                    <div className="ei">{Icons.doc}</div>
                    ยังไม่มีกรมธรรม์ · <Link href="/policies/new" style={{ color: '#2563eb' }}>สร้างใหม่</Link>
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Notice */}
        <div className="alert i" style={{ marginTop: 16 }}>
          {Icons.shield}
          <div><b>ระบบนี้:</b> เน้นติดตามกรมธรรม์ การเก็บเงิน และการวางบิลตามรอบบริษัท — ไม่มีการคำนวณค่าคอมมิชชั่น</div>
        </div>
      </div>
    </div>
  )
}

// ── KPI Card component ──
function KpiCard({ label, value, sub, icon, color }) {
  const colors = {
    blue:  { border: '#3b82f6', bg: '#eff6ff', text: '#2563eb' },
    amber: { border: '#f59e0b', bg: '#fffbeb', text: '#d97706' },
    red:   { border: '#ef4444', bg: '#fef2f2', text: '#dc2626' },
    green: { border: '#22c55e', bg: '#f0fdf4', text: '#16a34a' },
  }
  const c = colors[color] ?? colors.blue

  return (
    <div style={{
      background: '#fff', border: '1px solid #e5eaf1', borderRadius: 12,
      padding: '16px 18px', position: 'relative', overflow: 'hidden',
      borderTop: `3px solid ${c.border}`,
    }}>
      <div style={{ position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: 10, background: c.bg, color: c.text, display: 'grid', placeItems: 'center' }}>
        {icon}
      </div>
      <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4, fontFeatureSettings: '"tnum"' }}>{value}</div>
      <div style={{ fontSize: 12, marginTop: 3, color: '#64748b' }}>{sub}</div>
    </div>
  )
}