"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles, Volume2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/use-toast";
import { MAX_TEXT_LENGTH, validateGenerationText } from "@/lib/voice";
import { withDerivedVoiceStatus } from "@/lib/voice-status";
import type { Voice } from "@/types";
import { AudioPlayer } from "@/components/audio-player";

interface GenerateResult {
  task: {
    id: string;
    voice_name: string;
    audio_url: string;
    created_at: string;
  };
}

const GENERATION_STEPS = [
  "正在校验文本",
  "正在请求语音生成",
  "正在处理音频",
  "已完成，可立即播放",
];

export default function GeneratePage() {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [voiceId, setVoiceId] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [audioUrl, setAudioUrl] = useState("");

  useEffect(() => {
    const loadVoices = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("voices")
        .select("*")
        .order("created_at", { ascending: false });

      const list = ((data as Voice[] | null) ?? [])
        .map(withDerivedVoiceStatus)
        .filter((voice) => voice.status === "active" || voice.status === "expiring");
      setVoices(list);
      if (list[0]) {
        setVoiceId(list[0].id);
      }
      setLoading(false);
    };

    loadVoices();
  }, []);

  useEffect(() => {
    if (!submitting) return;

    const timer = window.setInterval(() => {
      setStepIndex((current) => Math.min(current + 1, GENERATION_STEPS.length - 2));
    }, 1200);

    return () => window.clearInterval(timer);
  }, [submitting]);

  const textError = useMemo(() => validateGenerationText(text), [text]);
  const remainingChars = MAX_TEXT_LENGTH - text.length;

  const handleGenerate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (textError) {
      toast({ title: "无法生成", description: textError, variant: "destructive" });
      return;
    }

    setSubmitting(true);
    setStepIndex(0);
    setAudioUrl("");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId, text }),
      });

      const data = (await response.json()) as GenerateResult & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "生成失败");
      }

      setStepIndex(GENERATION_STEPS.length - 1);
      setAudioUrl(data.task.audio_url);

      toast({
        title: "生成完成",
        description: "音频已经生成，请使用底部播放条开始播放。",
      });
    } catch (error) {
      toast({
        title: "生成失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`space-y-8 ${audioUrl ? "pb-36" : ""}`}>
      <div className="page-header">
        <div>
          <h1 className="page-title">生成音频</h1>
          <p className="page-subtitle mt-1">
            选择一个音色，输入文本，系统会生成结果并自动播放。
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_320px]">
        <Card>
          <CardHeader>
            <CardTitle>生成设置</CardTitle>
            <CardDescription>当前版本限制单次文本不超过 {MAX_TEXT_LENGTH} 个字符。</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={handleGenerate}>
              <div className="space-y-2">
                <Label>选择音色</Label>
                <Select value={voiceId} onValueChange={setVoiceId} disabled={loading || voices.length === 0}>
                  <SelectTrigger>
                    <SelectValue placeholder={loading ? "正在加载音色" : "请选择音色"} />
                  </SelectTrigger>
                  <SelectContent>
                    {voices.map((voice) => (
                      <SelectItem key={voice.id} value={voice.id}>
                        {voice.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="generation-text">口语文本</Label>
                  <span
                    className={`text-xs ${remainingChars < 0 ? "text-red-400" : "text-stellara-gray-6"}`}
                  >
                    {remainingChars} 字符剩余
                  </span>
                </div>
                <Textarea
                  id="generation-text"
                  name="generation_text"
                  autoComplete="off"
                  maxLength={MAX_TEXT_LENGTH}
                  placeholder="例如：Good morning professor, today I will talk about my project…"
                  rows={10}
                  value={text}
                  onChange={(event) => setText(event.target.value.slice(0, MAX_TEXT_LENGTH))}
                />
                {textError && <p className="text-sm text-red-400">{textError}</p>}
              </div>

              <Button type="submit" disabled={submitting || loading || voices.length === 0 || !!textError}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    正在生成
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    开始生成
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>生成状态</CardTitle>
            <CardDescription>当前使用单请求完成生成，结果成功后自动播放。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-stellara-gray-6">
                <span>{GENERATION_STEPS[stepIndex]}</span>
                <span>{submitting ? "进行中" : audioUrl ? "完成" : "待开始"}</span>
              </div>
              <Progress value={audioUrl ? 100 : submitting ? 66 : 0} />
            </div>

            <div className="panel-muted p-4">
              {audioUrl ? (
                <>
                  <div className="flex items-center gap-2 text-stellara-white">
                    <Volume2 className="h-4 w-4 text-stellara-gold" />
                    音频已生成
                  </div>
                  <p className="text-sm text-stellara-gray-6">
                    请点击底部播放条上的播放按钮开始收听，也可以直接下载音频。
                  </p>
                </>
              ) : (
                <p className="text-sm text-stellara-gray-6">
                  生成成功后，页面底部会出现固定播放条。
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {audioUrl ? (
        <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4 sm:px-6">
          <div className="mx-auto w-full max-w-5xl">
            <AudioPlayer
              key={audioUrl}
              src={audioUrl}
              className="border border-stellara-gray-3/80 bg-stellara-gray-1/92 shadow-[0_-12px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
