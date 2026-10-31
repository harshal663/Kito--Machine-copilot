import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const machineCreateSchema = z.object({
  name: z.string().min(1, "Machine name is required.").max(100),
  machine_type: z.string().min(1, "Machine type is required (e.g. Slurry Pump, Compressor).").max(50),
  model: z.string().max(100).optional().nullable(),
  rated_rpm: z.coerce.number().positive().max(100000).optional().nullable(),
  supervisor_name: z.string().max(100).optional().nullable(),
  supervisor_phone: z
    .string()
    .min(10, "Phone number must be at least 10 digits.")
    .regex(/^\+[1-9]\d{7,14}$/, "Must be a valid international phone number (e.g. +919876543210)."),
  backup_phone: z
    .string()
    .regex(/^\+[1-9]\d{7,14}$/, "Must be a valid international phone number.")
    .optional()
    .nullable()
    .or(z.literal("")),
  language: z.string().default("en"),
});

export type MachineCreateFormData = z.infer<typeof machineCreateSchema>;

export const decisionSchema = z.object({
  decision: z.enum(["ACKNOWLEDGED", "INSPECTION_SCHEDULED", "SHUTDOWN_REQUESTED"]),
  note: z.string().max(500).optional(),
});

export type DecisionFormData = z.infer<typeof decisionSchema>;
