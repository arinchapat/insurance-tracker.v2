// lib/domains/installment/service.js
// Pure business logic for installments — NO DB access.

export function getInstallmentStatus(inst, agentCode) {
  if (inst.paid_at) return 'paid'

  const today    = new Date(); today.setHours(0,0,0,0)
  const dueDate  = new Date(inst.due_date); dueDate.setHours(0,0,0,0)
  const daysDiff = Math.floor((today - dueDate) / 86400000)

  const cancelDays   = agentCode?.cancel_after_days ?? 30
  const warnDay      = agentCode?.warn_day          ?? 20
  const criticalDay  = agentCode?.critical_day      ?? 27
  const notifyBefore = agentCode?.notify_before_due ?? 7

  if (daysDiff > criticalDay && daysDiff <= cancelDays)   return 'critical'
  if (daysDiff > cancelDays)                              return 'overdue'
  if (daysDiff >= 0 && daysDiff <= warnDay)               return 'due'
  if (daysDiff < 0 && Math.abs(daysDiff) <= notifyBefore) return 'prep'
  return 'installment'
}

export function daysUntilCancel(inst, agentCode) {
  if (inst.paid_at) return null
  const today    = new Date(); today.setHours(0,0,0,0)
  const dueDate  = new Date(inst.due_date); dueDate.setHours(0,0,0,0)
  const daysPast = Math.floor((today - dueDate) / 86400000)
  return (agentCode?.cancel_after_days ?? 30) - daysPast
}

// Build installment rows for a policy (no DB write).
export function buildInstallmentRows({ policyId, userId, premium, instCount, policyStart, firstPayment }) {
  const base = Math.floor((premium / instCount) * 100) / 100
  const last = +(premium - base * (instCount - 1)).toFixed(2)
  return Array.from({ length: instCount }, (_, i) => {
    const amt = i === instCount - 1 ? last : base
    const due = new Date(policyStart); due.setMonth(due.getMonth() + i)
    const isFirstPaid = i === 0 && !!firstPayment
    return {
      policy_id:      policyId,
      user_id:        userId,
      installment_no: i + 1,
      total_inst:     instCount,
      amount_due:     amt,
      due_date:       due.toISOString().split('T')[0],
      paid_at:        isFirstPaid ? new Date().toISOString() : null,
      paid_amount:    isFirstPaid ? Number(firstPayment.amount ?? amt) : null,
      slip_url:       isFirstPaid ? (firstPayment.slipUrl ?? null) : null,
      notes:          isFirstPaid
        ? [firstPayment.channel ? `[ch:${firstPayment.channel}]` : '', firstPayment.notes ?? '']
            .filter(Boolean).join('\n') || null
        : null,
    }
  })
}

// FIFO allocation: distribute a payment over the oldest unpaid installments.
export function allocateFifo(installments, totalPaid) {
  let remaining = Number(totalPaid) || 0
  const sorted = [...installments]
    .filter(i => !i.paid_at)
    .sort((a, b) => a.installment_no - b.installment_no)
  const updates = []
  for (const inst of sorted) {
    if (remaining <= 0) break
    const apply = Math.min(remaining, Number(inst.amount_due))
    updates.push({
      id:          inst.id,
      paid_amount: apply,
      paid_at:     apply >= Number(inst.amount_due) ? new Date().toISOString() : null,
    })
    remaining -= apply
  }
  return { updates, leftover: remaining }
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

export const COLLECT_TABS = [
  { id: 'all',         label: 'ทั้งหมด',       statuses: null },
  { id: 'prep',        label: 'ถึงเวลาเตือน',  statuses: ['prep'] },
  { id: 'due',         label: 'ถึงเวลาชำระ',   statuses: ['due'] },
  { id: 'overdue',     label: 'ค้างชำระ',       statuses: ['overdue', 'critical'] },
  { id: 'installment', label: 'กำลังผ่อน',      statuses: ['installment'] },
  { id: 'paid',        label: 'เสร็จสิ้น',       statuses: ['paid'] },
]
