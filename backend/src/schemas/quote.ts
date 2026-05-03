import { z } from "zod";

export const QuoteRequestSchema = z.object({
  pickup_address:   z.string().min(1, "pickup_address is required"),
  delivery_address: z.string().min(1, "delivery_address is required"),
  client_name:      z.string().min(1, "client_name is required"),
  client_phone:     z.string().min(9, "client_phone must be at least 9 characters"),
  customer_email:   z.string().email("customer_email must be a valid email"),
  scheduled_date:   z.string().min(1, "scheduled_date is required"),
  scheduled_time:   z.string().min(1, "scheduled_time is required"),
  package_size:     z.enum(["small", "medium", "large"], {
    errorMap: () => ({ message: "package_size must be small, medium or large" }),
  }),
  client_notes:  z.string().optional(),
  pickup_lat:    z.number().nullable().optional(),
  pickup_lng:    z.number().nullable().optional(),
  delivery_lat:  z.number().nullable().optional(),
  delivery_lng:  z.number().nullable().optional(),
});

export type QuoteRequest = z.infer<typeof QuoteRequestSchema>;
