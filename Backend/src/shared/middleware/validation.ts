import { z } from 'zod';
import { HttpError } from './handler';

/**
 * Validate data against a Zod schema. Throws HttpError with field-level details on failure.
 */
export function validate<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join('.') || 'root';
      details[path] = issue.message;
    }
    throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid request data', details);
  }
  return result.data;
}

// ─── Reusable Schemas ───

export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const competitorCreateSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url(),
  pagesToTrack: z
    .array(z.enum(['pricing', 'features', 'homepage', 'blog', 'careers']))
    .min(1)
    .max(5),
});

export const onboardSchema = z.object({
  companyName: z.string().min(1).max(100),
  industry: z.string().min(1).max(100),
  competitors: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        url: z.string().url(),
        pagesToTrack: z
          .array(z.enum(['pricing', 'features', 'homepage', 'blog', 'careers']))
          .min(1)
          .max(5),
      })
    )
    .min(1)
    .max(25),
  // Consent capture: versions of ToS and Privacy the user accepted at sign-up.
  // The frontend keeps matching constants and sends them on submit.
  tosVersion: z.string().min(1).max(40).optional(),
  privacyVersion: z.string().min(1).max(40).optional(),
});

export const feedbackSchema = z.object({
  helpful: z.boolean(),
});
