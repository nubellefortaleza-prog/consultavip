import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { transcribeAudio } from "./_core/voiceTranscription";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { createConsultation, updateConsultation, getConsultationById, getConsultationsByUser, getUserByEmail } from "./db";
import { nanoid } from "nanoid";
import { GoogleGenAI } from "@google/genai";
import { ENV } from "./_core/env";
import { sendEmail } from "./email";
import { sdk } from "./_core/sdk";
import { verifyPassword } from "./_core/auth-utils";
import fs from "fs/promises";
import path from "path";

const DESTINATION_EMAIL = "nubellefortaleza@gmail.com";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    login: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByEmail(input.email);
        if (!user || !user.passwordHash) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha incorretos." });
        }
        const valid = await verifyPassword(input.password, user.passwordHash);
        if (!valid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha incorretos." });
        }
        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name || "",
          expiresInMs: ONE_YEAR_MS,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        return { success: true };
      }),
  }),

  consultation: router({
    uploadAudio: protectedProcedure
      .input(z.object({
        audioBase64: z.string(),
        mimeType: z.string().default("audio/webm"),
        patientName: z.string().min(1),
        patientPhone: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        const buffer = Buffer.from(input.audioBase64, "base64");
        const sizeMB = buffer.length / (1024 * 1024);
        if (sizeMB > 16) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "O arquivo de áudio excede o limite de 16MB." });
        }
        const ext = input.mimeType.includes("webm") ? "webm" : input.mimeType.includes("mp4") ? "m4a" : "wav";

        // Format filename: NOME_TELEFONE_DDMMAAAA
        const sanitize = (s: string) =>
          s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").substring(0, 40);
        const now = new Date();
        const dd = String(now.getDate()).padStart(2, "0");
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const aaaa = now.getFullYear();
        const filename = `${sanitize(input.patientName)}_${sanitize(input.patientPhone)}_${dd}${mm}${aaaa}.${ext}`;
        const fileKey = `consultations/${ctx.user.id}/${filename}`;

        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        const consultationId = await createConsultation({
          userId: ctx.user.id,
          audioUrl: url,
          audioKey: fileKey,
          patientName: input.patientName,
          patientPhone: input.patientPhone,
        });
        return { consultationId, audioUrl: url };
      }),

    transcribe: protectedProcedure
      .input(z.object({ consultationId: z.number(), audioUrl: z.string() }))
      .mutation(async ({ input }) => {
        // Attempt 1: Gemini direct API — reads file from disk (more reliable than HTTP fetch)
        const geminiApiKey = process.env.GEMINI_API_KEY;
        if (geminiApiKey) {
          try {
            console.log("[Transcription] Trying Gemini direct API...");

            // Try reading from disk first (faster, no HTTP roundtrip)
            let audioBuffer: Buffer | null = null;
            let mimeType = "audio/webm";
            const consultation = await getConsultationById(input.consultationId);
            if (consultation?.audioKey) {
              const uploadsDir = process.env.UPLOADS_DIR
                ? path.resolve(process.env.UPLOADS_DIR)
                : path.resolve(process.cwd(), "uploads");
              const filePath = path.join(uploadsDir, consultation.audioKey);
              try {
                audioBuffer = await fs.readFile(filePath);
                if (consultation.audioKey.endsWith(".mp4") || consultation.audioKey.endsWith(".m4a")) mimeType = "audio/mp4";
                console.log("[Transcription] Audio read from disk:", filePath, `(${(audioBuffer.length / 1024).toFixed(0)}KB)`);
              } catch (fsErr: any) {
                console.warn("[Transcription] Could not read from disk, will fetch URL:", fsErr.message);
              }
            }

            // Fallback: fetch from URL
            if (!audioBuffer) {
              const audioResp = await fetch(input.audioUrl);
              if (!audioResp.ok) throw new Error(`Failed to download audio: ${audioResp.status}`);
              audioBuffer = Buffer.from(await audioResp.arrayBuffer());
              if (input.audioUrl.endsWith(".mp4") || input.audioUrl.endsWith(".m4a")) mimeType = "audio/mp4";
            }

            const base64Audio = audioBuffer.toString("base64");
            const ai = new GoogleGenAI({ apiKey: geminiApiKey });
            const response = await ai.models.generateContent({
              model: "gemini-2.5-flash",
              contents: [
                {
                  role: "user",
                  parts: [
                    { inlineData: { data: base64Audio, mimeType } },
                    { text: "Transcreva este áudio de consulta médica estética em português brasileiro. Retorne apenas a transcrição completa, sem comentários adicionais." },
                  ],
                },
              ],
            });
            const transcription = response.text || "";
            if (!transcription) throw new Error("Gemini não retornou transcrição");
            await updateConsultation(input.consultationId, { transcription });
            return { text: transcription, source: "gemini" };
          } catch (geminiErr: any) {
            console.error("[Transcription] Gemini failed:", geminiErr.message);
          }
        } else {
          console.warn("[Transcription] GEMINI_API_KEY não configurada, pulando Gemini.");
        }

        // Attempt 2: Whisper via Forge API (with retry)
        for (let attempt = 0; attempt < 2; attempt++) {
          const whisperResult = await transcribeAudio({
            audioUrl: input.audioUrl,
            language: "pt",
            prompt: "Transcrição de consulta médica estética em português brasileiro. Termos: botox, preenchimento, harmonização facial, bioestimulador, skinbooster, peeling, laser, ácido hialurônico.",
          });

          if (!("error" in whisperResult)) {
            await updateConsultation(input.consultationId, { transcription: whisperResult.text });
            return { text: whisperResult.text, source: "whisper" };
          }

          console.log(`[Transcription] Whisper attempt ${attempt + 1} failed:`, whisperResult.error, whisperResult.details || "");
          if (attempt === 0) {
            await new Promise(r => setTimeout(r, 2000));
          }
        }

        // Attempt 3: Use invokeLLM (Forge API) with file_url for audio transcription
        try {
          console.log("[Transcription] Trying invokeLLM with file_url...");
          const llmResult = await invokeLLM({
            messages: [
              {
                role: "system",
                content: "Você é um transcritor profissional. Transcreva o áudio da consulta médica estética em português brasileiro de forma completa e precisa. Retorne APENAS a transcrição, sem comentários, títulos ou formatação adicional.",
              },
              {
                role: "user",
                content: [
                  {
                    type: "file_url" as const,
                    file_url: { url: input.audioUrl, mime_type: "audio/webm" as const },
                  },
                  {
                    type: "text" as const,
                    text: "Transcreva este áudio de consulta médica estética em português brasileiro. Retorne apenas a transcrição completa.",
                  },
                ],
              },
            ],
          });

          const transcription = typeof llmResult.choices[0]?.message?.content === "string"
            ? llmResult.choices[0].message.content : "";
          if (transcription.trim()) {
            await updateConsultation(input.consultationId, { transcription });
            return { text: transcription, source: "llm" };
          }
          throw new Error("LLM não retornou transcrição");
        } catch (llmErr: any) {
          console.error("[Transcription] LLM fallback failed:", llmErr.message);
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: !geminiApiKey
            ? "Transcrição não configurada. Adicione GEMINI_API_KEY no arquivo .env do servidor."
            : "Falha na transcrição. Todos os serviços falharam. Tente novamente em alguns instantes.",
        });
      }),

    generateReport: protectedProcedure
      .input(z.object({ consultationId: z.number(), transcription: z.string() }))
      .mutation(async ({ input }) => {
        const now = new Date();
        const dateStr = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Fortaleza" });
        const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Fortaleza" });

        const systemPrompt = `Você é um assistente especializado em clínicas de estética. Analise a transcrição de uma consulta médica estética e preencha o relatório estruturado.

REGRAS:
- Extraia as informações diretamente da transcrição.
- Se alguma informação NÃO for mencionada, preencha com "Não mencionado".
- Mantenha o texto profissional e objetivo.
- Use a data e horário atuais: ${dateStr} às ${timeStr}.
- Responda APENAS com o JSON.

Retorne um JSON com estes campos:
{"patientName","consultationDate","patientProfile","mainComplaints","treatmentPlan","budgetPresented","closedDeal","additionalNotes"}`;

        const result = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Transcrição da consulta:\n\n${input.transcription}` },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "consultation_report",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  patientName: { type: "string" },
                  consultationDate: { type: "string" },
                  patientProfile: { type: "string" },
                  mainComplaints: { type: "string" },
                  treatmentPlan: { type: "string" },
                  budgetPresented: { type: "string" },
                  closedDeal: { type: "string" },
                  additionalNotes: { type: "string" },
                },
                required: ["patientName", "consultationDate", "patientProfile", "mainComplaints", "treatmentPlan", "budgetPresented", "closedDeal", "additionalNotes"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = result.choices[0]?.message?.content;
        if (!content || typeof content !== "string") {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao gerar relatório com IA." });
        }

        const report = JSON.parse(content);
        await updateConsultation(input.consultationId, {
          patientName: report.patientName,
          consultationDate: report.consultationDate,
          patientProfile: report.patientProfile,
          mainComplaints: report.mainComplaints,
          treatmentPlan: report.treatmentPlan,
          budgetPresented: report.budgetPresented,
          closedDeal: report.closedDeal,
          additionalNotes: report.additionalNotes,
        });

        return report;
      }),

    saveReport: protectedProcedure
      .input(z.object({
        consultationId: z.number(),
        patientName: z.string(),
        consultationDate: z.string(),
        patientProfile: z.string(),
        mainComplaints: z.string(),
        treatmentPlan: z.string(),
        budgetPresented: z.string(),
        closedDeal: z.string(),
        additionalNotes: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { consultationId, ...data } = input;
        await updateConsultation(consultationId, data);
        return { success: true };
      }),

    sendEmail: protectedProcedure
      .input(z.object({
        consultationId: z.number(),
        patientName: z.string(),
        consultationDate: z.string(),
        patientProfile: z.string(),
        mainComplaints: z.string(),
        treatmentPlan: z.string(),
        budgetPresented: z.string(),
        closedDeal: z.string(),
        additionalNotes: z.string(),
      }))
      .mutation(async ({ input }) => {
        const dateForSubject = input.consultationDate.split(" ")[0] || input.consultationDate;
        const subject = `${input.patientName} - ${dateForSubject}`;

        const reportText = [
          "RELATÓRIO DE CONSULTA - VIP ESTETIC",
          "═".repeat(50),
          "",
          `NOME DO PACIENTE: ${input.patientName}`,
          `DATA E HORÁRIO: ${input.consultationDate}`,
          `PERFIL DO PACIENTE: ${input.patientProfile}`,
          `QUEIXAS PRINCIPAIS: ${input.mainComplaints}`,
          `PLANO DE TRATAMENTO INDICADO: ${input.treatmentPlan}`,
          `ORÇAMENTO APRESENTADO: ${input.budgetPresented}`,
          `O QUE FOI FECHADO: ${input.closedDeal}`,
          `OBSERVAÇÕES ADICIONAIS: ${input.additionalNotes}`,
          "",
          "═".repeat(50),
          "Relatório gerado automaticamente pelo ConsultaVip - Vip Estetic",
        ].join("\n");

        const htmlReport = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:'Georgia',serif;background-color:#F9F7F2;padding:32px;"><div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);"><div style="background-color:#1A1A1B;padding:24px;text-align:center;"><h1 style="color:#F2D9C2;margin:0;font-size:24px;letter-spacing:2px;">VIP ESTETIC</h1><p style="color:#AABAA4;margin:8px 0 0;font-size:13px;letter-spacing:1px;">RELATÓRIO DE CONSULTA</p></div><div style="padding:32px;"><table style="width:100%;border-collapse:collapse;">${[
          ["Nome do Paciente", input.patientName],
          ["Data e Horário", input.consultationDate],
          ["Perfil do Paciente", input.patientProfile],
          ["Queixas Principais", input.mainComplaints],
          ["Plano de Tratamento", input.treatmentPlan],
          ["Orçamento Apresentado", input.budgetPresented],
          ["O que foi Fechado", input.closedDeal],
          ["Observações Adicionais", input.additionalNotes],
        ].map(([label, value]) => `<tr style="border-bottom:1px solid #F2D9C2;"><td style="padding:12px 8px;font-weight:bold;color:#1A1A1B;width:40%;vertical-align:top;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;">${label}</td><td style="padding:12px 8px;color:#1A1A1B;font-size:14px;">${value}</td></tr>`).join("")}</table></div><div style="background-color:#F2D9C2;padding:16px;text-align:center;"><p style="margin:0;color:#1A1A1B;font-size:11px;letter-spacing:1px;">CONSULTAVIP • VIP ESTETIC • RELATÓRIO AUTOMÁTICO</p></div></div></body></html>`;

        // Save report data first
        await updateConsultation(input.consultationId, {
          patientName: input.patientName, consultationDate: input.consultationDate,
          patientProfile: input.patientProfile, mainComplaints: input.mainComplaints,
          treatmentPlan: input.treatmentPlan, budgetPresented: input.budgetPresented,
          closedDeal: input.closedDeal, additionalNotes: input.additionalNotes,
        });

        try {
          await sendEmail({
            to: DESTINATION_EMAIL,
            subject,
            text: reportText,
            html: htmlReport,
          });

          await updateConsultation(input.consultationId, { emailSent: "yes", emailSentAt: new Date() });
          return { success: true, message: "E-mail enviado com sucesso!" };
        } catch (err: any) {
          console.error("Email send error:", err);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Relatório salvo. Erro ao enviar e-mail: ${err.message || "Verifique as configurações SMTP."}` });
        }
      }),

    list: protectedProcedure.query(async ({ ctx }) => {
      return getConsultationsByUser(ctx.user.id);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const consultation = await getConsultationById(input.id);
        if (!consultation) throw new TRPCError({ code: "NOT_FOUND", message: "Consulta não encontrada." });
        return consultation;
      }),
  }),
});

export type AppRouter = typeof appRouter;
