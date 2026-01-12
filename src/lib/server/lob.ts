
// Constants
const API_URL_POSTCARDS = 'https://api.lob.com/v1/postcards';
const API_URL_INTL_VER = 'https://api.lob.com/v1/intl_verifications';
const API_URL_US_VER = 'https://api.lob.com/v1/us_verifications';


export function initPostalClient({ apiKey }: { apiKey: string }) {
  return {
    verifyUSAddress: (payload: AddressLob) => {
      const body = new URLSearchParams({
        recipient: payload.name,
        primary_line: payload.address_line1,
        secondary_line: payload.address_line2 ?? '',
        city: payload.address_city!,
        state: payload.address_state!,
        postal_code: payload.address_zip,
      });
      return fetch(API_URL_US_VER, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });
    },
    verifyInternationalAddress: (payload: AddressLob) => {
      const body = new URLSearchParams({
        recipient: payload.name,
        primary_line: payload.address_line1,
        secondary_line: payload.address_line2 ?? '',
        city: payload.address_city ?? '',
        state: payload.address_state ?? '',
        postal_code: payload.address_zip,
        country: payload.address_country,
      });
      return fetch(API_URL_INTL_VER, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });
    },
    createNewOrder:(payload: PostcardPayload) => {
      return fetch(API_URL_POSTCARDS, {
        method: 'POST',
        headers: {
          "Authorization": `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    }
  }
}

// --- Types ---

// Base address fields
type BaseAddress = {
  name: string;
  company?: string;
  address_line1: string;
  address_line2?: string;
  email?: string;
  phone?: string;
  description?: string;
};
// US Address (domestic)
type USAddress = BaseAddress & {
  address_city: string;
  address_state: string;
  address_zip: string;
  address_country: 'US';
};
// International Address
type IntlAddress = BaseAddress & {
  address_city?: string;
  address_state?: string;
  address_zip: string;
  address_country: string; // 2-letter country code (ISO 3166), excluding US territories
};

export type AddressLob = USAddress | IntlAddress;


type MergeVariables = {
  [key: string]: string; // Allows any key-value pair where both are strings
};

type Metadata = {
  [key: string]: string; // Or more specific types if known
};

type QrCode = {
  position: string;
  redirect_url: string;
  width: string;
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  pages: string;
};

export type PostcardPayload = {
  to: AddressLob;
  from?: AddressLob | string;
  front: string;
  back: string;
  size: "4x6" | "6x9" | "6x11";
  mail_type?: "usps_first_class" | "usps_standard";
  description?: string;
  metadata?: Metadata;
  use_type?: "marketing"|"operational";
  merge_variables?: MergeVariables;
  qr_code?: QrCode;
  // send_date?: string; // ISO 8601 date-time string // NOT SUPPORTED!
  // fsc?: boolean; // NOT SUPPORTED!
  // print_speed?: "core"; // NOT SUPPORTED!
};

export type PostcardResponse = {
  id: string;
  description: string | null;
  metadata: Record<string, unknown>; // Flexible metadata object
  to: AddressLob;
  url: string;
  carrier: string;
  front_template_id: string | null;
  back_template_id: string | null;
  date_created: string; // ISO 8601 date-time string
  date_modified: string; // ISO 8601 date-time string
  send_date: string; // ISO 8601 date-time string
  use_type: string;
  fsc: boolean;
  sla: string; // Assuming SLA is represented as a string
  object: 'postcard';
};
