export const MAX_ASR_AUDIO_BYTES = 10 * 1024 * 1024;
export const MAX_ASR_RECORDING_SECONDS = 60;

const ACCEPTED_ASR_AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/ogg;codecs=opus",
]);

export function validateAsrAudio(file: File) {
  if (!file.size) {
    return "录音文件为空，请重新录制";
  }

  if (file.size > MAX_ASR_AUDIO_BYTES) {
    return "录音过大，请控制在 60 秒内后重试";
  }

  if (file.type && !ACCEPTED_ASR_AUDIO_TYPES.has(file.type)) {
    return "当前录音格式暂不支持，请改用系统默认录音方式重试";
  }

  return null;
}
