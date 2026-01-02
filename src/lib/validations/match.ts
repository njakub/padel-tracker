import { z } from "zod";

const playerId = z.string().min(1, "Player is required");

const matchResultBaseSchema = z.object({
  team1Sets: z.number().int().min(0).max(5),
  team2Sets: z.number().int().min(0).max(5),
  notes: z.string().trim().max(500).optional(),
});

function validateMatchResultSets(
  data: { team1Sets: number; team2Sets: number },
  ctx: z.RefinementCtx
) {
  if (data.team1Sets === data.team2Sets) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Sets cannot tie",
      path: ["team1Sets"],
    });
  }
}

export const matchCreateSchema = z
  .object({
    seasonId: z.string().min(1, "Season is required"),
    matchNumber: z.number().int().min(1).optional(),
    date: z.coerce.date().optional(),
    court: z.string().trim().max(100).optional(),
    notes: z.string().trim().max(500).optional(),
    team1PlayerIds: z.array(playerId).length(2, "Select two players"),
    team2PlayerIds: z.array(playerId).length(2, "Select two players"),
    sitOutPlayerId: playerId.optional(),
  })
  .superRefine((data, ctx) => {
    const slots = [
      ...data.team1PlayerIds,
      ...data.team2PlayerIds,
      data.sitOutPlayerId,
    ].filter(Boolean) as string[];

    if (new Set(slots).size !== slots.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Players must be unique across all slots",
        path: ["team1PlayerIds"],
      });
    }
  });

export const matchResultSchema = matchResultBaseSchema.superRefine(
  (data, ctx) => validateMatchResultSets(data, ctx)
);

export type MatchCreateInput = z.infer<typeof matchCreateSchema>;
export type MatchResultInput = z.infer<typeof matchResultSchema>;

export const matchUpdateSchema = matchCreateSchema
  .safeExtend({
    matchId: z.string().min(1, "Match is required"),
    team1Sets: z.number().int().min(0).max(5).optional(),
    team2Sets: z.number().int().min(0).max(5).optional(),
  })
  .superRefine((data, ctx) => {
    const team1Sets = data.team1Sets;
    const team2Sets = data.team2Sets;

    const hasTeam1Sets = typeof team1Sets === "number";
    const hasTeam2Sets = typeof team2Sets === "number";

    if (hasTeam1Sets !== hasTeam2Sets) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide both scores or neither",
        path: ["team1Sets"],
      });
      return;
    }

    if (hasTeam1Sets && hasTeam2Sets) {
      validateMatchResultSets(
        {
          team1Sets,
          team2Sets,
        },
        ctx
      );
    }
  });

export type MatchUpdateInput = z.infer<typeof matchUpdateSchema>;

export const matchResultWithMatchSchema = matchResultBaseSchema
  .safeExtend({
    matchId: z.string().min(1, "Select a match"),
    playedAt: z.coerce.date({ message: "Enter the match date" }),
    court: z.string().trim().min(1, "Court is required").max(100),
  })
  .superRefine((data, ctx) => validateMatchResultSets(data, ctx));

export type MatchResultWithMatchInput = z.infer<
  typeof matchResultWithMatchSchema
>;
