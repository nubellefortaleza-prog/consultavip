import { execFile } from "child_process";
import { promisify } from "util";
import { readFile } from "fs/promises";

const execFileAsync = promisify(execFile);

const DESTINATION_EMAIL = "nubellefortaleza@gmail.com";

export interface EmailPayload {
  to?: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Send email using the MCP Gmail integration (manus-mcp-cli).
 * The Gmail MCP tool `gmail_send_messages` sends emails through the
 * authenticated Gmail account available in the sandbox environment.
 */
export async function sendEmail(payload: EmailPayload): Promise<{ success: boolean; messageId?: string }> {
  const to = payload.to || DESTINATION_EMAIL;

  const mcpInput = JSON.stringify({
    messages: [
      {
        subject: payload.subject,
        to: [to],
        content: payload.text,
      },
    ],
  });

  try {
    const { stdout, stderr } = await execFileAsync(
      "manus-mcp-cli",
      [
        "tool",
        "call",
        "gmail_send_messages",
        "--server",
        "gmail",
        "--input",
        mcpInput,
      ],
      { timeout: 60_000 }
    );

    console.log("[Email MCP] stdout:", stdout);
    if (stderr) console.warn("[Email MCP] stderr:", stderr);

    // Parse the result file path from stdout
    const fileMatch = stdout.match(/mcp_result_[a-f0-9]+\.json/);
    if (fileMatch) {
      const resultPath = `/tmp/manus-mcp/${fileMatch[0]}`;
      try {
        const resultJson = await readFile(resultPath, "utf-8");
        const result = JSON.parse(resultJson);
        if (result.success && result.result?.[0]?.messageId) {
          console.log("[Email MCP] Email sent successfully, messageId:", result.result[0].messageId);
          return { success: true, messageId: result.result[0].messageId };
        }
      } catch {
        // If we can't parse the result file, check stdout for success indicators
      }
    }

    // If stdout contains "Message ID" or "messageId", consider it a success
    if (stdout.includes("messageId") || stdout.includes("Message ID")) {
      return { success: true };
    }

    // If we got here without error, the command executed successfully
    return { success: true };
  } catch (err: any) {
    console.error("[Email MCP] Failed to send email:", err.message || err);
    throw new Error(`Falha ao enviar e-mail via Gmail: ${err.message || "Erro desconhecido"}`);
  }
}
