import { describe, it, expect } from "@jest/globals";
import { decideNext } from "../loop-decision";

describe("decideNext", () => {
  it("returns continue when tool calls remain and within limit", () => {
    const result = decideNext({
      toolRounds: 0,
      maxToolRounds: 10,
      hasToolCalls: true,
    });
    expect(result).toBe("continue");
  });

  it("returns stop when max tool rounds reached", () => {
    const result = decideNext({
      toolRounds: 10,
      maxToolRounds: 10,
      hasToolCalls: true,
    });
    expect(result).toBe("stop");
  });

  it("returns stop when no tool calls", () => {
    const result = decideNext({
      toolRounds: 0,
      maxToolRounds: 10,
      hasToolCalls: false,
    });
    expect(result).toBe("stop");
  });

  it("returns stop when there was an error", () => {
    const result = decideNext({
      toolRounds: 0,
      maxToolRounds: 10,
      hasToolCalls: true,
      lastError: "something went wrong",
    });
    expect(result).toBe("stop");
  });

  it("returns stop when exceeding max tool rounds", () => {
    const result = decideNext({
      toolRounds: 15,
      maxToolRounds: 10,
      hasToolCalls: true,
    });
    expect(result).toBe("stop");
  });
});
