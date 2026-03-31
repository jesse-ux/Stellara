"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3, History, Volume2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AudioPlayer } from "@/components/audio-player";
import { formatDate } from "@/lib/utils";
import { withDerivedVoiceStatus } from "@/lib/voice-status";
import type { GenerationTask, Voice } from "@/types";

type TaskRow = GenerationTask;

const statusConfig = {
  pending: { label: "等待中", className: "bg-blue-500/10 text-blue-300 border-blue-500/20" },
  processing: { label: "生成中", className: "bg-yellow-500/10 text-yellow-300 border-yellow-500/20" },
  completed: { label: "已完成", className: "bg-green-500/10 text-green-300 border-green-500/20" },
  failed: { label: "失败", className: "bg-red-500/10 text-red-300 border-red-500/20" },
} as const;

export default function HistoryPage() {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [voices, setVoices] = useState<Record<string, Voice>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
      const supabase = createClient();
      const [{ data: taskData }, { data: voiceData }] = await Promise.all([
        supabase.from("generation_tasks").select("*").order("created_at", { ascending: false }).limit(20),
        supabase.from("voices").select("*"),
      ]);

      const voiceMap = ((voiceData as Voice[] | null) ?? []).reduce<Record<string, Voice>>(
        (accumulator, voice) => {
          accumulator[voice.id] = withDerivedVoiceStatus(voice);
          return accumulator;
        },
        {}
      );

      setVoices(voiceMap);
      setTasks((taskData as TaskRow[] | null) ?? []);
      setLoading(false);
    };

    loadHistory();
  }, []);

  const completedCount = useMemo(
    () => tasks.filter((task) => task.status === "completed").length,
    [tasks]
  );

  return (
    <div className="space-y-8">
      <div className="page-header">
        <div>
          <h1 className="page-title">生成历史</h1>
          <p className="page-subtitle mt-1">查看最近生成结果，回放成功音频，并排查失败任务。</p>
        </div>
        <div className="text-right text-sm text-stellara-gray-6">
          <div>{tasks.length} 条记录</div>
          <div>{completedCount} 条已完成</div>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-6 text-stellara-gray-6">正在加载历史记录...</CardContent>
        </Card>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <History className="h-10 w-10 text-stellara-gray-5" />
            <div>
              <h2 className="text-lg font-medium text-stellara-white">还没有生成记录</h2>
              <p className="mt-1 text-sm text-stellara-gray-6">去生成第一段音频后，这里会自动出现历史。</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => {
            const voice = voices[task.voice_id];
            const status = statusConfig[task.status];
            const audioUrl = task.storage_audio_url || task.temp_audio_url;

            return (
              <Card key={task.id}>
                <CardHeader className="pb-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{voice?.name || "未命名音色"}</CardTitle>
                      <CardDescription className="mt-1 flex items-center gap-2">
                        <Clock3 className="h-3.5 w-3.5" />
                        {formatDate(task.created_at)}
                      </CardDescription>
                    </div>
                    <Badge className={status.className}>{status.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="panel-muted p-4 text-sm text-stellara-gray-7 break-words">
                    {task.text}
                  </div>

                  {task.status === "completed" && audioUrl ? (
                    <AudioPlayer src={audioUrl} />
                  ) : task.status === "failed" ? (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
                      {task.error_message || "生成失败，请重新尝试"}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-stellara-gray-6">
                      <Volume2 className="h-4 w-4" />
                      任务仍在处理中
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
