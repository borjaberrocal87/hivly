// Domain port: stream chat completions from the RAG agent's LLM. Pure — no
// LangChain. The adapter in infrastructure/ wraps the provider factory and
// keeps that import behind this contract, so the agent depends only on the
// interface (AD-2 spirit). Mirrors queryEmbedder.ts.

export interface ChatTurn {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatModel {
  /**
   * Stream the model's answer to `messages` as incremental text chunks. `signal`
   * cancels the in-flight provider request when the client disconnects, so paid
   * token generation stops instead of running to completion for a gone caller.
   */
  stream(messages: ChatTurn[], signal?: AbortSignal): AsyncIterable<string>;
}
