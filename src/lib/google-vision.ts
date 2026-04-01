import { createSign } from "node:crypto";
import { normalizeOcrText } from "@/lib/ocr";

const GOOGLE_VISION_CREDENTIALS_JSON = process.env.GOOGLE_VISION_CREDENTIALS_JSON;
const GOOGLE_VISION_TIMEOUT_MS = Number(process.env.GOOGLE_VISION_TIMEOUT_MS || 20000);
const GOOGLE_VISION_FEATURE =
  process.env.GOOGLE_VISION_FEATURE || "DOCUMENT_TEXT_DETECTION";

type GoogleServiceAccount = {
  project_id: string;
  private_key: string;
  client_email: string;
  token_uri?: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

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
};

let cachedAccessToken: string | null = null;
let cachedAccessTokenExpiresAt = 0;

function getRequiredEnv(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

function getGoogleCredentials() {
  const raw = getRequiredEnv(
    "GOOGLE_VISION_CREDENTIALS_JSON",
    GOOGLE_VISION_CREDENTIALS_JSON
  ).trim();

  try {
    const parsed = JSON.parse(raw) as GoogleServiceAccount;
    if (!parsed.project_id || !parsed.private_key || !parsed.client_email) {
      throw new Error("missing required fields");
    }

    return parsed;
  } catch {
    throw new Error(
      "GOOGLE_VISION_CREDENTIALS_JSON is invalid. It must be a single-line JSON string."
    );
  }
}

function toBase64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function createServiceAccountJwt(credentials: GoogleServiceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "RS256",
    typ: "JWT",
  };
  const claimSet = {
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/cloud-vision",
    aud: credentials.token_uri || "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedClaims = toBase64Url(JSON.stringify(claimSet));
  const unsignedToken = `${encodedHeader}.${encodedClaims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();

  return `${unsignedToken}.${signer.sign(credentials.private_key, "base64url")}`;
}

async function getGoogleAccessToken() {
  if (cachedAccessToken && Date.now() < cachedAccessTokenExpiresAt) {
    return cachedAccessToken;
  }

  const credentials = getGoogleCredentials();
  const assertion = createServiceAccountJwt(credentials);
  const tokenUri = credentials.token_uri || "https://oauth2.googleapis.com/token";

  const response = await fetch(tokenUri, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    signal: AbortSignal.timeout(GOOGLE_VISION_TIMEOUT_MS),
  });

  const data = (await response.json().catch(() => null)) as GoogleTokenResponse | null;
  if (!response.ok || !data?.access_token) {
    throw new Error(
      data?.error_description || data?.error || "Failed to authenticate with Google Vision"
    );
  }

  cachedAccessToken = data.access_token;
  cachedAccessTokenExpiresAt = Date.now() + Math.max((data.expires_in || 3600) - 60, 60) * 1000;

  return cachedAccessToken;
}

export async function recognizeTextFromImage(file: File) {
  const startedAt = Date.now();
  const token = await getGoogleAccessToken();
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
