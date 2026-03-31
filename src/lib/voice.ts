const AUDIO_EXTENSIONS = [".mp3", ".m4a", ".wav"] as const;
const AUDIO_MIME_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
] as const;

export const MIN_AUDIO_BYTES = 100 * 1024;
export const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
export const MIN_VOICE_SAMPLE_SECONDS = 10;
export const MAX_TEXT_LENGTH = 1000;
export const DEFAULT_PREVIEW_TEXT =
  "Hello, this is my Stellara voice preview. I can speak English and 中文 naturally.";

export function isSupportedAudioFile(file: File) {
  const lowerName = file.name.toLowerCase();
  const hasSupportedExtension = AUDIO_EXTENSIONS.some((ext) =>
    lowerName.endsWith(ext)
  );

  return hasSupportedExtension || AUDIO_MIME_TYPES.includes(file.type as (typeof AUDIO_MIME_TYPES)[number]);
}

export function validateVoiceSample(file: File) {
  if (!isSupportedAudioFile(file)) {
    return "请上传 mp3、m4a 或 wav 音频文件";
  }

  if (file.size > MAX_AUDIO_BYTES) {
    return "音频不能超过 20MB";
  }

  if (file.size < MIN_AUDIO_BYTES) {
    return "音频过短，请上传至少 10 秒的样本";
  }

  return null;
}

export function validateVoiceSampleDuration(durationSeconds: number) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return "无法读取音频时长，请更换文件后重试";
  }

  if (durationSeconds < MIN_VOICE_SAMPLE_SECONDS) {
    return `音频时长不足，请上传至少 ${MIN_VOICE_SAMPLE_SECONDS} 秒的样本`;
  }

  return null;
}

export async function getAudioDuration(file: File): Promise<number> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const duration = await new Promise<number>((resolve, reject) => {
      const audio = document.createElement("audio");
      audio.preload = "metadata";
      audio.src = objectUrl;

      audio.onloadedmetadata = () => resolve(audio.duration);
      audio.onerror = () => reject(new Error("Failed to load audio metadata"));
    });

    return duration;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function validateGenerationText(text: string) {
  if (!text.trim()) {
    return "请输入要生成的文本";
  }

  if (text.length > MAX_TEXT_LENGTH) {
    return `文本不能超过 ${MAX_TEXT_LENGTH} 个字符`;
  }

  return null;
}

export function sanitizeVoiceName(name: string) {
  return name.trim().replace(/\s+/g, " ").slice(0, 50);
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
