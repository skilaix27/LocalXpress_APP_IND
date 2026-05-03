import { z } from "zod";

export const QuoteRequestSchema = z.object({
  pickup_address:   z.string().min(1, "pickup_address is required").max(500, "pickup_address too long"),
  delivery_address: z.string().min(1, "delivery_address is required").max(500, "delivery_address too long"),
  client_name:      z.string().min(1, "client_name is required").max(100, "client_name too long"),
  client_phone:     z.string().min(9, "client_phone must be at least 9 characters").max(20, "client_phone too long"),
  customer_email:   z.string().email("customer_email must be a valid email").max(254, "customer_email too long"),
  scheduled_date:   z.string().min(1, "scheduled_date is required").max(30, "scheduled_date too long"),
  scheduled_time:   z.string().min(1, "scheduled_time is required").max(50, "scheduled_time too long"),
  package_size:     z.enum(["small", "medium", "large"], {
    errorMap: () => ({ message: "package_size must be small, medium or large" }),
  }),
  client_notes:  z.string().max(1000, "client_notes too long").optional(),
  pickup_lat:    z.number().nullable().optional(),
  pickup_lng:    z.number().nullable().optional(),
  delivery_lat:  z.number().nullable().optional(),
  delivery_lng:  z.number().nullable().optional(),
});

export type QuoteRequest = z.infer<typeof QuoteRequestSchema>;
