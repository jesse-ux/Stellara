export const GENERATED_AUDIO_BUCKET = "generated-audio";

export function isRemoteUrl(value: string | null | undefined) {
  return Boolean(value && /^https?:\/\//i.test(value));
}

export function buildGeneratedAudioPath(userId: string, taskId: string) {
  return `${userId}/${taskId}.mp3`;
}
