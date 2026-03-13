import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { transcribeAudio } from "./_core/voiceTranscription";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import {
  createConsultation, updateConsultation, getConsultationById, getConsultationsByUser,
  getUserByEmail, getUserByOpenId, getAllUsers, createUser, updateUserProfile, updateUserById, deleteUser,
  getSetting, setSetting, getAllSettings,
  getAllEstablishments, getEstablishmentById, createEstablishment, updateEstablishment,
} from "./db";
import { GoogleGenAI } from "@google/genai";
import { ENV } from "./_core/env";
import { sendEmail } from "./email";
import { sdk } from "./_core/sdk";
import { verifyPassword, hashPassword } from "./_core/auth-utils";
import fs from "fs/promises";
import path from "path";
import { uploadFileToDrive, isDriveConfigured } from "./googleDrive";

const DEFAULT_DESTINATION_EMAIL = process.env.DESTINATION_EMAIL || "nubellefortaleza@gmail.com";

/** Returns the user's establishmentId, defaulting to 1 for legacy sessions. */
const eid = (ctx: { user: any }) => (ctx.user.establishmentId as number | undefined) ?? 1;

/** True if the user is an admin of the platform (establishment 1). */
const isPlatformAdmin = (ctx: { user: any }) =>
  ctx.user.role === "admin" && eid(ctx) === 1;

