import type { AddressDetails } from "./send.remote";


export const POSTCARD = { 
  cost_label: "3€",
  cost_unit: 300,
  type: "image/jpeg",
  size: { w: 1819, h: 1311 },
  url_delivery_times: "https://www.postnl.nl/api/assets/blt43aa441bfc1e29f2/blt6d6203f1afe9f9aa/68199ff00c47c367afd62823/20250501-brochure-international-delivery-times.pdf",
}

/**
 * Workaround for SvelteKit `command`/`devalue` serialization issue:
 *
 * Korean (and other non-ASCII) characters can trigger `InvalidCharacterError`
 * when sent directly over the wire. To prevent this, we URL-encode all fields
 * before sending them to the server, and decode them again on receipt.
 *
 * 🚧 Remove once SvelteKit/devalue fully supports Unicode serialization.
 */
export function encodeAddressDetails(addr: AddressDetails) {
  return <AddressDetails> Object.fromEntries(
    Object.entries(addr).map(([k, v]) => [k, encodeURIComponent(v ?? '')])
  );
}

export function decodeAddressDetails(addr: AddressDetails) {
  return <AddressDetails> Object.fromEntries(
    Object.entries(addr).map(([k, v]) => [k, decodeURIComponent(v ?? '')])
  );
}
