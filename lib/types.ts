/**
 * Shared types for BostonPulse agent requests and responses.
 */
export interface AgentRequest {
  message: string;
  conversationHistory?: ChatMessage[];
}
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
export interface AgentResponse {
  answer: string;
  runId: string;
  toolCalls?: ToolCallInfo[];
}
export interface ToolCallInfo {
  name: string;
  input: Record<string, unknown>;
  output?: unknown;
}

const SYSTEM_PROMPT = `You are BostonPulse — Boston's real-time city intelligence assistant.
Live Boston data has already been fetched for you and is provided below — use it directly.
You also have web search, tweet search, fresh news search, and news search for additional context.

Use tweet_search to see what Bostonians are saying RIGHT NOW, and fresh_search for breaking local news.

Synthesize everything into ONE clear, actionable answer using this format:

🚇 **Transit**: [current MBTA status, any delays or shutdowns]
🌤️ **Weather**: [current conditions, anything riders should know]
🎉 **Events Tonight**: [games, concerts, major events]
📢 **City Buzz**: [what's trending on Twitter, breaking news]
💡 **Recommendation**: [one clear, specific action for the user]

RESPONSE RULES — follow strictly:
- Maximum 150 words total
- Use the emoji headers above — no other headings
- Each section: 1 short bullet point only
- No lengthy explanations, no full sentences where fragments work
- Be specific. Be local. Be useful.`;

import type { BostonLiveData } from "./boston-data";

function buildLiveDataBlock(data: BostonLiveData): string {
  return `--- LIVE BOSTON DATA (pre-fetched, use this directly) ---
🚇 MBTA Alerts:
${data.mbta}

🌤️ Weather:
${data.weather}

🎉 Events Today:
${data.events}
--- END LIVE DATA ---`;
}

/**
 * Flattens chat history + Boston system prompt into one instructions string.
 * Pass liveData to inject pre-fetched MBTA/weather/events context.
 */
export function buildInstructions(
  message: string,
  history?: ChatMessage[],
  liveData?: BostonLiveData,
): string {
  const dataBlock = liveData ? `\n\n${buildLiveDataBlock(liveData)}` : "";
  const base = `${SYSTEM_PROMPT}${dataBlock}`;

  if (!history?.length) {
    return `${base}\n\nUser query: ${message}`;
  }
  const conversation = history
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");
  return `${base}\n\n${conversation}\n\nUser: ${message}\n\nRespond to the user's latest message.`;
}

export interface ReasoningNode {
  title?: string;
  thought?: string;
  tooluse?: Array<{
    tool_name?: string;
    parameters?: Record<string, unknown>;
    tool_result?: unknown;
  }>;
  subtask?: ReasoningNode[];
  conclusion?: string;
}

export function extractToolCalls(reasoning?: ReasoningNode): ToolCallInfo[] {
  if (!reasoning) return [];
  const calls: ToolCallInfo[] = [];
  function traverse(node: ReasoningNode) {
    for (const tu of node.tooluse ?? []) {
      if (tu.tool_name) {
        calls.push({
          name: tu.tool_name,
          input: tu.parameters ?? {},
          output: tu.tool_result,
        });
      }
    }
    for (const sub of node.subtask ?? []) traverse(sub);
  }
  traverse(reasoning);
  return calls;
}