export const appRouter = router({
  system: systemRouter,

  // ─── Auth ──────────────────────────────────────────────────────────────────
  auth: router({
    me: publicProcedure.query(async opts => {
      if (!opts.ctx.user) return null;
      const dbUser = await getUserByOpenId(opts.ctx.user.openId);
      if (!dbUser) return opts.ctx.user;
      return {
        ...opts.ctx.user,
        name: dbUser.name || opts.ctx.user.name,
        profilePhoto: dbUser.profilePhoto ?? null,
        reportEmail: dbUser.reportEmail ?? null,
        establishmentId: dbUser.establishmentId ?? 1,
      };
    }),
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

  // ─── Establishment (public info for current user) ──────────────────────────
  establishment: router({
    getCurrent: protectedProcedure.query(async ({ ctx }) => {
      const establishment = await getEstablishmentById(eid(ctx));
      return establishment ?? { id: 1, name: "Vip Estetic", logoUrl: null, slug: "vipestetic" };
    }),
  }),

  // ─── Admin ─────────────────────────────────────────────────────────────────
  admin: router({
    getSettings: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const s = await getAllSettings(eid(ctx));
      return {
        smtpUser: s.smtp_user || "",
        smtpPassSet: !!s.smtp_pass,
        geminiKeySet: !!s.gemini_api_key,
        destinationEmail: s.destination_email || DEFAULT_DESTINATION_EMAIL,
      };
    }),

    saveSettings: protectedProcedure
      .input(z.object({
        smtpUser: z.string().optional(),
        smtpPass: z.string().optional(),
        geminiApiKey: z.string().optional(),
        destinationEmail: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const e = eid(ctx);
        if (input.smtpUser !== undefined) await setSetting("smtp_user", input.smtpUser, e);
        if (input.smtpPass && input.smtpPass !== "••••••••") await setSetting("smtp_pass", input.smtpPass, e);
        if (input.geminiApiKey && input.geminiApiKey !== "••••••••") await setSetting("gemini_api_key", input.geminiApiKey, e);
        if (input.destinationEmail !== undefined) await setSetting("destination_email", input.destinationEmail, e);
        return { success: true };
      }),

    listUsers: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const userList = await getAllUsers(eid(ctx));
      return userList.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        reportEmail: u.reportEmail,
        profilePhoto: u.profilePhoto,
        establishmentId: u.establishmentId,
        createdAt: u.createdAt,
        lastSignedIn: u.lastSignedIn,
      }));
    }),

    createUser: protectedProcedure
      .input(z.object({
        email: z.string().email(),
        name: z.string().min(1),
        password: z.string().min(6),
        role: z.enum(["user", "admin"]),
        reportEmail: z.string().email().optional().or(z.literal("")),
        profilePhoto: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const existing = await getUserByEmail(input.email);
        if (existing) throw new TRPCError({ code: "CONFLICT", message: "E-mail já cadastrado." });
        const passwordHash = await hashPassword(input.password);
        await createUser({
          email: input.email,
          name: input.name,
          passwordHash,
          role: input.role,
          reportEmail: input.reportEmail || undefined,
          profilePhoto: input.profilePhoto || undefined,
          establishmentId: eid(ctx),
        });
        return { success: true };
      }),

    updateUser: protectedProcedure
      .input(z.object({
        userId: z.number(),
        name: z.string().min(1),
        email: z.string().email(),
        role: z.enum(["user", "admin"]),
        reportEmail: z.string().email().optional().or(z.literal("")),
        newPassword: z.string().min(6).optional().or(z.literal("")),
        profilePhoto: z.string().nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const existing = await getUserByEmail(input.email);
        if (existing && existing.id !== input.userId) {
          throw new TRPCError({ code: "CONFLICT", message: "E-mail já em uso por outro usuário." });
        }
        const data: Parameters<typeof updateUserById>[1] = {
          name: input.name.trim(),
          email: input.email.trim(),
          role: input.role,
          reportEmail: input.reportEmail?.trim() || null,
          profilePhoto: input.profilePhoto !== undefined ? (input.profilePhoto || null) : undefined,
        };
        if (input.newPassword) {
          data.passwordHash = await hashPassword(input.newPassword);
        }
        await updateUserById(input.userId, data);
        return { success: true };
      }),

    deleteUser: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Não é possível excluir o próprio usuário." });
        await deleteUser(input.userId);
        return { success: true };
      }),

    // ── Establishments (platform admin only) ──────────────────────────────────
    listEstablishments: protectedProcedure.query(async ({ ctx }) => {
      if (!isPlatformAdmin(ctx)) throw new TRPCError({ code: "FORBIDDEN" });
      return getAllEstablishments();
    }),

    createEstablishment: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        slug: z.string().min(2).regex(/^[a-z0-9-]+$/, "Apenas letras minúsculas, números e hífen").optional().or(z.literal("")),
        logoUrl: z.string().url().optional().or(z.literal("")),
        adminName: z.string().min(1),
        adminEmail: z.string().email(),
        adminPassword: z.string().min(6),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!isPlatformAdmin(ctx)) throw new TRPCError({ code: "FORBIDDEN" });

        const existingUser = await getUserByEmail(input.adminEmail);
        if (existingUser) throw new TRPCError({ code: "CONFLICT", message: "E-mail do admin já está em uso." });

        // Create establishment
        const newEid = await createEstablishment({
          name: input.name.trim(),
          slug: input.slug?.trim() || undefined,
          logoUrl: input.logoUrl?.trim() || undefined,
        });

        // Create admin user for the new establishment
        const passwordHash = await hashPassword(input.adminPassword);
        await createUser({
          email: input.adminEmail.trim(),
          name: input.adminName.trim(),
          passwordHash,
          role: "admin",
          establishmentId: newEid,
        });

        return { success: true, establishmentId: newEid };
      }),

    updateEstablishment: protectedProcedure
      .input(z.object({
        establishmentId: z.number(),
        name: z.string().min(1).optional(),
        slug: z.string().optional().or(z.literal("")),
        logoUrl: z.string().optional().or(z.literal("")),
        active: z.enum(["yes", "no"]).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!isPlatformAdmin(ctx)) throw new TRPCError({ code: "FORBIDDEN" });
        if (input.establishmentId === 1 && input.active === "no") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Não é possível desativar o estabelecimento principal." });
        }
        await updateEstablishment(input.establishmentId, {
          name: input.name,
          slug: input.slug || null,
          logoUrl: input.logoUrl || null,
          active: input.active,
        });
        return { success: true };
      }),
  }),

  // ─── User (profile) ────────────────────────────────────────────────────────
  user: router({
    updateProfile: protectedProcedure
      .input(z.object({
        name: z.string().min(1).optional(),
        profilePhoto: z.string().optional(),
        reportEmail: z.string().email().optional().or(z.literal("")),
      }))
      .mutation(async ({ input, ctx }) => {
        await updateUserProfile(ctx.user.id, {
          name: input.name,
          profilePhoto: input.profilePhoto,
          reportEmail: input.reportEmail !== undefined ? (input.reportEmail || null) : undefined,
        });
        return { success: true };
      }),
  }),

  // ─── Consultation ──────────────────────────────────────────────────────────
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
          establishmentId: eid(ctx),
          audioUrl: url,
          audioKey: fileKey,
          patientName: input.patientName,
          patientPhone: input.patientPhone,
        });
        return { consultationId, audioUrl: url };
      }),

    transcribe: protectedProcedure
      .input(z.object({ consultationId: z.number(), audioUrl: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const geminiApiKey = (await getSetting("gemini_api_key", eid(ctx))) || process.env.GEMINI_API_KEY;
        if (geminiApiKey) {
          try {
            console.log("[Transcription] Trying Gemini direct API...");
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
              contents: [{
                role: "user",
                parts: [
                  { inlineData: { data: base64Audio, mimeType } },
                  { text: "Transcreva este áudio de consulta médica estética em português brasileiro. Retorne apenas a transcrição completa, sem comentários adicionais." },
                ],
              }],
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
          if (attempt === 0) await new Promise(r => setTimeout(r, 2000));
        }

        try {
          console.log("[Transcription] Trying invokeLLM with file_url...");
          const llmResult = await invokeLLM({
            messages: [
              { role: "system", content: "Você é um transcritor profissional. Transcreva o áudio da consulta médica estética em português brasileiro de forma completa e precisa. Retorne APENAS a transcrição, sem comentários, títulos ou formatação adicional." },
              { role: "user", content: [
                { type: "file_url" as const, file_url: { url: input.audioUrl, mime_type: "audio/webm" as const } },
                { type: "text" as const, text: "Transcreva este áudio de consulta médica estética em português brasileiro. Retorne apenas a transcrição completa." },
              ]},
            ],
          });
          const transcription = typeof llmResult.choices[0]?.message?.content === "string" ? llmResult.choices[0].message.content : "";
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
            ? "Transcrição não configurada. Configure a Gemini API Key no Painel Admin → Configurações."
            : "Falha na transcrição. Todos os serviços falharam. Tente novamente em alguns instantes.",
        });
      }),

    generateReport: protectedProcedure
      .input(z.object({ consultationId: z.number(), transcription: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const geminiApiKey = (await getSetting("gemini_api_key", eid(ctx))) || process.env.GEMINI_API_KEY;
        if (!geminiApiKey) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "GEMINI_API_KEY não configurada. Configure no Painel Admin → Configurações." });
        }

        const now = new Date();
        const dateStr = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Fortaleza" });
        const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Fortaleza" });

        const prompt = `Você é um assistente especializado em clínicas de estética. Analise a transcrição abaixo e retorne APENAS um JSON válido, sem markdown, sem explicações.

REGRAS:
- Extraia as informações diretamente da transcrição.
- Se alguma informação NÃO for mencionada, preencha com "Não mencionado".
- Mantenha o texto profissional e objetivo.
- Use a data e horário atuais: ${dateStr} às ${timeStr}.

JSON esperado (retorne SOMENTE isso):
{"patientName":"...","consultationDate":"...","patientProfile":"...","mainComplaints":"...","treatmentPlan":"...","budgetPresented":"...","closedDeal":"...","additionalNotes":"..."}

Transcrição da consulta:
${input.transcription}`;

        const ai = new GoogleGenAI({ apiKey: geminiApiKey });
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        });

        const rawText = response.text?.trim() || "";
        const jsonText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

        let report: any;
        try { report = JSON.parse(jsonText); }
        catch { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao interpretar resposta da IA. Tente novamente." }); }

        const existing = await getConsultationById(input.consultationId);
        const finalPatientName = (existing?.patientName && existing.patientName !== "Não mencionado")
          ? existing.patientName
          : (report.patientName && report.patientName !== "Não mencionado" ? report.patientName : existing?.patientName || "Não informado");

        await updateConsultation(input.consultationId, {
          patientName: finalPatientName,
          consultationDate: report.consultationDate,
          patientProfile: report.patientProfile,
          mainComplaints: report.mainComplaints,
          treatmentPlan: report.treatmentPlan,
          budgetPresented: report.budgetPresented,
          closedDeal: report.closedDeal,
          additionalNotes: report.additionalNotes,
        });
        return { ...report, patientName: finalPatientName };
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
      .mutation(async ({ input, ctx }) => {
        const e = eid(ctx);
        const [dbUser, smtpUserSetting, smtpPassSetting, destinationEmailSetting, establishment] = await Promise.all([
          getUserByOpenId(ctx.user.openId),
          getSetting("smtp_user", e),
          getSetting("smtp_pass", e),
          getSetting("destination_email", e),
          getEstablishmentById(e),
        ]);

        const doctorName = dbUser?.name || ctx.user.name || "Não informado";
        const clinicName = establishment?.name || "Vip Estetic";
        const recipientEmail = dbUser?.reportEmail || destinationEmailSetting || DEFAULT_DESTINATION_EMAIL;
        const smtpCredentials = smtpUserSetting && smtpPassSetting
          ? { smtpUser: smtpUserSetting, smtpPass: smtpPassSetting }
          : undefined;

        const dateForSubject = input.consultationDate.split(" ")[0] || input.consultationDate;
        const subject = `${input.patientName} - ${dateForSubject}`;

        const reportText = [
          `RELATÓRIO DE CONSULTA - ${clinicName.toUpperCase()}`,
          "═".repeat(50),
          "",
          `MÉDICO(A) RESPONSÁVEL: ${doctorName}`,
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
          `Relatório gerado automaticamente pelo ConsultaVip - ${clinicName}`,
        ].join("\n");

        const tableRows = [
          ["Médico(a) Responsável", doctorName],
          ["Nome do Paciente", input.patientName],
          ["Data e Horário", input.consultationDate],
          ["Perfil do Paciente", input.patientProfile],
          ["Queixas Principais", input.mainComplaints],
          ["Plano de Tratamento", input.treatmentPlan],
          ["Orçamento Apresentado", input.budgetPresented],
          ["O que foi Fechado", input.closedDeal],
          ["Observações Adicionais", input.additionalNotes],
        ];

        const htmlReport = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:'Georgia',serif;background-color:#F9F7F2;padding:32px;"><div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);"><div style="background-color:#1A1A1B;padding:24px;text-align:center;"><h1 style="color:#F2D9C2;margin:0;font-size:24px;letter-spacing:2px;">${clinicName.toUpperCase()}</h1><p style="color:#AABAA4;margin:8px 0 0;font-size:13px;letter-spacing:1px;">RELATÓRIO DE CONSULTA</p></div><div style="padding:32px;"><table style="width:100%;border-collapse:collapse;">${tableRows.map(([label, value]) => `<tr style="border-bottom:1px solid #F2D9C2;"><td style="padding:12px 8px;font-weight:bold;color:#1A1A1B;width:40%;vertical-align:top;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;">${label}</td><td style="padding:12px 8px;color:#1A1A1B;font-size:14px;">${value}</td></tr>`).join("")}</table></div><div style="background-color:#F2D9C2;padding:16px;text-align:center;"><p style="margin:0;color:#1A1A1B;font-size:11px;letter-spacing:1px;">CONSULTAVIP • ${clinicName.toUpperCase()} • RELATÓRIO AUTOMÁTICO</p></div></div></body></html>`;

        await updateConsultation(input.consultationId, {
          patientName: input.patientName, consultationDate: input.consultationDate,
          patientProfile: input.patientProfile, mainComplaints: input.mainComplaints,
          treatmentPlan: input.treatmentPlan, budgetPresented: input.budgetPresented,
          closedDeal: input.closedDeal, additionalNotes: input.additionalNotes,
        });

        const safeName = input.patientName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
        const safeDate = (input.consultationDate.split(" ")[0] || "").replace(/\//g, "");

        try {
          await sendEmail(
            { to: recipientEmail, subject, text: reportText, html: htmlReport,
              attachments: [{ filename: `Relatorio_${safeName}_${safeDate}.txt`, content: reportText, contentType: "text/plain" }] },
            smtpCredentials,
          );
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

    backupToDrive: protectedProcedure
      .input(z.object({ consultationId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (!isDriveConfigured()) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Google Drive não configurado. Adicione GOOGLE_SERVICE_ACCOUNT_JSON no .env do servidor." });
        }
        const consultation = await getConsultationById(input.consultationId);
        if (!consultation || consultation.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Consulta não encontrada." });
        }
        if (!consultation.audioKey) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Esta consulta não possui áudio salvo localmente." });
        }
        const uploadsDir = process.env.UPLOADS_DIR ? path.resolve(process.env.UPLOADS_DIR) : path.resolve(process.cwd(), "uploads");
        const filePath = path.join(uploadsDir, consultation.audioKey);
        let fileBuffer: Buffer;
        try { fileBuffer = await fs.readFile(filePath); }
        catch { throw new TRPCError({ code: "NOT_FOUND", message: "Arquivo de áudio não encontrado no servidor. Pode já ter sido removido." }); }
        const filename = path.basename(consultation.audioKey);
        const mimeType = filename.endsWith(".mp4") || filename.endsWith(".m4a") ? "audio/mp4" : "audio/webm";
        const { fileId, webViewLink } = await uploadFileToDrive(fileBuffer, filename, mimeType);
        await fs.unlink(filePath);
        await updateConsultation(input.consultationId, { audioUrl: webViewLink });
        console.log(`[Drive] Backed up and deleted local: ${filePath} → ${webViewLink}`);
        return { success: true, driveUrl: webViewLink, fileId };
      }),

    driveStatus: protectedProcedure.query(() => ({ configured: isDriveConfigured() })),

    serverInfo: protectedProcedure.query(async ({ ctx }) => {
      const uploadsDir = process.env.UPLOADS_DIR ? path.resolve(process.env.UPLOADS_DIR) : path.resolve(process.cwd(), "uploads");
      let fileCount = 0;
      let files: string[] = [];
      try {
        const walk = async (dir: string): Promise<string[]> => {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          const results: string[] = [];
          for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) results.push(...await walk(full));
            else results.push(full.replace(uploadsDir + "/", ""));
          }
          return results;
        };
        files = await walk(uploadsDir);
        fileCount = files.length;
      } catch { /* directory doesn't exist yet */ }

      let dbCount = 0;
      try { const rows = await getConsultationsByUser(ctx.user.id); dbCount = rows.length; } catch { /* db error */ }

      const e = eid(ctx);
      const geminiFromDb = !!(await getSetting("gemini_api_key", e));
      return {
        uploadsDir, fileCount, files: files.slice(0, 50),
        appBaseUrl: process.env.APP_BASE_URL || "(não definido)",
        geminiConfigured: geminiFromDb || !!process.env.GEMINI_API_KEY,
        dbConsultationsForUser: dbCount,
        nodeVersion: process.version,
        cwd: process.cwd(),
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
