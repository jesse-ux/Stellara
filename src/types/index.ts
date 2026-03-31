export interface Voice {
  id: string;
  user_id: string;
  name: string;
  minimax_voice_id: string;
  status: "cloning" | "active" | "expiring" | "expired";
  last_used_at: string;
  created_at: string;
  preview_url?: string;
}

export interface GenerationTask {
  id: string;
  user_id: string;
  voice_id: string;
  text: string;
  status: "pending" | "processing" | "completed" | "failed";
  temp_audio_url?: string;
  storage_audio_url?: string;
  error_code?: number;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export interface GenerationHistoryItem {
  id: string;
  voice_id: string;
  voice_name: string;
  text: string;
  audio_url: string;
  created_at: string;
  duration_seconds?: number;
}
