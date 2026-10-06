/**
 * Rate limits — tune here. Fixed windows, in seconds.
 * Chosen to be invisible to a real customer and expensive for a script.
 */
export const LIMITS = {
  createDraft: { max: 10, windowSec: 3600 }, // per IP
  saveDraft: { max: 150, windowSec: 600 }, // per surprise (autosave is debounced)
  upload: { max: 40, windowSec: 600 }, // per surprise
  uploadPerIp: { max: 80, windowSec: 600 }, // per IP
  checkout: { max: 10, windowSec: 600 }, // per surprise
  publish: { max: 10, windowSec: 600 }, // per surprise
  report: { max: 5, windowSec: 3600 }, // per surprise
  statusPoll: { max: 200, windowSec: 600 }, // per surprise
  recover: { max: 5, windowSec: 900 }, // per IP
  recoverGlobal: { max: 300, windowSec: 900 }, // all IPs combined
  view: { max: 120, windowSec: 60 }, // per IP on /s/[token]
  events: { max: 60, windowSec: 600 }, // per IP
  adminLogin: { max: 5, windowSec: 900 }, // per IP
} as const;

export type LimitName = keyof typeof LIMITS;
