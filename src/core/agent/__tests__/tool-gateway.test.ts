import { describe, it, expect } from "@jest/globals";
import { ToolGateway } from "../tool-gateway";

describe("ToolGateway", () => {
  it("registers and executes a tool handler", async () => {
    const gateway = new ToolGateway();

    gateway.register(
      "test_tool",
      async (args) => ({ content: `hello ${(args as { name: string }).name}` }),
      {
        type: "function",
        function: {
          name: "test_tool",
          description: "A test tool",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string" },
            },
            required: ["name"],
          },
        },
      },
    );

    const result = await gateway.execute("test_tool", { name: "world" });
    expect(result.content).toBe("hello world");
    expect(result.isError).toBeFalsy();
  });

  it("returns error for unknown tool", async () => {
    const gateway = new ToolGateway();
    const result = await gateway.execute("unknown_tool", {});
    expect(result.isError).toBe(true);
    expect(result.content).toContain("Unknown tool");
  });

  it("returns error when handler throws", async () => {
    const gateway = new ToolGateway();
    gateway.register(
      "broken_tool",
      async () => { throw new Error("something broke"); },
      {
        type: "function",
        function: {
          name: "broken_tool",
          description: "A broken tool",
          parameters: { type: "object", properties: {} },
        },
      },
    );

    const result = await gateway.execute("broken_tool", {});
    expect(result.isError).toBe(true);
    expect(result.content).toContain("something broke");
  });

  it("registers multiple tools at once", async () => {
    const gateway = new ToolGateway();
    gateway.registerMany([
      {
        name: "tool_a",
        handler: async () => ({ content: "a" }),
        definition: {
          type: "function",
          function: { name: "tool_a", description: "", parameters: { type: "object", properties: {} } },
        },
      },
      {
        name: "tool_b",
        handler: async () => ({ content: "b" }),
        definition: {
          type: "function",
          function: { name: "tool_b", description: "", parameters: { type: "object", properties: {} } },
        },
      },
    ]);

    expect(gateway.hasTool("tool_a")).toBe(true);
    expect(gateway.hasTool("tool_b")).toBe(true);
    expect(gateway.hasTool("tool_c")).toBe(false);
  });

  it("executeCalls handles multiple calls", async () => {
    const gateway = new ToolGateway();
    gateway.register(
      "echo",
      async (args) => ({ content: (args as { msg: string }).msg }),
      {
        type: "function",
        function: {
          name: "echo",
          description: "",
          parameters: { type: "object", properties: { msg: { type: "string" } }, required: ["msg"] },
        },
      },
    );

    const results = await gateway.executeCalls([
      { id: "1", type: "function", function: { name: "echo", arguments: '{"msg":"hello"}' } },
      { id: "2", type: "function", function: { name: "echo", arguments: '{"msg":"world"}' } },
    ]);

    expect(results).toHaveLength(2);
    expect(results[0]?.content).toBe("hello");
    expect(results[1]?.content).toBe("world");
  });

  it("getDefinitions returns registered tool definitions", () => {
    const gateway = new ToolGateway();
    gateway.register(
      "tool_a",
      async () => ({ content: "" }),
      {
        type: "function",
        function: {
          name: "tool_a",
          description: "Tool A",
          parameters: { type: "object", properties: {} },
        },
      },
    );

    const defs = gateway.getDefinitions();
    expect(defs).toHaveLength(1);
    expect(defs[0]?.function.name).toBe("tool_a");
  });

  it("clear removes all tools", () => {
    const gateway = new ToolGateway();
    gateway.register("t", async () => ({ content: "" }), {
      type: "function",
      function: { name: "t", description: "", parameters: { type: "object", properties: {} } },
    });
    expect(gateway.hasTool("t")).toBe(true);
    gateway.clear();
    expect(gateway.hasTool("t")).toBe(false);
    expect(gateway.getDefinitions()).toHaveLength(0);
  });
});
