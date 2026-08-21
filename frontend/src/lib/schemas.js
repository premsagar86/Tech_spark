import { z } from "zod";

const fullNameField = z
  .string()
  .trim()
  .min(3, "Name must be at least 3 letters")
  .regex(/^[A-Za-z]+(?:\s[A-Za-z]+)*$/, "Name must contain only alphabets");

const rollNumberField = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9]+$/, "Roll number must be alphanumeric");

export const personalDetailsSchema = z.object({
  fullName: fullNameField,
  rollNumber: rollNumberField,
  college: z.string().min(1, "Required"),
  course: z.string().min(1, "Required"),
  branch: z.string().min(1, "Required"),
  year: z.enum(["1st year", "2nd year", "3rd year"], { errorMap: () => ({ message: "Required" }) }),
  mobile: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
  email: z.string().email("Enter a valid email"),
});

// max/min team size come from the fetched event object at runtime — see StepTeamMembers.jsx
export const teamMemberSchema = z.object({
  fullName: fullNameField,
  rollNumber: rollNumberField,
  college: z.string().min(1, "Required"),
  course: z.string().min(1, "Required"),
  branch: z.string().min(1, "Required"),
  year: z.enum(["1st year", "2nd year", "3rd year"], { errorMap: () => ({ message: "Required" }) }),
  mobile: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
  email: z.string().email("Enter a valid email"),
});

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  mobile: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
});

export const magicLinkRequestSchema = z.object({
  email: z.string().email("Enter a valid email"),
});
