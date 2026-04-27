// lib/domains/installment/types.js
// Schema reference (mirrors public.installments):
//   id            uuid PK
//   policy_id     text FK -> policies.id
//   installment_no integer
//   total_inst    integer
//   amount_due    numeric
//   due_date      date
//   paid_at       timestamptz | null
//   paid_amount   numeric | null
//   slip_url      text | null
//   notes         text | null
//   created_at    timestamptz
//   user_id       uuid
// UNIQUE(policy_id, installment_no)

export const INSTALLMENT_STATUS = ['paid', 'installment', 'prep', 'due', 'overdue', 'critical']
