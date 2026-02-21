import { ENV } from "./env";

export type TranscribeOptions = {
  audioUrl: string;
  language?: string;
  prompt?: string;
};

export type WhisperSegment = {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
};

export type WhisperResponse = {
  task: "transcribe";
  language: string;
  duration: number;
  text: string;
  segments: WhisperSegment[];
};

export type TranscriptionResponse = WhisperResponse;

export type TranscriptionError = {
  error: string;
  code: "FILE_TOO_LARGE" | "INVALID_FORMAT" | "TRANSCRIPTION_FAILED" | "UPLOAD_FAILED" | "SERVICE_ERROR";
  details?: string;
};

function getFileExtension(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    "audio/webm": "webm",
    "audio/mp3": "mp3",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/wave": "wav",
    "audio/ogg": "ogg",
    "audio/m4a": "m4a",
    "audio/mp4": "m4a",
  };
  return mimeToExt[mimeType] || "audio";
}

function getTranscriptionProvider(): "openai" | "forge" {
  if (ENV.aiApiKey) return "openai";
  if (ENV.forgeApiKey) return "forge";
  throw new Error("Nenhum provider de transcrição configurado (AI_API_KEY/OPENAI_API_KEY ou BUILT_IN_FORGE_API_KEY)");
}

async function callOpenAiTranscription(
  audioBuffer: Buffer,
  mimeType: string,
  options: TranscribeOptions
): Promise<WhisperResponse> {
  const apiKey = ENV.aiApiKey;
  if (!apiKey) throw new Error("AI_API_KEY/OPENAI_API_KEY não configurada");

  const base = ENV.aiBaseUrl || "https://api.openai.com";
  const endpoint = `${base.replace(/\/$/, "")}/v1/audio/transcriptions`;

  const formData = new FormData();
  const filename = `audio.${getFileExtension(mimeType)}`;
  const audioBlob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
  formData.append("file", audioBlob, filename);
  formData.append("model", process.env.OPENAI_TRANSCRIPTION_MODEL || "whisper-1");
  formData.append("response_format", "verbose_json");
  if (options.language) formData.append("language", options.language);
  if (options.prompt) formData.append("prompt", options.prompt);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`OpenAI transcription failed (${response.status}): ${detail}`);
  }

  return (await response.json()) as WhisperResponse;
}

async function callForgeTranscription(
  audioBuffer: Buffer,
  mimeType: string,
  options: TranscribeOptions
): Promise<WhisperResponse> {
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) throw new Error("Forge não configurado");

  const formData = new FormData();
  const filename = `audio.${getFileExtension(mimeType)}`;
  const audioBlob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
  formData.append("file", audioBlob, filename);
  formData.append("model", "whisper-1");
  formData.append("response_format", "verbose_json");
  if (options.language) formData.append("language", options.language);
  if (options.prompt) formData.append("prompt", options.prompt);

  const fullUrl = new URL("v1/audio/transcriptions", ENV.forgeApiUrl.endsWith("/") ? ENV.forgeApiUrl : `${ENV.forgeApiUrl}/`).toString();
  const response = await fetch(fullUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${ENV.forgeApiKey}`,
      "Accept-Encoding": "identity",
    },
    body: formData,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Forge transcription failed (${response.status}): ${detail}`);
  }

  return (await response.json()) as WhisperResponse;
}

export async function transcribeAudio(
  options: TranscribeOptions
): Promise<TranscriptionResponse | TranscriptionError> {
  try {
    const audioResponse = await fetch(options.audioUrl);
    if (!audioResponse.ok) {
      return {
        error: "Failed to download audio file",
        code: "INVALID_FORMAT",
        details: `HTTP ${audioResponse.status}: ${audioResponse.statusText}`,
      };
    }

    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
    const mimeType = audioResponse.headers.get("content-type") || "audio/mpeg";

    const sizeMB = audioBuffer.length / (1024 * 1024);
    if (sizeMB > 16) {
      return {
        error: "Audio file exceeds maximum size limit",
        code: "FILE_TOO_LARGE",
        details: `File size is ${sizeMB.toFixed(2)}MB, maximum allowed is 16MB`,
      };
    }

    const provider = getTranscriptionProvider();
    const response =
      provider === "openai"
        ? await callOpenAiTranscription(audioBuffer, mimeType, options)
        : await callForgeTranscription(audioBuffer, mimeType, options);

    if (!response.text || typeof response.text !== "string") {
      return {
        error: "Invalid transcription response",
        code: "SERVICE_ERROR",
        details: "Provider returned invalid response format",
      };
    }

    return response;
  } catch (error) {
    return {
      error: "Voice transcription failed",
      code: "SERVICE_ERROR",
      details: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
