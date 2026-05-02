/**
 * Shared controls for order tracking + related OrderDetail actions (8px grid: gap-2, rounded-lg).
 */
export const orderTrackIconSm = "h-4 w-4 shrink-0";

const trackBtnBase =
  "inline-flex h-10 min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold leading-none transition-[color,background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.98] motion-reduce:active:scale-100 motion-reduce:transition-none disabled:pointer-events-none disabled:opacity-50";

const primaryGreenCore =
  "border border-emerald-700/15 bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 hover:border-emerald-700/20 active:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50";

const dangerPrimaryCore =
  "border border-rose-700/20 bg-rose-600 text-white shadow-sm hover:bg-rose-700 active:bg-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50";

/** Inline / toolbar (e.g. error state pair, review modal). */
export const orderTrackBtnPrimary = `${trackBtnBase} ${primaryGreenCore}`;

/** Full-width primary (tracking bar, footer card). */
export const orderTrackBtnPrimaryFull = `${trackBtnBase} w-full ${primaryGreenCore}`;

export const orderTrackBtnSecondary = `${trackBtnBase} flex-1 min-w-0 border border-slate-200 bg-white text-slate-800 shadow-sm hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/30 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50`;

/** Inline secondary without flex-1 (modal actions). */
export const orderTrackBtnSecondaryInline = `${trackBtnBase} border border-slate-200 bg-white text-slate-800 shadow-sm hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/30 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50`;

export const orderTrackBtnDangerOutline =
  `${trackBtnBase} flex-1 min-w-0 border border-rose-200 bg-white text-rose-700 shadow-sm hover:bg-rose-50 hover:border-rose-300 active:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/30 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50`;

/** Full-width destructive primary (e.g. footer “Cancel order” while searching). */
export const orderTrackBtnDangerPrimaryFull = `${trackBtnBase} w-full ${dangerPrimaryCore}`;
