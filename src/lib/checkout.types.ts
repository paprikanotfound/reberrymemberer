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
  });

export const AddressDetailsSchema = z.object({
  name: z.string().min(1, "Name is required"),
  address: z.string().min(1, "Address is required"),
  addressLine2: z.string().optional().or(z.literal('')),
  postalCode: z.string().min(1, "Postal code is required"),
  city: z.string().min(1, "City is required"),
  country: z.string().min(1, "Please select a country").length(2, "Invalid country code"),
  sendDate: SendDateSchema,
  frontImage: z.file().min(1, "Front page is required"),
  backImage: z.file().min(1, "Back page is required"),
});

export type AddressDetails = z.infer<typeof AddressDetailsSchema>;
