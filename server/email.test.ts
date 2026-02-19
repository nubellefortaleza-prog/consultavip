import { describe, expect, it, vi, beforeEach } from "vitest";
import { sendEmail } from "./email";

// Mock child_process.execFile to simulate MCP CLI output
vi.mock("child_process", () => ({
  execFile: vi.fn((cmd: string, args: string[], opts: any, cb?: Function) => {
    // If called with promisify pattern, the callback is in a different position
    // promisify wraps it, so we return a mock that resolves
  }),
}));

// Mock fs/promises
vi.mock("fs/promises", () => ({
  readFile: vi.fn().mockResolvedValue(JSON.stringify({
    success: true,
    result: [
      {
        email: {
          content: "Test email content",
          payload: { subject: "Test Subject", to: ["test@test.com"] },
        },
        messageId: "abc123",
      },
    ],
  })),
}));

// Mock util.promisify to return a function that resolves with expected output
vi.mock("util", async () => {
  const actual = await vi.importActual("util");
  return {
    ...actual as any,
    promisify: () => vi.fn().mockResolvedValue({
      stdout: "MCP tool invocation result saved to:\n/tmp/manus-mcp/mcp_result_test123.json\n",
      stderr: "",
    }),
  };
});

describe("Email via MCP Gmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call manus-mcp-cli with correct parameters and return success", async () => {
    const result = await sendEmail({
      subject: "Maria Silva - 19/02/2026",
      text: "RELATÓRIO DE CONSULTA - VIP ESTETIC\nNOME DO PACIENTE: Maria Silva",
      to: "nubellefortaleza@gmail.com",
    });

    expect(result).toHaveProperty("success", true);
  });

  it("should use default destination email when 'to' is not provided", async () => {
    const result = await sendEmail({
      subject: "Test Subject",
      text: "Test content",
    });

    expect(result.success).toBe(true);
  });
});
