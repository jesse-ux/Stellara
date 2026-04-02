import { normalizeOcrText } from "@/lib/ocr";
import { getGoogleAccessToken } from "@/lib/google-auth";

const GOOGLE_VISION_TIMEOUT_MS = Number(process.env.GOOGLE_VISION_TIMEOUT_MS || 20000);
const GOOGLE_VISION_FEATURE =
  process.env.GOOGLE_VISION_FEATURE || "DOCUMENT_TEXT_DETECTION";
const GOOGLE_VISION_SCOPE = "https://www.googleapis.com/auth/cloud-vision";

type GoogleVisionResponse = {
  responses?: Array<{
    fullTextAnnotation?: {
      text?: string;
    };
    textAnnotations?: Array<{
      description?: string;
    }>;
    error?: {
      message?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

export async function recognizeTextFromImage(file: File) {
  const startedAt = Date.now();
  const token = await getGoogleAccessToken(GOOGLE_VISION_SCOPE);
  const authReadyAt = Date.now();
  const buffer = Buffer.from(await file.arrayBuffer());
  const bufferReadyAt = Date.now();

  const response = await fetch("https://vision.googleapis.com/v1/images:annotate", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        {
          image: {
            content: buffer.toString("base64"),
          },
          features: [
            {
              type: GOOGLE_VISION_FEATURE,
            },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(GOOGLE_VISION_TIMEOUT_MS),
  });
  const responseReadyAt = Date.now();

  const data = (await response.json().catch(() => null)) as GoogleVisionResponse | null;
  const visionError =
    data?.error?.message || data?.responses?.[0]?.error?.message || null;

  if (!response.ok || visionError) {
    throw new Error(visionError || "Google Vision OCR request failed");
  }

  const rawText =
    data?.responses?.[0]?.fullTextAnnotation?.text ||
    data?.responses?.[0]?.textAnnotations?.[0]?.description ||
    "";

  const text = normalizeOcrText(rawText);
  if (!text) {
    throw new Error("未识别到可用文本，请调整拍摄角度后重试");
  }

  console.info("[ocr] server timings", {
    provider: "google-vision",
    fileBytes: buffer.byteLength,
    authMs: authReadyAt - startedAt,
    encodeMs: bufferReadyAt - authReadyAt,
    upstreamMs: responseReadyAt - bufferReadyAt,
    totalMs: responseReadyAt - startedAt,
  });

  return { text };
}
