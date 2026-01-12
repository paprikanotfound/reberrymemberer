
export { createPersistedScribble, clearPersistedScribble, type PersistedScribble, type ScribbleContent } from './components/scribble-state.svelte';

export const POSTCARD_CONFIG = {
  cost_label: "Each postcard costs $3.",
  cost_unit: 300,
  type: "image/jpeg",
  dimensions_label: "4x6 inches (10.16 x 15.24 cm)",
  // At 300 DPI
  bleed: { w: 1875, h: 1275 },     // 4.25" x 6.25" - final export size
  trim: { w: 1800, h: 1200 },      // 4" x 6" - user working size
  safe: { w: 1763, h: 1163 },      // 3.875" x 5.875"
  inkFree: {                       // Bottom-right ink-free area (relative to trim)
    w: 985,                         // 3.2835" at 300 DPI
    h: 713,                         // 2.375" at 300 DPI
    offsetBottom: 38,               // 0.125" at 300 DPI
    offsetRight: 45                 // 0.15" at 300 DPI
  }
}

export const ROUTES = {
  send: '/write',
  return: '/return',
}

export const APP_CONFIG = {
  scribble: {
    persist_front: "pf__",
    persist_back: "pb__",
  }
}