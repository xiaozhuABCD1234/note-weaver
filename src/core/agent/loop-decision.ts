import type { AgentContext, AgentDecision } from "./types";

export function decideNext(context: AgentContext): AgentDecision {
  if (context.toolRounds >= context.maxToolRounds) {
    return "stop";
  }
  if (context.lastError) {
    return "stop";
  }
  if (!context.hasToolCalls) {
    return "stop";
  }
  return "continue";
}
