import { command, form, getRequestEvent } from "$app/server";
import { ROUTES } from "$lib";
import { CheckoutSchema } from "./checkout.types";
import { generateAddressLink } from "./server/crypto";
import type { LobAddress } from "./server/lob";


export const GetAddressLink = form(CheckoutSchema, async (request) => {
  const { platform, url } = getRequestEvent();
  
  const addressTo = {
    name: request.name,
    address_line1: request.address,
    address_line2: request.addressLine2,
    address_city: request.city,
    address_state: request.state,
    address_zip: request.postalCode,
    address_country: request.country,
  } satisfies LobAddress;

  const baseUrl = `${url.origin}${ROUTES.send}`;
  const link = await generateAddressLink(baseUrl, addressTo, platform!.env.ENCRYPTION_KEY);

  return { link };
});