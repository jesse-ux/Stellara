import { getGoogleAccessToken, getGoogleCredentials } from "@/lib/google-auth";

const GOOGLE_SPEECH_TIMEOUT_MS = Number(process.env.GOOGLE_SPEECH_TIMEOUT_MS || 30000);
const GOOGLE_SPEECH_LANGUAGE = process.env.GOOGLE_SPEECH_LANGUAGE || "en-US";
const GOOGLE_SPEECH_MODEL = process.env.GOOGLE_SPEECH_MODEL || "chirp_3";
const GOOGLE_SPEECH_LOCATION = process.env.GOOGLE_SPEECH_LOCATION || "asia-southeast1";
const GOOGLE_SPEECH_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const GOOGLE_SPEECH_API_BASE = `https://${GOOGLE_SPEECH_LOCATION}-speech.googleapis.com/v2`;

type GoogleSpeechRecognizeResponse = {
  results?: Array<{
    alternatives?: Array<{
      transcript?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
};

export async function recognizeSpeechFromAudio(file: File) {
  const startedAt = Date.now();
  const token = await getGoogleAccessToken(GOOGLE_SPEECH_SCOPE);
  const authReadyAt = Date.now();
  const credentials = getGoogleCredentials();
  const buffer = Buffer.from(await file.arrayBuffer());
  const bufferReadyAt = Date.now();

  const response = await fetch(
    `${GOOGLE_SPEECH_API_BASE}/projects/${credentials.project_id}/locations/${GOOGLE_SPEECH_LOCATION}/recognizers/_:recognize`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        config: {
          autoDecodingConfig: {},
          model: GOOGLE_SPEECH_MODEL,
          languageCodes: [GOOGLE_SPEECH_LANGUAGE],
          features: {
            enableAutomaticPunctuation: true,
          },
        },
        content: buffer.toString("base64"),
      }),
      signal: AbortSignal.timeout(GOOGLE_SPEECH_TIMEOUT_MS),
    }
  );
  const responseReadyAt = Date.now();

  const data = (await response.json().catch(() => null)) as GoogleSpeechRecognizeResponse | null;
  const speechError = data?.error?.message || null;

  if (!response.ok || speechError) {
    throw new Error(speechError || "Google Speech-to-Text request failed");
  }

  const text = (data?.results || [])
    .map((result) => result.alternatives?.[0]?.transcript?.trim() || "")
    .filter(Boolean)
    .join(" ")
    .trim();

  if (!text) {
    throw new Error("未识别到清晰语音，请放慢语速后重试");
  }

  console.info("[asr] server timings", {
    provider: "google-speech",
    fileBytes: buffer.byteLength,
    authMs: authReadyAt - startedAt,
    encodeMs: bufferReadyAt - authReadyAt,
    upstreamMs: responseReadyAt - bufferReadyAt,
    totalMs: responseReadyAt - startedAt,
  });

  return { text };
}
