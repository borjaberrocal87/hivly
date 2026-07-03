// SSE wire format for the chat stream (AD-4, AD-7). Chat streams over
// text/event-stream, not WebSocket; each frame is one of these four variants.
import { z } from 'zod';

export const SSEFrameSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('token'), content: z.string() }),
  z.object({
    type: z.literal('citation'),
    channel: z.string(),
    author: z.string(),
    date: z.string(),
  }),
  z.object({ type: z.literal('done'), conversationId: z.string() }),
  z.object({ type: z.literal('error'), code: z.string(), message: z.string() }),
]);

export type SSEFrame = z.infer<typeof SSEFrameSchema>;
