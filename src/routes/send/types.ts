import z from "zod";
import { m } from "$lib/paraglide/messages";

const AddressDetailsSchema = z.object({
  name: z.string().min(1, m["error.name_required"]()),
  address: z.string().min(1, m["error.address_required"]()),
  addressLine2: z.string().optional().or(z.literal('')),
  postalCode: z.string().min(1, m["error.postal_required"]()),
  city: z.string().min(1, m["error.city_required"]()),
  country: z.string().length(2, m["error.country_required"]()),
});

const sendDateSchema = z
  .string()
  // ✅ Match YYYY-MM-DD format
  .regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: m["error.date_format"](),
  })
  // ✅ Must be today or later
  .refine((dateStr) => {
    const today = new Date().toISOString().split('T')[0];
    return dateStr >= today;
  }, {
    message: m["error.date_future"](),
  });

export const CheckoutRequestSchema = z.object({
  sender: AddressDetailsSchema,
  recipient: AddressDetailsSchema,
  sendDate: sendDateSchema,
  frontSize: z.number().positive(),
  frontType: z.string().min(1),
  backSize: z.number().positive(),
  backType: z.string().min(1),
});

export type AddressDetails = z.infer<typeof AddressDetailsSchema>;