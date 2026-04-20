// lib/domain/installment.js
// Single source of truth สำหรับ business logic ของ installment
// ไม่มี logic นี้ซ้ำในที่อื่น

/**
 * คำนวณ status ของงวด
 * @param {Object} inst - installment record จาก DB
 * @param {Object} agentCode - agent_code record (มี cancel_after_days, warn_day, critical_day)
 * @returns {'paid'|'installment'|'prep'|'due'|'overdue'|'critical'}
 */
export function getInstallmentStatus(inst, agentCode) {
  // จ่ายแล้ว
  if (inst.paid_at) return 'paid'

  const today     = new Date(); today.setHours(0,0,0,0)
  const dueDate   = new Date(inst.due_date); dueDate.setHours(0,0,0,0)
  const daysDiff  = Math.floor((today - dueDate) / 86400000)  // + = เกิน due, - = ยังไม่ถึง

  const cancelDays   = agentCode?.cancel_after_days ?? 30
  const warnDay      = agentCode?.warn_day      ?? 20
  const criticalDay  = agentCode?.critical_day  ?? 27
  const notifyBefore = agentCode?.notify_before ?? 7   // วันก่อน due ที่จะเตือน

  // วิกฤต: เกิน critical_day แต่ยังไม่ถึง grace
  if (daysDiff > criticalDay && daysDiff <= cancelDays) return 'critical'

  // ค้างชำระ: เกิน grace period
  if (daysDiff > cancelDays) return 'overdue'

  // ถึง due แต่ยังอยู่ใน grace
  if (daysDiff >= 0 && daysDiff <= warnDay) return 'due'

  // ใกล้ถึง due (ภายใน notifyBefore วัน)
  if (daysDiff < 0 && Math.abs(daysDiff) <= notifyBefore) return 'prep'

  // กำลังผ่อนปกติ
  return 'installment'
}

/**
 * label ภาษาไทยของแต่ละ status
 */
export const STATUS_LABEL = {
  paid:        'ชำระแล้ว',
  installment: 'กำลังผ่อน',
  prep:        'ถึงเวลาเตือน',
  due:         'ถึงเวลาชำระ',
  overdue:     'ค้างชำระ',
  critical:    'วิกฤต',
}

/**
 * CSS class ของ badge แต่ละ status
 */
export const STATUS_BADGE = {
  paid:        'b-gr',
  installment: 'b-bl',
  prep:        'b-am',
  due:         'b-am',
  overdue:     'b-rd',
  critical:    'b-rd',
}

/**
 * Tab IDs สำหรับ Collect page (accordion)
 */
export const COLLECT_TABS = [
  { id: 'all',         label: 'ทั้งหมด',        statuses: null },
  { id: 'prep',        label: 'ถึงเวลาเตือน',   statuses: ['prep'] },
  { id: 'due',         label: 'ถึงเวลาชำระ',    statuses: ['due'] },
  { id: 'overdue',     label: 'ค้างชำระ',        statuses: ['overdue', 'critical'] },
  { id: 'installment', label: 'กำลังผ่อน',       statuses: ['installment'] },
  { id: 'paid',        label: 'เสร็จสิ้น',        statuses: ['paid'] },
]

/**
 * คำนวณจำนวนวันที่เหลือก่อนถึง grace deadline
 */
export function daysUntilCancel(inst, agentCode) {
  if (inst.paid_at) return null
  const today    = new Date(); today.setHours(0,0,0,0)
  const dueDate  = new Date(inst.due_date); dueDate.setHours(0,0,0,0)
  const daysPast = Math.floor((today - dueDate) / 86400000)
  const cancelDays = agentCode?.cancel_after_days ?? 30
  return cancelDays - daysPast  // ถ้า <= 0 = หมดสิทธิ์แล้ว
}