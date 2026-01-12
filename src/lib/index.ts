
export { createPersistedScribble, clearPersistedScribble, type PersistedScribble, type ScribbleContent } from './components/scribble-state.svelte';

export const POSTCARD_DETAILS = { 
  cost_label: "Each postcard costs $3.",
  cost_unit: 300,
  type: "image/jpeg",
  size: { w: 1875, h: 1275 },
  dimensions_label: "4x6 inches (10.16 x 15.24 cm)",
  provider: {
    lob: { },
    printone: {
      url_delivery_times: "https://www.postnl.nl/api/assets/blt43aa441bfc1e29f2/blt6d6203f1afe9f9aa/68199ff00c47c367afd62823/20250501-brochure-international-delivery-times.pdf",
    }
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