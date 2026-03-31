const MINIMAX_API_BASE =
  process.env.MINIMAX_API_BASE?.replace(/\/$/, "") || "https://api.minimax.io/v1";
const MINIMAX_TIMEOUT_MS = Number(process.env.MINIMAX_TIMEOUT_MS || 120000);
const MINIMAX_MAX_RETRIES = Number(process.env.MINIMAX_MAX_RETRIES || 2);

interface MiniMaxJson {
  base_resp?: {
    status_code?: number;
    status_msg?: string;
  };
  file?: {
    file_id?: number | string;
  };
  demo_audio?: string;
  input_sensitive?: {
    type?: number;
  };
  data?: {
    audio?: string;
    audio_file?: string;
  };
  audio_file?: string;
  message?: string;
  msg?: string;
  [key: string]: unknown;
}

function minimaxHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${process.env.MINIMAX_API_KEY}`,
    "Content-Type": "application/json",
  };
}

export class MiniMaxError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
    this.name = "MiniMaxError";
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isNetworkTimeoutError(error: unknown) {
  if (!(error instanceof Error)) return false;

  const code = (error.cause as { code?: string } | undefined)?.code;
  return (
    error.name === "AbortError" ||
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    code === "UND_ERR_HEADERS_TIMEOUT" ||
    error.message.toLowerCase().includes("fetch failed")
  );
}

async function fetchMiniMax(
  input: string,
  init: RequestInit,
  scope: string
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MINIMAX_MAX_RETRIES; attempt += 1) {
    try {
      const res = await fetch(input, {
        ...init,
        signal: AbortSignal.timeout(MINIMAX_TIMEOUT_MS),
      });
      return res;
    } catch (error) {
      lastError = error;

      if (!isNetworkTimeoutError(error) || attempt === MINIMAX_MAX_RETRIES) {
        console.error(`[MiniMax:${scope}] network failure`, {
          apiBase: MINIMAX_API_BASE,
          attempt,
          error,
        });
        throw new MiniMaxError(
          1001,
          error instanceof Error ? error.message : "MiniMax network failure"
        );
      }

      console.warn(`[MiniMax:${scope}] retrying after network failure`, {
        apiBase: MINIMAX_API_BASE,
        attempt,
        error,
      });
      await sleep(attempt * 1500);
    }
  }

  throw new MiniMaxError(
    1001,
    lastError instanceof Error ? lastError.message : "MiniMax network failure"
  );
}

async function parseMiniMaxJson(res: Response): Promise<MiniMaxJson> {
  const text = await res.text();

  try {
    return text ? (JSON.parse(text) as MiniMaxJson) : {};
  } catch {
    throw new MiniMaxError(
      res.status || -3,
      `MiniMax returned non-JSON response: ${text.slice(0, 300)}`
    );
  }
}

function getMiniMaxStatus(data: MiniMaxJson, res: Response): number {
  if (typeof data.base_resp?.status_code === "number") {
    return data.base_resp.status_code;
  }

  return res.ok ? 0 : res.status;
}

function getMiniMaxMessage(data: MiniMaxJson, fallback: string): string {
  return (
    data.base_resp?.status_msg ||
    (typeof data.message === "string" ? data.message : undefined) ||
    (typeof data.msg === "string" ? data.msg : undefined) ||
    fallback
  );
}

function logMiniMaxFailure(scope: string, status: number, data: MiniMaxJson) {
  console.error(`[MiniMax:${scope}] failed`, {
    apiBase: MINIMAX_API_BASE,
    status,
    response: data,
  });
}

export async function uploadFile(
  file: File,
  purpose: "voice_clone" | "prompt_audio"
): Promise<number> {
  const formData = new FormData();
  formData.append("purpose", purpose);
  formData.append("file", file);

  const res = await fetchMiniMax(`${MINIMAX_API_BASE}/files/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.MINIMAX_API_KEY}`,
    },
    body: formData,
  }, "uploadFile");

  const data = await parseMiniMaxJson(res);
  const status = getMiniMaxStatus(data, res);

  if (status !== 0) {
    logMiniMaxFailure("uploadFile", status, data);
    throw new MiniMaxError(
      status,
      `File upload failed: ${getMiniMaxMessage(data, "Unknown error")}`
    );
  }

  const fileId = data.file?.file_id;
  if (typeof fileId !== "number" && typeof fileId !== "string") {
    logMiniMaxFailure("uploadFile.missingFileId", status, data);
    throw new MiniMaxError(-2, "No file_id returned from upload API");
  }

  return Number(fileId);
}

export interface CloneVoiceParams {
  fileId: number;
  voiceId: string;
  previewText?: string;
  promptAudioId?: number;
  promptText?: string;
}

export interface CloneVoiceResult {
  demoAudioUrl?: string;
  inputSensitive: number;
}

export async function cloneVoice(
  params: CloneVoiceParams
): Promise<CloneVoiceResult> {
  const body: Record<string, unknown> = {
    file_id: params.fileId,
    voice_id: params.voiceId,
  };

  if (params.promptAudioId && params.promptText) {
    body.clone_prompt = {
      prompt_audio: params.promptAudioId,
      prompt_text: params.promptText,
    };
  }

  if (params.previewText) {
    body.text = params.previewText;
    body.model = "speech-2.8-hd";
    body.language_boost = "auto";
  }

  body.need_noise_reduction = false;
  body.need_volume_normalization = false;

  const res = await fetchMiniMax(`${MINIMAX_API_BASE}/voice_clone`, {
    method: "POST",
    headers: minimaxHeaders(),
    body: JSON.stringify(body),
  }, "cloneVoice");

  const data = await parseMiniMaxJson(res);
  const status = getMiniMaxStatus(data, res);

  if (status !== 0) {
    logMiniMaxFailure("cloneVoice", status, data);
    throw new MiniMaxError(
      status,
      `Voice clone failed: ${getMiniMaxMessage(data, "Unknown error")}`
    );
  }

  const sensitive = data.input_sensitive?.type ?? 0;
  if (sensitive > 0) {
    throw new MiniMaxError(
      -1,
      `Content moderation triggered (type ${sensitive})`
    );
  }

  return {
    demoAudioUrl: data.demo_audio as string | undefined,
    inputSensitive: sensitive,
  };
}

export interface TTSParams {
  voiceId: string;
  text: string;
  model?: string;
}

export interface TTSResult {
  audioUrl: string;
}

export async function textToSpeech(params: TTSParams): Promise<TTSResult> {
  const body: Record<string, unknown> = {
    model: params.model || "speech-2.8-hd",
    text: params.text,
    stream: false,
    language_boost: "auto",
    output_format: "url",
    voice_setting: {
      voice_id: params.voiceId,
      speed: 1,
      vol: 1,
      pitch: 0,
    },
    audio_setting: {
      sample_rate: 32000,
      bitrate: 128000,
      format: "mp3",
      channel: 1,
    },
  };

  const res = await fetchMiniMax(`${MINIMAX_API_BASE}/t2a_v2`, {
    method: "POST",
    headers: minimaxHeaders(),
    body: JSON.stringify(body),
  }, "textToSpeech");

  const data = await parseMiniMaxJson(res);
  const status = getMiniMaxStatus(data, res);

  if (status !== 0) {
    logMiniMaxFailure("textToSpeech", status, data);
    throw new MiniMaxError(
      status,
      `TTS failed: ${getMiniMaxMessage(data, "Unknown error")}`
    );
  }

  const sensitive = data.input_sensitive?.type ?? 0;
  if (sensitive > 0) {
    throw new MiniMaxError(
      -1,
      `Content moderation triggered (type ${sensitive})`
    );
  }

  const audioUrl =
    (data.data?.audio as string) ||
    (data.data?.audio_file as string) ||
    (data.audio_file as string);
  if (!audioUrl) {
    logMiniMaxFailure("textToSpeech.missingAudio", status, data);
    throw new MiniMaxError(-2, "No audio URL returned from TTS API");
  }

  return { audioUrl };
}

export function isRetryableError(code: number): boolean {
  return code === 1001; // timeout
}

export function isRateLimitError(code: number): boolean {
  return code === 1002;
}

export function isBalanceError(code: number): boolean {
  return code === 1008;
}

export function getErrorMessage(code: number): string {
  const messages: Record<number, string> = {
    400: "MiniMax 请求参数无效",
    401: "MiniMax 鉴权失败，请检查 API Key",
    403: "MiniMax 拒绝访问，请检查账号权限",
    404: "MiniMax 接口地址不正确",
    429: "MiniMax 请求过于频繁，请稍后重试",
    500: "MiniMax 服务异常，请稍后重试",
    1001: "请求超时，请稍后重试",
    1002: "当前排队中，请稍后",
    1004: "服务暂时不可用",
    1008: "服务暂时不可用，请联系管理员",
    2013: "音频格式不支持",
    2037: "音频时长太短，请上传至少 10 秒的样本",
    2038: "服务暂时不可用，请联系管理员",
    [-1]: "上传的音频内容不符合规范",
    [-2]: "音频生成失败，请重试",
  };
  return messages[code] || "操作失败，请稍后重试";
}
