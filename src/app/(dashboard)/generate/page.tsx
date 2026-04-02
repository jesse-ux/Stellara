"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Camera, Loader2, Sparkles, Volume2 } from "lucide-react";
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
import { MAX_OCR_IMAGE_BYTES, MAX_OCR_IMAGE_DIMENSION, validateOcrImage } from "@/lib/ocr";

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
  const searchParams = useSearchParams();
  const [voices, setVoices] = useState<Voice[]>([]);
  const [voiceId, setVoiceId] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [audioUrl, setAudioUrl] = useState("");
  const requestedVoiceId = searchParams.get("voiceId");
  const isFirstGeneration = searchParams.get("first") === "1";

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

      if (list.length > 0) {
        const preferredVoice = requestedVoiceId
          ? list.find((voice) => voice.id === requestedVoiceId)
          : null;
        setVoiceId(preferredVoice?.id ?? list[0].id);
      }
      setLoading(false);
    };

    loadVoices();
  }, [requestedVoiceId]);

  useEffect(() => {
    if (!submitting) return;

    const timer = window.setInterval(() => {
      setStepIndex((current) => Math.min(current + 1, GENERATION_STEPS.length - 2));
    }, 1200);

    return () => window.clearInterval(timer);
  }, [submitting]);

  const textError = useMemo(() => validateGenerationText(text), [text]);
  const remainingChars = MAX_TEXT_LENGTH - text.length;

  const resizeImageForOcr = async (file: File) => {
    if (file.type === "image/heic" || file.type === "image/heif") {
      return file;
    }

    // Skip client-side re-encoding for files that are already within our target budget.
    // On mobile this avoids an expensive decode + canvas draw + JPEG encode on the main thread.
    if (file.size <= MAX_OCR_IMAGE_BYTES) {
      return file;
    }

    const objectUrl = URL.createObjectURL(file);

    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error("图片读取失败"));
        element.src = objectUrl;
      });

      const largestSide = Math.max(image.width, image.height);
      const scale = largestSide > MAX_OCR_IMAGE_DIMENSION
        ? MAX_OCR_IMAGE_DIMENSION / largestSide
        : 1;

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);

      const context = canvas.getContext("2d");
      if (!context) {
        return file;
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", 0.86);
      });

      if (!blob) {
        return file;
      }

      const normalizedName = file.name.replace(/\.[^.]+$/, "") || "capture";
      const compressed = new File([blob], `${normalizedName}.jpg`, { type: "image/jpeg" });

      if (compressed.size >= file.size && file.size <= MAX_OCR_IMAGE_BYTES) {
        return file;
      }

      return compressed;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const handleOcrFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    const validationError = validateOcrImage(file);
    if (validationError) {
      toast({ title: "无法识别图片", description: validationError, variant: "destructive" });
      return;
    }

    setOcrLoading(true);

    try {
      const startedAt = performance.now();
      const preparedFile = await resizeImageForOcr(file);
      const preprocessFinishedAt = performance.now();
      const formData = new FormData();
      formData.append("image", preparedFile);

      const response = await fetch("/api/ocr", {
        method: "POST",
        body: formData,
      });
      const responseFinishedAt = performance.now();

      const data = (await response.json()) as { text?: string; error?: string };
      if (!response.ok || !data.text) {
        throw new Error(data.error || "图片识别失败");
      }

      const nextText = data.text.slice(0, MAX_TEXT_LENGTH);
      setText(nextText);

      toast({
        title: "识别完成",
        description:
          data.text.length > MAX_TEXT_LENGTH
            ? `文本过长，已截断到 ${MAX_TEXT_LENGTH} 个字符。`
            : "识别结果已填入口语文本。",
      });

      console.info("[ocr] client timings", {
        originalBytes: file.size,
        uploadedBytes: preparedFile.size,
        preprocessMs: Math.round(preprocessFinishedAt - startedAt),
        requestMs: Math.round(responseFinishedAt - preprocessFinishedAt),
        totalMs: Math.round(responseFinishedAt - startedAt),
      });
    } catch (error) {
      toast({
        title: "OCR 识别失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setOcrLoading(false);
    }
  };

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
            选择一个音色，输入文本，或在手机上拍照识别讲稿，再生成语音。
          </p>
        </div>
      </div>

      {isFirstGeneration ? (
        <Card className="border border-stellara-gold/20 bg-stellara-gold/8">
          <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-sm font-medium text-stellara-white">先完成你的第一次试听</div>
              <p className="mt-1 text-sm text-stellara-gray-6">
                先用 1 到 3 句短文本确认音色效果，再继续生成更长的口语内容。
              </p>
            </div>
            <div className="text-sm text-stellara-gray-6">
              确认清晰度和语气符合预期后，再继续生成正式内容。
            </div>
          </CardContent>
        </Card>
      ) : null}

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
                  <div className="flex items-center gap-2">
                    <Label htmlFor="generation-text">口语文本</Label>
                    <label className="sm:hidden">
                      <input
                        accept="image/*"
                        capture="environment"
                        className="sr-only"
                        disabled={ocrLoading || submitting}
                        type="file"
                        onChange={handleOcrFileChange}
                      />
                      <span className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-stellara-gray-4 bg-stellara-gray-1/40 px-3 text-xs font-medium text-stellara-gray-6 transition-colors hover:bg-stellara-gray-2/70 hover:text-stellara-white">
                        {ocrLoading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Camera className="h-3.5 w-3.5" />
                        )}
                        {ocrLoading ? "识别中" : "拍照导入"}
                      </span>
                    </label>
                  </div>
                  <span className="text-xs text-stellara-gray-6">
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
                <p className="text-xs text-stellara-gray-6 sm:hidden">
                  手机上可直接拍照识别讲稿，识别结果会自动填入输入框。
                </p>
                {textError && <p className="text-sm text-red-400">{textError}</p>}
              </div>

              <Button
                type="submit"
                disabled={submitting || ocrLoading || loading || voices.length === 0 || !!textError}
              >
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
            <CardDescription>当前使用单请求完成生成，结果成功后可立即播放或下载。</CardDescription>
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
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button type="button" variant="outline" size="sm" onClick={() => setText("")}>
                      再生成一条
                    </Button>
                    <Button asChild size="sm">
                      <Link href="/history">查看生成记录</Link>
                    </Button>
                  </div>
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
