import z from "zod";

const AddressDetailsSchema = z.object({
  name: z.string().min(1, "Name is required"),
  address: z.string().min(1, "Address is required"),
  addressLine2: z.string().optional().or(z.literal('')),
  postalCode: z.string().min(1, "Postal code is required"),
  city: z.string().min(1, "City is required"),
  country: z.string().length(2, "Country is required"),
});

const sendDateSchema = z
  .string()
  // ✅ Match YYYY-MM-DD format
  .regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: "Date must be in YYYY-MM-DD format",
  })
  // ✅ Must be today or later
  .refine((dateStr) => {
    const today = new Date().toISOString().split('T')[0];
    return dateStr >= today;
  }, {
    message: "Send date must be today or in the future",
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