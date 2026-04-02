"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3, History, Play, Volume2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AudioPlayer } from "@/components/audio-player";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { withDerivedVoiceStatus } from "@/lib/voice-status";
import { GENERATED_AUDIO_BUCKET, isRemoteUrl } from "@/lib/storage";
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
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [playRequestId, setPlayRequestId] = useState(0);
  const [resolvedAudioUrls, setResolvedAudioUrls] = useState<Record<string, string>>({});

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

      const nextTasks = (taskData as TaskRow[] | null) ?? [];

      setVoices(voiceMap);
      setTasks(nextTasks);
      setLoading(false);
    };

    loadHistory();
  }, []);

  useEffect(() => {
    const storageTasks = tasks.filter(
      (task) => task.status === "completed" && task.storage_audio_url && !isRemoteUrl(task.storage_audio_url)
    );

    if (storageTasks.length === 0) {
      return;
    }

    let cancelled = false;

    const resolveSignedUrls = async () => {
      const supabase = createClient();
      const nextEntries = await Promise.all(
        storageTasks.map(async (task) => {
          const path = task.storage_audio_url;
          if (!path) return null;

          const { data, error } = await supabase.storage
            .from(GENERATED_AUDIO_BUCKET)
            .createSignedUrl(path, 60 * 60);

          if (error || !data?.signedUrl) {
            return null;
          }

          return [task.id, data.signedUrl] as const;
        })
      );

      if (cancelled) return;

      setResolvedAudioUrls((current) => {
        const next = { ...current };
        nextEntries.forEach((entry) => {
          if (!entry) return;
          next[entry[0]] = entry[1];
        });
        return next;
      });
    };

    void resolveSignedUrls();

    return () => {
      cancelled = true;
    };
  }, [tasks]);

  const completedCount = useMemo(
    () => tasks.filter((task) => task.status === "completed").length,
    [tasks]
  );

  const activeTask = tasks.find((task) => task.id === activeTaskId) ?? null;
  const activeAudioUrl = activeTask
    ? resolvedAudioUrls[activeTask.id] ||
      (activeTask.storage_audio_url && isRemoteUrl(activeTask.storage_audio_url)
        ? activeTask.storage_audio_url
        : "") ||
      activeTask.temp_audio_url ||
      ""
    : "";

  return (
    <div className={`space-y-8 ${activeAudioUrl ? "pb-36" : ""}`}>
      <div className="page-header">
        <div>
          <h1 className="page-title">作品库</h1>
          <p className="page-subtitle mt-1">你最近生成的音频都会沉淀在这里，点击播放按钮即可在底部统一播放。</p>
        </div>
        <div className="text-right text-sm text-stellara-gray-6">
          <div>{tasks.length} 个作品</div>
          <div>{completedCount} 个可播放</div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index}>
              <CardHeader className="pb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 space-y-3">
                    <div className="skeleton-block h-5 w-28 rounded-full" />
                    <div className="skeleton-block h-4 w-36 rounded-full" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="skeleton-block h-9 w-20 rounded-xl" />
                    <div className="skeleton-block h-6 w-16 rounded-full" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-2xl border border-[rgba(255,222,170,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
                  <div className="space-y-2">
                    <div className="skeleton-block h-4 w-full rounded-full" />
                    <div className="skeleton-block h-4 w-[88%] rounded-full" />
                    <div className="skeleton-block h-4 w-[64%] rounded-full" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <History className="h-10 w-10 text-stellara-gray-5" />
            <div>
              <h2 className="text-lg font-medium text-stellara-white">作品库还是空的</h2>
              <p className="mt-1 text-sm text-stellara-gray-6">去生成第一段音频后，这里会自动沉淀你的作品。</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => {
            const voice = voices[task.voice_id];
            const status = statusConfig[task.status];
            const audioUrl =
              resolvedAudioUrls[task.id] ||
              (task.storage_audio_url && isRemoteUrl(task.storage_audio_url)
                ? task.storage_audio_url
                : "") ||
              task.temp_audio_url ||
              "";
            const isActive = activeTaskId === task.id;
            const isLegacyExternalRecord =
              task.status === "completed" &&
              !resolvedAudioUrls[task.id] &&
              Boolean(
                (task.storage_audio_url && isRemoteUrl(task.storage_audio_url)) ||
                task.temp_audio_url
              );

            return (
              <Card
                key={task.id}
                className={isActive ? "border-stellara-gold/30 bg-stellara-gold/6" : ""}
              >
                <CardHeader className="pb-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base">
                        {voice?.name || "未命名音色"}
                      </CardTitle>
                      <CardDescription className="mt-1 flex items-center gap-2">
                        <Clock3 className="h-3.5 w-3.5" />
                        {formatDate(task.created_at)}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {task.status === "completed" && audioUrl ? (
                        <Button
                          type="button"
                          variant={isActive ? "secondary" : "outline"}
                          size="sm"
                          className="shrink-0"
                          onClick={() => {
                            setActiveTaskId(task.id);
                            setPlayRequestId((current) => current + 1);
                          }}
                        >
                          <Play className="mr-2 h-4 w-4" />
                          {isActive ? "播放中" : "播放"}
                        </Button>
                      ) : null}
                      <Badge className={status.className}>{status.label}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div
                    className={`rounded-2xl p-4 text-sm break-words ${
                      isActive
                        ? "bg-stellara-gold/10 text-stellara-white"
                        : "panel-muted text-stellara-gray-7"
                    }`}
                  >
                    {task.text}
                  </div>

                  {task.status === "failed" ? (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
                      {task.error_message || "生成失败，请重新尝试"}
                    </div>
                  ) : isLegacyExternalRecord ? (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100">
                      这是一条旧记录，音频还未迁移到 Supabase Storage。若外部链接失效，可能无法继续播放。
                    </div>
                  ) : task.status !== "completed" ? (
                    <div className="flex items-center gap-2 text-sm text-stellara-gray-6">
                      <Volume2 className="h-4 w-4" />
                      任务仍在处理中
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {activeAudioUrl ? (
        <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4 sm:px-6">
          <div className="mx-auto w-full max-w-5xl">
            <AudioPlayer
              key={`${activeTaskId ?? "none"}-${playRequestId}`}
              src={activeAudioUrl}
              autoPlay
              className="border border-stellara-gray-3/80 bg-stellara-gray-1/92 shadow-[0_-12px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
