import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock nodemailer
const mockSendMail = vi.fn().mockResolvedValue({ messageId: "mock-msg-123" });
vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn().mockReturnValue({
      sendMail: mockSendMail,
    }),
  },
}));

describe("Email via nodemailer SMTP", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SMTP_USER = "test@gmail.com";
    process.env.SMTP_PASS = "test-app-password";
  });

  it("should send email with correct parameters", async () => {
    const { sendEmail } = await import("./email");

    const result = await sendEmail({
      to: "nubellefortaleza@gmail.com",
      subject: "Maria Silva - 19/02/2026",
      text: "Relatório de consulta...",
      html: "<h1>Relatório</h1>",
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe("mock-msg-123");
    expect(mockSendMail).toHaveBeenCalledTimes(1);

    const call = mockSendMail.mock.calls[0][0];
    expect(call.to).toBe("nubellefortaleza@gmail.com");
    expect(call.subject).toBe("Maria Silva - 19/02/2026");
    expect(call.text).toBe("Relatório de consulta...");
    expect(call.html).toBe("<h1>Relatório</h1>");
    expect(call.from).toContain("ConsultaVip");
  });

  it("should use default destination email when 'to' is not provided", async () => {
    const { sendEmail } = await import("./email");

    await sendEmail({
      subject: "Test",
      text: "Test content",
    });

    const call = mockSendMail.mock.calls[0][0];
    expect(call.to).toBe("nubellefortaleza@gmail.com");
  });
});
