// lib/domains/policy/types.js
// Schema reference (public.policies):
//   id            text PK   (custom format, e.g. genPolicyId())
//   customer_id   uuid FK
//   company_id    text FK
//   agent_code    text FK
//   coverage_type text  (Motor|CMI|Travel|Fire|...)
//   plate, model, plate_province  text
//   premium       numeric
//   policy_start, policy_end      date
//   policy_status text  (CHECK: active|overdue|cancelled|dropped|expired|reinstated|void)
//   pay_mode      text  (cash|installment|...)
//   ocr_data      jsonb
//   notes         text  (also stores [policy_no:...] [doc:...] [extra:...])
//   user_id       uuid

export const POLICY_STATUSES = [
  'active', 'overdue', 'cancelled', 'dropped', 'expired', 'reinstated', 'void',
]

export const CANCELLED_STATUSES = ['cancelled', 'dropped', 'expired', 'void']
