// Schema reference (public.payments):
//   id              uuid PK
//   installment_id  uuid FK → installments.id  (ON DELETE CASCADE)
//   user_id         uuid (RLS key)
//   amount          numeric(12,2) NOT NULL  CHECK (amount >= 0)
//   channel         text FK → payment_channels.code (nullable)
//   slip_path       text  — storage path in `payment-slips` bucket; NEVER a URL
//   paid_at         timestamptz NOT NULL
//   notes           text
//   created_at      timestamptz

export const PAYMENT_CHANNELS = [
  { code: 'insurer_transfer', label: 'โอนเข้าบริษัทประกันโดยตรง' },
  { code: 'cash',             label: 'เงินสด' },
  { code: 'credit_card',      label: 'บัตรเครดิต' },
  { code: 'agent_transfer',   label: 'โอนเข้าตัวแทน' },
  { code: 'other',            label: 'อื่นๆ' },
]
