
export { createPersistedScribble, clearPersistedScribble, type PersistedScribble, type ScribbleContent } from './components/scribble-state.svelte';

export const POSTCARD_DETAILS = { 
  cost_label: "3€",
  cost_unit: 300,
  type: "image/jpeg",
  size: { w: 1819, h: 1311 },
  url_delivery_times: "https://www.postnl.nl/api/assets/blt43aa441bfc1e29f2/blt6d6203f1afe9f9aa/68199ff00c47c367afd62823/20250501-brochure-international-delivery-times.pdf",
}

export const ROUTES = {
  send: '/write',
  return: '/return',
}

export const BUCKET_PATHS = {
  // Delete objects after 30 day(s): "tmp/30/*" 
  uploadCheckoutAssetPath: (filename: string, isDevEnv: boolean) => `tmp/30/reberrymemberer/${isDevEnv ?"dev":"prod"}/${filename}`,
}

