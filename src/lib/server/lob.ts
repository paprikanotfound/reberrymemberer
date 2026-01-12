
// Constants
const API_URL_POSTCARDS = 'https://api.lob.com/v1/postcards';
const API_URL_INTL_VER = 'https://api.lob.com/v1/intl_verifications';
const API_URL_US_VER = 'https://api.lob.com/v1/us_verifications';


export function initPostalClient({ apiKey }: { apiKey: string }) {
  return {
    testAddresses: {
      intl: {
        deliverable: "deliverable",
        deliverable_missing_info: "deliverable missing info",
        undeliverable: "undeliverable",
        no_match: "no match",
      },
      us: {
        deliverable: "deliverable",
        deliverable_missing_unit: "missing unit",
        deliverable_incorrect_unit: "incorrect unit",
        deliverable_unnecessary_unit: "unnecessary unit",
        undeliverable: "undeliverable block match",
      }
    },
    verifyUSAddress: async (payload: LobAddress) => {
      const body = new URLSearchParams({
        recipient: payload.name,
        primary_line: payload.address_line1,
        secondary_line: payload.address_line2 ?? '',
        city: payload.address_city!,
        state: payload.address_state!,
        postal_code: payload.address_zip,
      });
      const response = await fetch(API_URL_US_VER, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`US address verification failed: ${response.status} ${response.statusText} - ${errorBody}`);
      }

      return await response.json() as USVerificationResponse;
    },
    verifyInternationalAddress: async (payload: LobAddress) => {
      const body = new URLSearchParams({
        recipient: payload.name,
        primary_line: payload.address_line1,
        secondary_line: payload.address_line2 ?? '',
        city: payload.address_city ?? '',
        state: payload.address_state ?? '',
        postal_code: payload.address_zip,
        country: payload.address_country,
      });
      const response = await fetch(API_URL_INTL_VER, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`International address verification failed: ${response.status} ${response.statusText} - ${errorBody}`);
      }

      return await response.json() as IntlVerificationResponse;
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

export type PostalClient = ReturnType<typeof initPostalClient>;


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

export type LobAddress = USAddress | IntlAddress;

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
  to: LobAddress;
  from?: LobAddress | string;
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
  to: LobAddress;
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


// --- US verification --- 

type AddressComponents = {
  primary_number: string;
  street_predirection: string;
  street_name: string;
  street_suffix: string;
  street_postdirection: string;
  secondary_designator: string;
  secondary_number: string;
  pmb_designator: string;
  pmb_number: string;
  extra_secondary_designator: string;
  extra_secondary_number: string;
  city: string;
  state: string;
  zip_code: string;
  zip_code_plus_4: string;
  zip_code_type: string;
  delivery_point_barcode: string;
  address_type: string;
  record_type: string;
  default_building_address: boolean;
  county: string;
  county_fips: string;
  carrier_route: string;
  carrier_route_type: string;
  po_box_only_flag: string;
  latitude: number;
  longitude: number;
};

type DeliverabilityAnalysis = {
  dpv_confirmation: string;
  dpv_cmra: string;
  dpv_vacant: string;
  dpv_active: string;
  dpv_inactive_reason: string;
  dpv_throwback: string;
  dpv_non_delivery_day_flag: string;
  dpv_non_delivery_day_values: string;
  dpv_no_secure_location: string;
  dpv_door_not_accessible: string;
  dpv_footnotes: string[];
  ews_match: boolean;
  lacs_indicator: string;
  lacs_return_code: string;
  suite_return_code: string;
};

type LobConfidenceScore = {
  score: number;
  level: string;
};

type USVerificationResponse = {
  id: string;
  recipient: string;
  primary_line: string;
  secondary_line: string;
  urbanization: string;
  last_line: string;
  deliverability: "deliverable" | "deliverable_unnecessary_unit" | "deliverable_incorrect_unit" | "deliverable_missing_unit" | "undeliverable";
  valid_address: boolean;
  components: AddressComponents;
  deliverability_analysis: DeliverabilityAnalysis;
  lob_confidence_score: LobConfidenceScore;
  object: 'us_verification';
};


// --- Intl verification --- 

type IntlVerificationComponents = {
  primary_number: string;
  street_name: string;
  city: string;
  state: string;
  postal_code: string;
};

type IntlVerificationResponse = {
  id: string;
  recipient: string | null;
  primary_line: string;
  secondary_line: string;
  last_line: string;
  country: string;
  coverage: "SUBBUILDING" | "HOUSENUMBER/BUILDING" | "STREET" | "LOCALITY" | "SPARSE";
  deliverability: "deliverable" | "deliverable_missing_info" | "undeliverable" | "no_match";
  status: string;
  components: IntlVerificationComponents;
  object: 'intl_verification';
};
