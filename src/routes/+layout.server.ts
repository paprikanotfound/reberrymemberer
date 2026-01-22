import { decryptAddressData } from '$lib/server/crypto';
import type { LobAddress } from '$lib/server/lob';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ url, platform, locals }) => {
  
  const addr = url.searchParams.get("addr");
  let prefillAddress: LobAddress|null = null;
  let addressLinkFailed = false;

  try {
    if (addr) {
      prefillAddress = await decryptAddressData(addr, platform!.env.ENCRYPTION_KEY) 
    }
  } catch (error) {
    console.error("+page.server - decryption error:", error);
    addressLinkFailed = true;
  }
  
  return {
    prefillAddress,
    addressLinkFailed,
    user: locals.user
  };
};