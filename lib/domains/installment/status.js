// lib/domains/installment/status.js
// Single source of truth สำหรับ business logic ของ installment

export function getInstallmentStatus(inst, agentCode) {
  if (inst.paid_at) return 'paid'

  const today    = new Date(); today.setHours(0,0,0,0)
  const dueDate  = new Date(inst.due_date); dueDate.setHours(0,0,0,0)
  const daysDiff = Math.floor((today - dueDate) / 86400000)

  const cancelDays  = agentCode?.cancel_after_days ?? 30
  const warnDay     = agentCode?.warn_day          ?? 20
  const criticalDay = agentCode?.critical_day      ?? 27
  // schema column = notify_before (after migration 2026_04_27_drop_dead_columns)
  const notifyBefore = agentCode?.notify_before ?? 7

  if (daysDiff > criticalDay && daysDiff <= cancelDays) return 'critical'
  if (daysDiff > cancelDays)                            return 'overdue'
  if (daysDiff >= 0 && daysDiff <= warnDay)             return 'due'
  if (daysDiff < 0 && Math.abs(daysDiff) <= notifyBefore) return 'prep'
  return 'installment'
}

export const STATUS_LABEL = {
  paid:        'ชำระแล้ว',
  installment: 'กำลังผ่อน',
  prep:        'ถึงเวลาเตือน',
  due:         'ถึงเวลาชำระ',
  overdue:     'ค้างชำระ',
  critical:    'วิกฤต',
}

export const STATUS_BADGE = {
  paid:        'b-gr',
  installment: 'b-bl',
  prep:        'b-am',
  due:         'b-am',
  overdue:     'b-rd',
  critical:    'b-rd',
}

export function daysUntilCancel(inst, agentCode) {
  if (inst.paid_at) return null
  const today    = new Date(); today.setHours(0,0,0,0)
  const dueDate  = new Date(inst.due_date); dueDate.setHours(0,0,0,0)
  const daysPast = Math.floor((today - dueDate) / 86400000)
  return (agentCode?.cancel_after_days ?? 30) - daysPast
}
