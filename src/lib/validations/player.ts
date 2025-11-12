import { SkillTier } from "@prisma/client";
import { z } from "zod";

export const playerSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().min(3).max(30).optional().or(z.literal("")),
  skillTier: z.nativeEnum(SkillTier).default(SkillTier.INTERMEDIATE),
});

export const playerUpdateSchema = playerSchema
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    "At least one field must be provided"
  );

type PlayerInput = z.infer<typeof playerSchema>;

type PlayerUpdateInput = z.infer<typeof playerUpdateSchema>;

export type { PlayerInput, PlayerUpdateInput };
