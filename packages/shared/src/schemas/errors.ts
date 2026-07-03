// Unified error contract (AD-6). Every service maps its errors to this shape at
// the edge; raw Discord/LLM/DB errors are never leaked to clients.
import { z } from 'zod';

export const ErrorSchema = z.object({
  error: z.string(),
  code: z.string(),
});

export type ErrorResponse = z.infer<typeof ErrorSchema>;
