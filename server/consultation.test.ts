import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-123",
    email: "test@vipestetic.com",
    name: "Dr. Teste",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

function createUnauthContext(): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
  return { ctx };
}

// Mock the database functions
vi.mock("./db", () => ({
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  createConsultation: vi.fn().mockResolvedValue(42),
  updateConsultation: vi.fn().mockResolvedValue(undefined),
  getConsultationById: vi.fn().mockResolvedValue({
    id: 42,
    userId: 1,
    patientName: "Maria Silva",
    consultationDate: "19/02/2026 às 14:30",
    patientProfile: "Mulher, 35 anos",
    mainComplaints: "Rugas na testa",
    treatmentPlan: "Botox",
    budgetPresented: "R$ 1.500",
    closedDeal: "Botox frontal",
    additionalNotes: "Retorno em 15 dias",
    emailSent: "no",
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  getConsultationsByUser: vi.fn().mockResolvedValue([
    {
      id: 42,
      userId: 1,
      patientName: "Maria Silva",
      consultationDate: "19/02/2026 às 14:30",
      emailSent: "yes",
      createdAt: new Date(),
    },
    {
      id: 41,
      userId: 1,
      patientName: "João Santos",
      consultationDate: "18/02/2026 às 10:00",
      emailSent: "no",
      createdAt: new Date(),
    },
  ]),
}));

// Mock storage
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({
    key: "consultations/1/test.webm",
    url: "https://storage.example.com/consultations/1/test.webm",
  }),
}));

// Mock voice transcription
vi.mock("./_core/voiceTranscription", () => ({
  transcribeAudio: vi.fn().mockResolvedValue({
    text: "Olá, meu nome é Maria Silva, tenho 35 anos. Estou aqui porque quero tratar as rugas na testa.",
    language: "pt",
  }),
}));

// Mock LLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            patientName: "Maria Silva",
            consultationDate: "19/02/2026 às 14:30",
            patientProfile: "Mulher, 35 anos",
            mainComplaints: "Rugas na testa",
            treatmentPlan: "Aplicação de toxina botulínica (Botox) na região frontal",
            budgetPresented: "Não mencionado",
            closedDeal: "Não mencionado",
            additionalNotes: "Não mencionado",
          }),
        },
      },
    ],
  }),
}));

// Mock nanoid
vi.mock("nanoid", () => ({
  nanoid: () => "test-nanoid-123",
}));

// Mock email helper (MCP Gmail)
vi.mock("./email", () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true, messageId: "mock-msg-123" }),
}));

describe("consultation routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("consultation.uploadAudio", () => {
    it("uploads audio and creates consultation record", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // Create a small base64 audio payload (simulated)
      const fakeAudioBase64 = Buffer.from("fake-audio-data").toString("base64");

      const result = await caller.consultation.uploadAudio({
        audioBase64: fakeAudioBase64,
        mimeType: "audio/webm",
      });

      expect(result).toHaveProperty("consultationId");
      expect(result).toHaveProperty("audioUrl");
      expect(result.consultationId).toBe(42);
      expect(result.audioUrl).toContain("storage.example.com");
    });

    it("rejects audio larger than 16MB", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // Create a base64 string that decodes to >16MB
      const largeBuffer = Buffer.alloc(17 * 1024 * 1024, "a");
      const largeBase64 = largeBuffer.toString("base64");

      await expect(
        caller.consultation.uploadAudio({
          audioBase64: largeBase64,
          mimeType: "audio/webm",
        })
      ).rejects.toThrow("excede o limite de 16MB");
    });

    it("requires authentication", async () => {
      const { ctx } = createUnauthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.consultation.uploadAudio({
          audioBase64: "dGVzdA==",
          mimeType: "audio/webm",
        })
      ).rejects.toThrow();
    });
  });

  describe("consultation.transcribe", () => {
    it("transcribes audio and returns text", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.consultation.transcribe({
        consultationId: 42,
        audioUrl: "https://storage.example.com/test.webm",
      });

      expect(result).toHaveProperty("text");
      expect(result.text).toContain("Maria Silva");
      expect(result.source).toBe("whisper");
    });
  });

  describe("consultation.generateReport", () => {
    it("generates a structured report from transcription", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.consultation.generateReport({
        consultationId: 42,
        transcription:
          "Olá, meu nome é Maria Silva, tenho 35 anos. Estou aqui porque quero tratar as rugas na testa.",
      });

      expect(result).toHaveProperty("patientName");
      expect(result).toHaveProperty("consultationDate");
      expect(result).toHaveProperty("patientProfile");
      expect(result).toHaveProperty("mainComplaints");
      expect(result).toHaveProperty("treatmentPlan");
      expect(result).toHaveProperty("budgetPresented");
      expect(result).toHaveProperty("closedDeal");
      expect(result).toHaveProperty("additionalNotes");
      expect(result.patientName).toBe("Maria Silva");
    });
  });

  describe("consultation.saveReport", () => {
    it("saves edited report data", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.consultation.saveReport({
        consultationId: 42,
        patientName: "Maria Silva Editado",
        consultationDate: "19/02/2026 às 14:30",
        patientProfile: "Mulher, 35 anos, pele clara",
        mainComplaints: "Rugas na testa e olheiras",
        treatmentPlan: "Botox + Preenchimento",
        budgetPresented: "R$ 3.000",
        closedDeal: "Botox frontal",
        additionalNotes: "Agendar retorno",
      });

      expect(result).toEqual({ success: true });
    });
  });

  describe("consultation.list", () => {
    it("returns list of consultations for authenticated user", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.consultation.list();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty("patientName", "Maria Silva");
      expect(result[1]).toHaveProperty("patientName", "João Santos");
    });

    it("requires authentication for listing", async () => {
      const { ctx } = createUnauthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.consultation.list()).rejects.toThrow();
    });
  });

  describe("consultation.get", () => {
    it("returns a specific consultation", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.consultation.get({ id: 42 });

      expect(result).toHaveProperty("id", 42);
      expect(result).toHaveProperty("patientName", "Maria Silva");
    });
  });

  describe("consultation.sendEmail", () => {
    it("sends email and returns success", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const { sendEmail: mockSendEmail } = await import("./email");

      const result = await caller.consultation.sendEmail({
        consultationId: 42,
        patientName: "Maria Silva",
        consultationDate: "19/02/2026 às 14:30",
        patientProfile: "Mulher, 35 anos",
        mainComplaints: "Rugas na testa",
        treatmentPlan: "Botox",
        budgetPresented: "R$ 1.500",
        closedDeal: "Botox frontal",
        additionalNotes: "Retorno em 15 dias",
      });

      expect(result).toHaveProperty("success", true);

      // Verify sendEmail was called with correct parameters
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      const call = (mockSendEmail as any).mock.calls[0][0];
      expect(call.to).toBe("nubellefortaleza@gmail.com");
      expect(call.subject).toBe("Maria Silva - 19/02/2026");
      expect(call.text).toContain("NOME DO PACIENTE: Maria Silva");
    });
  });
});
