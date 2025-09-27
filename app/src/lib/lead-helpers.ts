import { StatusEnum } from '@/lib/supabase'

export const CLOSE_STATUSES: StatusEnum[] = [
  'cash salary',
  'self employed',
  'NI',
  'ring more than 3 days',
  'salary low',
  'cibil issue'
]

export const deriveFinalStatus = (status: StatusEnum): 'open' | 'close' =>
  CLOSE_STATUSES.includes(status) ? 'close' : 'open'

type LeadLike = { final_status: string | null; created_at: string }

export const SORT_LEADS_BY_STATUS_AND_CREATED_AT = (
  a: LeadLike,
  b: LeadLike
) => {
  const aStatus = a.final_status ?? 'open'
  const bStatus = b.final_status ?? 'open'
  if (aStatus === 'close' && bStatus === 'open') return 1
  if (aStatus === 'open' && bStatus === 'close') return -1
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
}
