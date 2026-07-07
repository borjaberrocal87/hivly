// Infrastructure adapter: LangChain-backed ChatModel. The ONLY agent-side file
// that imports the provider factory — LangChain stays behind this boundary and
// never leaks into the graph/service (AD-2 spirit). Mirrors queryEmbedder.langchain.ts.
import type { HivlyConfig } from '@hivly/shared';
import { AIMessage, HumanMessage, SystemMessage, type BaseMessage } from '@langchain/core/messages';
import { createChatModel } from '@hivly/shared/providers';

import type { ChatModel, ChatTurn } from '../domain/repositories/chatModel.js';

function toLangchainMessage(turn: ChatTurn): BaseMessage {
  switch (turn.role) {
    case 'system':
      return new SystemMessage(turn.content);
    case 'assistant':
      return new AIMessage(turn.content);
    case 'user':
      return new HumanMessage(turn.content);
    default: {
      const exhaustive: never = turn.role;
      throw new Error(`Unknown chat turn role: ${String(exhaustive)}`);
    }
  }
}

/** A stream chunk's `.content` may be a plain string or a list of content parts
 * (e.g. some providers emit `{ type: 'text', text: '...' }` blocks). Normalize
 * to the plain text the port contracts for. */
function chunkToText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === 'object' && part !== null && 'text' in part
          ? String((part as { text: unknown }).text)
          : '',
      )
      .join('');
  }
  return '';
}

export function createLangchainChatModel(agent: HivlyConfig['agent']): ChatModel {
  // Build once; reuse across requests. No network I/O at construction.
  const model = createChatModel(agent);

  return {
    async *stream(messages: ChatTurn[], signal?: AbortSignal): AsyncIterable<string> {
      const langchainMessages = messages.map(toLangchainMessage);
      // Pass the abort signal into the provider request so a client disconnect
      // cancels generation mid-flight (LangChain honors RunnableConfig.signal).
      const stream = await model.stream(langchainMessages, { signal });
      for await (const chunk of stream) {
        const text = chunkToText(chunk.content);
        if (text) yield text;
      }
    },
  };
}
