// lib/domains/customer/types.js
// Schema reference (public.customers):
//   id          uuid PK
//   name        text
//   prefix, phone, email, id_number, inbox_name,
//   channel, tag, notes, province  text
//   birth_date  date
//   created_at, updated_at  timestamptz
//   user_id     uuid

export const CUSTOMER_CHANNELS = ['LINE', 'Facebook', 'Phone', 'Walk-in', 'Other']
