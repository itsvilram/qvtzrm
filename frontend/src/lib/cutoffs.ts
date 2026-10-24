/**
 * Decision cutoffs offered in the UI (UK time). GB day-ahead auctions close at about 09:20
 * (EPEX SPOT) and 09:50 (N2EX); the default 09:00 comes from /api/meta.
 */
export const CUTOFF_OPTIONS = [
  { value: '07:00', label: '07:00' },
  { value: '08:00', label: '08:00' },
  { value: '09:00', label: '09:00' },
  { value: '09:20', label: '09:20 · EPEX close' },
  { value: '09:50', label: '09:50 · N2EX close' },
  { value: '11:00', label: '11:00' },
  { value: '12:00', label: '12:00' },
] as const

export const CUTOFF_VALUES: readonly string[] = CUTOFF_OPTIONS.map((option) => option.value)
