import { createSign } from "node:crypto";

const GOOGLE_APPLICATION_CREDENTIALS_JSON =
  process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
  process.env.GOOGLE_VISION_CREDENTIALS_JSON;
const GOOGLE_AUTH_TIMEOUT_MS = Number(
  process.env.GOOGLE_AUTH_TIMEOUT_MS || process.env.GOOGLE_VISION_TIMEOUT_MS || 20000
);

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

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

function getRequiredEnv(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

export function getGoogleCredentials() {
  const raw = getRequiredEnv(
    "GOOGLE_APPLICATION_CREDENTIALS_JSON",
    GOOGLE_APPLICATION_CREDENTIALS_JSON
  ).trim();

  try {
    const parsed = JSON.parse(raw) as GoogleServiceAccount;
    if (!parsed.project_id || !parsed.private_key || !parsed.client_email) {
      throw new Error("missing required fields");
    }

    return parsed;
  } catch {
    throw new Error(
      "GOOGLE_APPLICATION_CREDENTIALS_JSON is invalid. It must be a single-line JSON string."
    );
  }
}

function toBase64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function createServiceAccountJwt(credentials: GoogleServiceAccount, scope: string) {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "RS256",
    typ: "JWT",
  };
  const claimSet = {
    iss: credentials.client_email,
    scope,
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

export async function getGoogleAccessToken(scope: string) {
  const cached = tokenCache.get(scope);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.token;
  }

  const credentials = getGoogleCredentials();
  const assertion = createServiceAccountJwt(credentials, scope);
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
    signal: AbortSignal.timeout(GOOGLE_AUTH_TIMEOUT_MS),
  });

  const data = (await response.json().catch(() => null)) as GoogleTokenResponse | null;
  if (!response.ok || !data?.access_token) {
    throw new Error(
      data?.error_description || data?.error || "Failed to authenticate with Google Cloud"
    );
  }

  const expiresAt = Date.now() + Math.max((data.expires_in || 3600) - 60, 60) * 1000;
  tokenCache.set(scope, {
    token: data.access_token,
    expiresAt,
  });

  return data.access_token;
}
