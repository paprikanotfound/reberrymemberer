import z from "zod";

const SendDateSchema = z
  .string()
  // ✅ Match YYYY-MM-DD format
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Date must be in YYYY-MM-DD format" })
  // ✅ Must be today or later
  .refine((dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    return dateStr >= today;
  }, {
    message: "Send date must be today or in the future",
  })
  .optional(); // Note: not supported yet.

// Single schema with conditional validation using superRefine
export const CheckoutSchema = z.object({
  name: z.string().max(40, "Name must be 40 characters or less"),
  address: z.string().min(1, "Address is required"),
  addressLine2: z.string().optional().or(z.literal('')),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string(),
  country: z.string().min(1, "Please select a country").length(2, "Invalid country code"),
  sendDate: SendDateSchema,
}).superRefine((data, ctx) => {
  const isUS = data.country === 'US';

  if (isUS) {
    // US Address validation
    if (data.address.length > 64) {
      ctx.addIssue({
        code: 'too_big',
        maximum: 64,
        origin: 'string',
        inclusive: true,
        message: "Address must be 64 characters or less for US addresses",
        path: ['address'],
      });
    }

    if (!data.city || data.city.trim() === '') {
      ctx.addIssue({
        code: 'custom',
        message: "City is required for US addresses",
        path: ['city'],
      });
    } else if (data.city.length > 200) {
      ctx.addIssue({
        code: 'too_big',
        maximum: 200,
        origin: 'string',
        inclusive: true,
        message: "City must be 200 characters or less",
        path: ['city'],
      });
    }

    if (!data.state || !(/^[a-zA-Z]{2}$/.test(data.state))) {
      ctx.addIssue({
        code: 'custom',
        message: "State must be a 2 letter state short-name code",
        path: ['state'],
      });
    }

    if (!data.postalCode || !(/^\d{5}(-\d{4})?$/.test(data.postalCode))) {
      ctx.addIssue({
        code: 'custom',
        message: "Must follow ZIP format of 12345 or ZIP+4 format of 12345-1234",
        path: ['postalCode'],
      });
    }
  } else {
    // International Address validation
    if (data.address.length > 200) {
      ctx.addIssue({
        code: 'too_big',
        maximum: 200,
        origin: 'string',
        inclusive: true,
        message: "Address must be 200 characters or less",
        path: ['address'],
      });
    }

    if (data.postalCode && data.postalCode.length > 40) {
      ctx.addIssue({
        code: 'too_big',
        maximum: 40,
        origin: 'string',
        inclusive: true,
        message: "Postal code must be 40 characters or less",
        path: ['postalCode'],
      });
    }

    // Validate country code is not US territory
    if (["US", "AS", "PR", "FM", "GU", "MH", "MP", "PW", "VI"].includes(data.country)) {
      ctx.addIssue({
        code: 'custom',
        message: "Country code not accepted for international addresses. Use US address type for US territories.",
        path: ['country'],
      });
    }
  }
});

export type CheckoutFormData = z.infer<typeof CheckoutSchema>;
