import { z } from "zod";

const optionalCompanySchema = z.preprocess(
    (value) => {
        if (typeof value !== "string") return undefined;
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
    },
    z
        .string()
        .max(200, "Company name must be at most 200 characters")
        .optional()
);

export const profileUpdateSchema = z.object({
    name: z
        .string({ error: "Full name is required" })
        .trim()
        .min(2, "Name must be at least 2 characters")
        .max(100, "Name must be at most 100 characters"),
    company: optionalCompanySchema,
});

export type TProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
