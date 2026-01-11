
// Constants
const API_URL_POSTCARDS = 'https://api.lob.com/v1/postcards';

export function initPostalProvider({ apiKey }: { apiKey: string }) {
  return {
    createNewOrder: async (payload: PostcardPayload) => {

      // TODO: address verification

      const formData = new URLSearchParams();
      formData.append('description', payload.description);

      // Handle name (can be null)
      if (payload.to.name) {
        formData.append('to[name]', payload.to.name);
      }

      formData.append('to[address_line1]', payload.to.address_line1);

      if (payload.to.address_line2) {
        formData.append('to[address_line2]', payload.to.address_line2);
      }

      // Handle address fields based on type (US vs International)
      if (payload.to.address_country === 'US') {
        // US Address - all fields required
        const usAddress = payload.to as USAddress;
        formData.append('to[address_city]', usAddress.address_city);
        formData.append('to[address_state]', usAddress.address_state);
        formData.append('to[address_zip]', usAddress.address_zip);
      } else {
        // International Address - some fields optional
        const intlAddress = payload.to as IntlAddress;

        if (intlAddress.address_city) {
          formData.append('to[address_city]', intlAddress.address_city);
        }
        if (intlAddress.address_state) {
          formData.append('to[address_state]', intlAddress.address_state);
        }
        if (intlAddress.address_zip) {
          formData.append('to[address_zip]', intlAddress.address_zip);
        }
      }

      formData.append('to[address_country]', payload.to.address_country);
      formData.append('from', 'adr_d07414d6c6ff34b7'); // default Lob address
      formData.append('front', payload.front);
      formData.append('back', payload.back);
      formData.append('use_type', payload.use_type);

      if (payload.send_date) {
        formData.append('send_date', payload.send_date);
      }

      return await fetch(API_URL_POSTCARDS, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${apiKey}:`)}`, // Basic auth encoding
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });
    }
  }
}

// Base address fields
type BaseAddress = {
  name: string;
  address_line1: string;
  address_line2?: string | null;
  email?: string | null;
  phone?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown>;
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
  address_zip: string | null;
  address_country: string; // 2-letter country code (ISO 3166), excluding US territories
};

type Address = USAddress | IntlAddress;

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
  description: string;
  to: Address;
  from: Address | string;
  front: string;
  back: string;
  size: "4x6" | "6x9" | "6x11";
  mail_type: string;
  merge_variables?: MergeVariables;
  metadata?: Metadata;
  send_date?: string; // ISO 8601 date-time string
  use_type: "marketing"|"operational";
  qr_code?: QrCode;
  fsc: boolean;
  print_speed: "core";
};

export type PostcardResponse = {
  id: string;
  description: string | null;
  metadata: Record<string, unknown>; // Flexible metadata object
  to: Address;
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
