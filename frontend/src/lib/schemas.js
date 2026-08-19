import { z } from "zod";

export const personalDetailsSchema = z.object({
  fullName: z.string().min(1, "Required"),
  rollNumber: z.string().min(1, "Required"),
  college: z.string().min(1, "Required"),
  course: z.string().min(1, "Required"),
  branch: z.string().min(1, "Required"),
  year: z.enum(["1st year", "2nd year", "3rd year"], { errorMap: () => ({ message: "Required" }) }),
  mobile: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
  email: z.string().email("Enter a valid email"),
});

// max/min team size come from the fetched event object at runtime — see StepTeamMembers.jsx
export const teamMemberSchema = z.object({
  fullName: z.string().min(1, "Required"),
  rollNumber: z.string().min(1, "Required"),
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
