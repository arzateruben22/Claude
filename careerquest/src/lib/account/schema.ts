import { z } from "zod";
import { passwordSchema } from "@/lib/validation/auth";

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password").max(128),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Repeat the new password").max(128),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] })
  .refine((v) => v.newPassword !== v.currentPassword, { message: "Choose a password you have not used before", path: ["newPassword"] });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const DELETE_CONFIRMATION = "DELETE";

export const deleteAccountSchema = z.object({
  confirm: z.string().trim().refine((v) => v === DELETE_CONFIRMATION, { message: `Type ${DELETE_CONFIRMATION} to confirm` }),
  password: z.string().min(1, "Enter your password").max(128),
});

export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

export const tokenNameSchema = z.object({
  name: z.string().trim().min(1, "Give the token a name").max(60, "Keep the name under 60 characters"),
});

export const tokenIdSchema = z.object({ tokenId: z.uuid("Unknown token") });
