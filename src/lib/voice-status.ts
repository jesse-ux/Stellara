import type { Voice } from "@/types";

export function getDerivedVoiceStatus(lastUsedAt: string): Voice["status"] {
  const usedAt = new Date(lastUsedAt).getTime();
  const now = Date.now();
  const days = (now - usedAt) / (24 * 60 * 60 * 1000);

  if (days >= 7) return "expired";
  if (days >= 5) return "expiring";
  return "active";
}

export function withDerivedVoiceStatus<T extends Pick<Voice, "status" | "last_used_at">>(
  voice: T
): T {
  if (voice.status === "cloning") {
    return voice;
  }

  return {
    ...voice,
    status: getDerivedVoiceStatus(voice.last_used_at),
  };
}
