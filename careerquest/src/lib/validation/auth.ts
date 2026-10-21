import { z } from "zod";

export const emailSchema = z.email({ message: "Enter a valid email address" }).max(254).transform((v) => v.trim().toLowerCase());

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(128, "Password is too long")
  .refine((v) => /[a-zA-Z]/.test(v) && /[0-9]/.test(v), "Include at least one letter and one number");

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(80),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password").max(128),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
