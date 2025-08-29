

export type OrderRequestPayload = {
  sender?: AddressDetails;
  recipient: AddressDetails;
  templateId: string;              // e.g. "tmpl_1234567890"
  finish: "GLOSSY" | "MATTE" | string; // assuming possible values
  mergeVariables: Record<string, string>; // dynamic variables like firstName, lastName
  billingId?: string;              // e.g. "my campaign name"
  sendDate?: string;              // ISO 8601 format string
  sendDateOffset?: number;        // e.g. -2
};

export type OrderResponse = {
  id: string;
  companyId: string;
  templateId: string;
  finish: "GLOSSY" | string;
  format: "POSTCARD_SQ15" | string;
  mergeVariables: Record<string, string>;
  sender: AddressDetails;
  recipient: AddressDetails;
  definitiveCountryId: string;
  region: string;
  deliverySpeed: "FAST" | string;
  stampId: string;
  billingId: string;
  isBillable: "true" | "false";
  status: string;
  friendlyStatus: string;
  errors: string[];
  warnings: string[];
  metadata: Record<string, string>;
  sendDate: string;       // ISO date string
  createdAt: string;
  updatedAt: string;
  anonymizedAt: string;
  csvOrderId: string;
};

export type AddressDetails = {
  name: string;
  address: string;
  addressLine2: string;
  postalCode: string;
  city: string;
  country: string;
};

export async function createPrintOneOrder(apiKey: string, apiUrl: string, payload: OrderRequestPayload) {
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": `${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  const data: OrderResponse = await response.json();
  
  return { response, data }
}