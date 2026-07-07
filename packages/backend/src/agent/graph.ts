// The RAG agent: a real LangGraph StateGraph (AD-11) with explicit nodes
// `retrieve → reason → respond`. No Express here (D1) — the agent is exposed as
// an async generator (`runChat`) so it stays unit-testable with fakes, mirroring
// searchService's no-Express rule. Token streaming does NOT wait for the graph
// to finish: `respond` emits `token` frames through LangGraph's custom stream
// channel (`getWriter`) as the model streams, and `runChat` forwards them live;
// citation + done frames are appended once the graph settles.
import {
  Annotation,
  END,
  START,
  StateGraph,
  getWriter,
  type LangGraphRunnableConfig,
} from '@langchain/langgraph';

import type { SearchFragment, SSEFrame } from '@hivly/shared/schemas';

import type { ChatModel, ChatTurn } from '../domain/repositories/chatModel.js';
import type { RagRetriever } from '../domain/repositories/ragRetriever.js';
import { buildRAGContext, SYSTEM_PROMPT } from './prompt.js';

/** Local cap on retrieved fragments — there is no `knowledge.topK` in config (D3). */
const RETRIEVE_TOP_K = 5;

const AgentState = Annotation.Root({
  /** The conversation so far, ending with the new user turn. */
  messages: Annotation<ChatTurn[]>(),
  allowedChannelIds: Annotation<string[]>(),
  retrievedFragments: Annotation<SearchFragment[]>(),
  conversationId: Annotation<string>(),
  /** Built by `reason`: [systemPrompt, ragContext, ...truncated history] fed to the model. */
  preparedMessages: Annotation<ChatTurn[]>(),
});

type AgentStateType = typeof AgentState.State;

function lastUserMessage(messages: ChatTurn[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === 'user') return messages[i].content;
  }
  return '';
}

function buildGraph(deps: { chatModel: ChatModel; ragRetriever: RagRetriever; memoryWindow: number }) {
  const { chatModel, ragRetriever, memoryWindow } = deps;

  async function retrieveNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
    const query = lastUserMessage(state.messages);
    const retrievedFragments = await ragRetriever.retrieve(
      query,
      state.allowedChannelIds,
      RETRIEVE_TOP_K,
    );
    return { retrievedFragments };
  }

  async function reasonNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
    // D3: memory_window is a turn-COUNT truncation window in 5.1, not summarization
    // (that's compressIfNeeded() in 5.2). Guard `<= 0`: `slice(-0)` === `slice(0)`
    // would return the FULL history (the opposite of "keep zero turns").
    const recentTurns = memoryWindow > 0 ? state.messages.slice(-memoryWindow) : [];
    const preparedMessages: ChatTurn[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'system', content: buildRAGContext(state.retrievedFragments) },
      ...recentTurns,
    ];
    return { preparedMessages };
  }

  async function respondNode(
    state: AgentStateType,
    config?: LangGraphRunnableConfig,
  ): Promise<Partial<AgentStateType>> {
    const emit = getWriter(config);
    // Thread the graph's abort signal (from graph.stream({ signal })) into the
    // leaf model call — LangGraph only checks the signal between super-steps, so
    // without this the `respond` node would drain the whole LLM stream even after
    // a client disconnect. config.signal cancels the in-flight provider request.
    for await (const chunk of chatModel.stream(state.preparedMessages, config?.signal)) {
      emit?.({ type: 'token', content: chunk } satisfies SSEFrame);
    }
    // Nothing to update in state — tokens were emitted through the writer, not
    // accumulated here; the controller only needs the frames, not the full text.
    return {};
  }

  // Open for extension (AD-11's optional tool_exec loop), closed for modification:
  // a future tool-call node would be added here, not folded into `reason`/`respond`.
  return new StateGraph(AgentState)
    .addNode('retrieve', retrieveNode)
    .addNode('reason', reasonNode)
    .addNode('respond', respondNode)
    .addEdge(START, 'retrieve')
    .addEdge('retrieve', 'reason')
    .addEdge('reason', 'respond')
    .addEdge('respond', END)
    .compile();
}

export interface RunChatInput {
  message: string;
  /** Prior turns already truncated/validated by the caller; new turn is appended here. */
  history: ChatTurn[];
  allowedChannelIds: string[];
  /** Resolved by chatService BEFORE the agent runs (creation/ownership already settled). */
  conversationId: string;
}

export interface RagAgent {
  runChat(input: RunChatInput, signal?: AbortSignal): AsyncIterable<SSEFrame>;
}

export function createRagAgent(deps: {
  chatModel: ChatModel;
  ragRetriever: RagRetriever;
  memoryWindow: number;
}): RagAgent {
  const graph = buildGraph(deps);

  return {
    async *runChat(input, signal): AsyncIterable<SSEFrame> {
      const messages: ChatTurn[] = [...input.history, { role: 'user', content: input.message }];

      const stream = await graph.stream(
        {
          messages,
          allowedChannelIds: input.allowedChannelIds,
          conversationId: input.conversationId,
        },
        { streamMode: ['custom', 'values'], signal },
      );

      let retrievedFragments: SearchFragment[] = [];
      for await (const [mode, chunk] of stream) {
        if (mode === 'custom') {
          yield chunk as SSEFrame;
        } else if (mode === 'values') {
          const values = chunk as AgentStateType;
          if (values.retrievedFragments) retrievedFragments = values.retrievedFragments;
        }
      }

      for (const fragment of retrievedFragments) {
        yield {
          type: 'citation',
          channel: fragment.channelName,
          author: fragment.authorName,
          date: fragment.createdAt,
        };
      }

      yield { type: 'done', conversationId: input.conversationId };
    },
  };
}
