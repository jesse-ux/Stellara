export const MAX_ASR_AUDIO_BYTES = 10 * 1024 * 1024;
export const MAX_ASR_RECORDING_SECONDS = 60;

export function validateAsrAudio(file: File) {
  if (!file.size) {
    return "录音文件为空，请重新录制";
  }

  if (file.size > MAX_ASR_AUDIO_BYTES) {
    return "录音过大，请控制在 60 秒内后重试";
  }

  if (file.type && !file.type.toLowerCase().startsWith("audio/")) {
    return "当前录音文件不是有效音频，请重新录制";
  }

  return null;
}
