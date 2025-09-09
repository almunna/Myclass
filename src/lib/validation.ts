import { z } from "zod"

// Individual field schemas for real-time validation
export const usernameSchema = z.string()
  .min(3, "Username must be at least 3 characters long")
  .max(20, "Username must be less than 20 characters")
  .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores")
  .refine((username) => !username.startsWith("_") && !username.endsWith("_"), 
    "Username cannot start or end with underscore")

export const emailSchema = z.string()
  .email("Please enter a valid email address")

export const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters long")
  .max(128, "Password must be less than 128 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character")

// Main signup schema with all validations including password confirmation
export const signupSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

export type SignupSchema = z.infer<typeof signupSchema> 