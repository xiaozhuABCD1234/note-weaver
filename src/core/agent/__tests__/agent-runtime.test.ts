import { describe, it, expect, jest } from "@jest/globals";
import type { ApiMessage, StreamEvent, ToolDefinition } from "@/types";
import type { IChatClient } from "../types";
import { AgentRuntime } from "../agent-runtime";
import { ToolGateway } from "../tool-gateway";

class MockChatClient implements IChatClient {
  private responses: StreamEvent[][] = [];
  private callCount = 0;

  constructor(responses: StreamEvent[][]) {
    this.responses = responses;
  }

  async *chat(
    _messages: ApiMessage[],
    _tools: ToolDefinition[],
    _signal?: AbortSignal,
  ): AsyncGenerator<StreamEvent> {
    const events = this.responses[this.callCount];
    if (!events) return;
    this.callCount++;
    for (const event of events) {
      yield event;
    }
  }

  getCallCount(): number {
    return this.callCount;
  }
}

function createGateway(): ToolGateway {
  const gateway = new ToolGateway();
  gateway.register(
    "echo",
    async (args) => ({ content: JSON.stringify(args) }),
    {
      type: "function",
      function: {
        name: "echo",
        description: "Echo back arguments",
        parameters: { type: "object", properties: { msg: { type: "string" } } },
      },
    },
  );
  return gateway;
}

function baseConfig() {
  return {
    model: "test-model",
    maxTokens: 1000,
    maxToolRounds: 5,
    thinkingMode: false,
    reasoningEffort: "high",
  };
}

describe("AgentRuntime", () => {
  it("returns content from a simple text response", async () => {
    const client = new MockChatClient([
      [{ type: "content", content: "Hello, world!" }],
    ]);
    const runtime = new AgentRuntime(client, createGateway(), baseConfig());

    const result = await runtime.run([
      { role: "user", content: "Say hello" },
    ]);

    expect(result.content).toBe("Hello, world!");
    expect(result.toolRounds).toBe(0);
  });

  it("executes tools and continues loop when tool calls returned", async () => {
    const toolArgs = { msg: "hello from tool" };
    const client = new MockChatClient([
      [
        { type: "content", content: "Let me use a tool" },
        {
          type: "tool_calls",
          calls: [{
            id: "call_1",
            type: "function",
            function: { name: "echo", arguments: JSON.stringify(toolArgs) },
          }],
          reasoningContent: "",
        },
      ],
      [
        { type: "content", content: "Tool result: " + JSON.stringify(toolArgs) },
      ],
    ]);
    const runtime = new AgentRuntime(client, createGateway(), baseConfig());

    const result = await runtime.run([
      { role: "user", content: "Use echo tool" },
    ]);

    expect(result.content).toBe("Let me use a toolTool result: " + JSON.stringify(toolArgs));
    expect(result.toolRounds).toBe(1);
  });

  it("stops when max tool rounds reached", async () => {
    const toolArgs = { msg: "loop" };
    const toolCallResponse: StreamEvent = {
      type: "tool_calls",
      calls: [{
        id: "call_1",
        type: "function",
        function: { name: "echo", arguments: JSON.stringify(toolArgs) },
      }],
      reasoningContent: "",
    };

    // Each response contains tool calls to trigger the loop again
    const client = new MockChatClient([
      [toolCallResponse],
      [toolCallResponse],
      [toolCallResponse],
      [toolCallResponse],
      [toolCallResponse],
      [toolCallResponse], // this one shouldn't be reached
    ]);
    const runtime = new AgentRuntime(
      client,
      createGateway(),
      { ...baseConfig(), maxToolRounds: 5 },
    );

    const result = await runtime.run([
      { role: "user", content: "Loop" },
    ]);

    expect(result.toolRounds).toBe(5);
    expect(client.getCallCount()).toBe(5);
  });

  it("calls onStream callback for content deltas", async () => {
    const client = new MockChatClient([
      [
        { type: "content", content: "Hello " },
        { type: "content", content: "World" },
      ],
    ]);
    const runtime = new AgentRuntime(client, createGateway(), baseConfig());
    const onStream = jest.fn();

    await runtime.run(
      [{ role: "user", content: "Say hi" }],
      undefined,
      onStream,
    );

    expect(onStream).toHaveBeenCalledTimes(2);
    expect(onStream).toHaveBeenNthCalledWith(1, "Hello ");
    expect(onStream).toHaveBeenNthCalledWith(2, "World");
  });

  it("handles abort signal", async () => {
    const client = new MockChatClient([
      [{ type: "content", content: "Partial content" }],
    ]);
    const runtime = new AgentRuntime(client, createGateway(), baseConfig());
    const controller = new AbortController();
    controller.abort();

    // The mock doesn't check the AbortSignal, but the runtime should
    // propagate the signal. Since our mock doesn't check it, this
    // just verifies the signal is accepted.
    const result = await runtime.run(
      [{ role: "user", content: "test" }],
      controller.signal,
    );
    expect(result.content).toBe("Partial content");
  });
});
