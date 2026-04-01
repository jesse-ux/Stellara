import { normalizeOcrText } from "@/lib/ocr";

const PADDLE_OCR_API_URL = process.env.PADDLE_OCR_API_URL;
const PADDLE_OCR_TOKEN = process.env.PADDLE_OCR_TOKEN;
const PADDLE_OCR_TIMEOUT_MS = Number(process.env.PADDLE_OCR_TIMEOUT_MS || 60000);

type PaddleLayoutResult = {
  markdown?: {
    text?: string;
  };
};

type PaddleResponse = {
  result?: {
    layoutParsingResults?: PaddleLayoutResult[];
  };
  error?: string;
  message?: string;
};

function getRequiredEnv(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

export async function recognizeTextFromImage(file: File) {
  const apiUrl = getRequiredEnv("PADDLE_OCR_API_URL", PADDLE_OCR_API_URL);
  const token = getRequiredEnv("PADDLE_OCR_TOKEN", PADDLE_OCR_TOKEN);

  const buffer = Buffer.from(await file.arrayBuffer());
  const payload = {
    file: buffer.toString("base64"),
    fileType: 1,
    useDocOrientationClassify: false,
    useDocUnwarping: false,
    useChartRecognition: false,
  };

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `token ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(PADDLE_OCR_TIMEOUT_MS),
  });

  const data = (await response.json().catch(() => null)) as PaddleResponse | null;

  if (!response.ok) {
    throw new Error(data?.error || data?.message || "OCR 服务请求失败");
  }

  const rawText = (data?.result?.layoutParsingResults ?? [])
    .map((item) => item.markdown?.text?.trim())
    .filter((text): text is string => Boolean(text))
    .join("\n\n");

  const text = normalizeOcrText(rawText);
  if (!text) {
    throw new Error("未识别到可用文本，请调整拍摄角度后重试");
  }

  return { text };
}
