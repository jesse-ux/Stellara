"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileAudio, Loader2, Mic, Pause, Sparkles, Upload, X } from "lucide-react";
import { AudioPlayer } from "@/components/audio-player";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/use-toast";
import {
  DEFAULT_PREVIEW_TEXT,
  MAX_AUDIO_BYTES,
  formatBytes,
  getAudioDuration,
  validateVoiceSample,
  validateVoiceSampleDuration,
} from "@/lib/voice";

function encodeWav(audioBuffer: AudioBuffer) {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1;
  const bitDepth = 16;
  const samples = audioBuffer.length;
  const blockAlign = numberOfChannels * (bitDepth / 8);
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  const channels = Array.from({ length: numberOfChannels }, (_, index) =>
    audioBuffer.getChannelData(index)
  );

  for (let sampleIndex = 0; sampleIndex < samples; sampleIndex += 1) {
    for (let channelIndex = 0; channelIndex < numberOfChannels; channelIndex += 1) {
      const sample = Math.max(-1, Math.min(1, channels[channelIndex][sampleIndex]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return buffer;
}

async function blobToWavFile(blob: Blob, fileName: string) {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new AudioContext();

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const wavBuffer = encodeWav(audioBuffer);
    return new File([wavBuffer], fileName, { type: "audio/wav" });
  } finally {
    await audioContext.close();
  }
}

function formatRecordingTime(totalSeconds: number) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function NewVoicePage() {
  const router = useRouter();
  const sampleInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const shouldPersistRecordingRef = useRef(true);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [name, setName] = useState("");
  const [sample, setSample] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [sampleDuration, setSampleDuration] = useState<number | null>(null);
  const [sampleDurationError, setSampleDurationError] = useState<string | null>(null);
  const [checkingDuration, setCheckingDuration] = useState(false);
  const [samplePreviewUrl, setSamplePreviewUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [preparingRecorder, setPreparingRecorder] = useState(false);
  const [spectrumBars, setSpectrumBars] = useState<number[]>(Array.from({ length: 24 }, () => 8));
  const [isDragOver, setIsDragOver] = useState(false);

  const sampleError = useMemo(
    () => (sample ? validateVoiceSample(sample) : null),
    [sample]
  );

  useEffect(() => {
    let cancelled = false;

    if (!sample) {
      setSampleDuration(null);
      setSampleDurationError(null);
      setCheckingDuration(false);
      return;
    }

    const baseError = validateVoiceSample(sample);
    if (baseError) {
      setSampleDuration(null);
      setSampleDurationError(null);
      setCheckingDuration(false);
      return;
    }

    setCheckingDuration(true);
    setSampleDuration(null);
    setSampleDurationError(null);

    void getAudioDuration(sample)
      .then((duration) => {
        if (cancelled) return;
        setSampleDuration(duration);
        setSampleDurationError(validateVoiceSampleDuration(duration));
      })
      .catch(() => {
        if (cancelled) return;
        setSampleDuration(null);
        setSampleDurationError("无法读取音频时长，请更换文件后重试");
      })
      .finally(() => {
        if (cancelled) return;
        setCheckingDuration(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sample]);

  useEffect(() => {
    if (!sample) {
      setSamplePreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(sample);
    setSamplePreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [sample]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
      }
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      audioSourceRef.current?.disconnect();
      analyserRef.current?.disconnect();
      void audioContextRef.current?.close();
    };
  }, []);

  const canSubmit =
    sample && !sampleError && !sampleDurationError && !checkingDuration && !loading;
  const sampleStage = isRecording ? "recording" : sample ? "ready" : "idle";

  const applySampleFile = (file: File | null) => {
    if (!file) return;
    setSample(file);
  };

  const clearSample = () => {
    setSample(null);
    setSampleDuration(null);
    setSampleDurationError(null);
    setCheckingDuration(false);
    if (sampleInputRef.current) {
      sampleInputRef.current.value = "";
    }
  };

  const stopVisualizer = async () => {
    if (animationFrameRef.current) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    audioSourceRef.current?.disconnect();
    analyserRef.current?.disconnect();
    audioSourceRef.current = null;
    analyserRef.current = null;
    if (audioContextRef.current) {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setSpectrumBars(Array.from({ length: 24 }, () => 8));
  };

  const startVisualizer = (stream: MediaStream) => {
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.82;
    source.connect(analyser);

    audioContextRef.current = audioContext;
    analyserRef.current = analyser;
    audioSourceRef.current = source;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const update = () => {
      analyser.getByteFrequencyData(dataArray);
      const step = Math.max(1, Math.floor(dataArray.length / 24));
      const nextBars = Array.from({ length: 24 }, (_, index) => {
        const value = dataArray[index * step] ?? 0;
        return Math.max(8, Math.min(100, Math.round((value / 255) * 100)));
      });
      setSpectrumBars(nextBars);
      animationFrameRef.current = window.requestAnimationFrame(update);
    };

    update();
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast({
        title: "当前浏览器不支持录音",
        description: "请改用上传音频文件。",
        variant: "destructive",
      });
      return;
    }

    try {
      setPreparingRecorder(true);
      clearSample();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      startVisualizer(stream);

      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      });

      recorder.addEventListener("stop", () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });

        if (!shouldPersistRecordingRef.current) {
          mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
          void stopVisualizer();
          shouldPersistRecordingRef.current = true;
          return;
        }

        void blobToWavFile(blob, `voice-sample-${Date.now()}.wav`)
          .then((file) => {
            applySampleFile(file);
            toast({
              title: "录音已保存",
              description: "可以直接试听并继续克隆音色。",
            });
          })
          .catch(() => {
            toast({
              title: "录音处理失败",
              description: "请改用上传文件，或重新录制一次。",
              variant: "destructive",
            });
          })
          .finally(() => {
            mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
            mediaStreamRef.current = null;
            void stopVisualizer();
            shouldPersistRecordingRef.current = true;
          });
      });

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((current) => current + 1);
      }, 1000);
    } catch (error) {
      toast({
        title: "无法开始录音",
        description: error instanceof Error ? error.message : "请检查麦克风权限后重试。",
        variant: "destructive",
      });
    } finally {
      setPreparingRecorder(false);
    }
  };

  const stopRecording = () => {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    setIsRecording(false);
  };

  const cancelRecording = () => {
    shouldPersistRecordingRef.current = false;
    stopRecording();
    setRecordingSeconds(0);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!sample) {
      toast({ title: "缺少声音样本", description: "请先上传你的声音样本", variant: "destructive" });
      return;
    }

    const error = validateVoiceSample(sample);
    if (error) {
      toast({ title: "样本无效", description: error, variant: "destructive" });
      return;
    }

    if (sampleDurationError) {
      toast({ title: "样本无效", description: sampleDurationError, variant: "destructive" });
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append("name", name);
    formData.append("sample", sample);

    try {
      const response = await fetch("/api/voices", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "克隆失败");
      }

      toast({
        title: "音色克隆成功",
        description: "你现在可以直接去生成音频了",
      });
      router.push("/voices");
      router.refresh();
    } catch (error) {
      toast({
        title: "克隆失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="page-header">
        <div>
          <h1 className="page-title">克隆新音色</h1>
          <p className="page-subtitle mt-1">
            上传一段清晰样本，系统会为你生成可直接用于口语作业的个人音色。
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_320px]">
        <Card>
          <CardHeader>
            <CardTitle>上传声音样本</CardTitle>
            <CardDescription>
              支持 `mp3 / m4a / wav`，建议 10 秒到 5 分钟，最大 {formatBytes(MAX_AUDIO_BYTES)}。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="voice-name">音色名称</Label>
                <Input
                  id="voice-name"
                  name="voice_name"
                  autoComplete="off"
                  placeholder="例如：Bella 口试音色…"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sample-file">主样本音频</Label>
                <input
                  id="sample-file"
                  ref={sampleInputRef}
                  name="sample_file"
                  type="file"
                  accept=".mp3,.m4a,.wav,audio/*"
                  className="hidden"
                  onChange={(event) => applySampleFile(event.target.files?.[0] ?? null)}
                />
                {sampleStage === "idle" && (
                  <div
                    onDragOver={(event) => {
                      event.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={(event) => {
                      event.preventDefault();
                      setIsDragOver(false);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      setIsDragOver(false);
                      applySampleFile(event.dataTransfer.files?.[0] ?? null);
                    }}
                    className={`rounded-[28px] border border-dashed px-6 py-8 transition-colors sm:px-8 sm:py-10 ${
                      isDragOver
                        ? "border-stellara-gold/60 bg-stellara-gold/8"
                        : "border-stellara-gray-4 bg-stellara-gray-1/28"
                    }`}
                  >
                    <div className="flex flex-col items-center text-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-stellara-gold/10 text-stellara-gold">
                        <FileAudio className="h-7 w-7" />
                      </div>
                      <div className="mt-6 space-y-2">
                        <div className="text-lg font-medium text-stellara-white">
                          上传或录制主样本音频
                        </div>
                        <p className="max-w-xl text-sm leading-6 text-stellara-gray-6">
                          支持 mp3、m4a、wav，建议 10 秒到 5 分钟。你也可以直接把文件拖拽到这个区域。
                        </p>
                      </div>

                      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                        <Button
                          type="button"
                          variant="secondary"
                          className="min-w-[132px]"
                          onClick={() => sampleInputRef.current?.click()}
                          disabled={loading}
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          上传音频
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="min-w-[132px]"
                          onClick={() => {
                            void startRecording();
                          }}
                          disabled={preparingRecorder || loading}
                        >
                          {preparingRecorder ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              准备录音
                            </>
                          ) : (
                            <>
                              <Mic className="mr-2 h-4 w-4" />
                              开始录音
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {sampleStage === "recording" && (
                  <div className="rounded-[28px] border border-stellara-gold/30 bg-stellara-gray-1/34 px-6 py-8 sm:px-8 sm:py-10">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={cancelRecording}
                        className="rounded-full p-2 text-stellara-gray-6 transition-colors hover:bg-stellara-white/5 hover:text-stellara-white"
                        aria-label="取消录音"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    <div className="mt-2 flex flex-col items-center text-center">
                      <div className="text-5xl font-semibold tabular-nums text-stellara-white">
                        {formatRecordingTime(recordingSeconds)}
                      </div>
                      <p className="mt-2 text-sm text-stellara-gray-6">
                        正在录音，建议至少录制 10 秒
                      </p>
                      <div className="mt-8 flex h-20 w-full max-w-md items-end gap-1">
                        {spectrumBars.map((height, index) => (
                          <div
                            key={index}
                            className="flex-1 rounded-full bg-gradient-to-t from-stellara-gold-dark via-stellara-gold to-stellara-gold-light transition-[height] duration-100"
                            style={{ height: `${height}%` }}
                          />
                        ))}
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="mt-8 h-16 w-16 rounded-full border border-stellara-gold/30 bg-stellara-white text-stellara-dark hover:bg-stellara-gold"
                        onClick={stopRecording}
                      >
                        <Pause className="h-6 w-6" />
                      </Button>
                    </div>
                  </div>
                )}

                {sampleStage === "ready" && sample && (
                  <div className="rounded-[28px] border border-stellara-gray-3/80 bg-stellara-gray-1/28 p-4 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-stellara-white text-stellara-dark">
                          <FileAudio className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-lg font-medium text-stellara-white">
                            {sample.name}
                          </div>
                          <div className="mt-1 text-sm text-stellara-gray-6">
                            {sampleDuration ? `${sampleDuration.toFixed(1)} 秒` : "读取中"} · {formatBytes(sample.size)}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => sampleInputRef.current?.click()}
                        >
                          更换音频
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={clearSample}
                        >
                          移除
                        </Button>
                      </div>
                    </div>

                    {samplePreviewUrl && (
                      <div className="mt-4">
                        <AudioPlayer src={samplePreviewUrl} showExternalLink={false} />
                      </div>
                    )}
                  </div>
                )}
                {sampleError && <p className="text-sm text-red-400">{sampleError}</p>}
                {!sampleError && checkingDuration && (
                  <p className="text-sm text-stellara-gray-6">正在检测音频时长...</p>
                )}
                {sampleDurationError && <p className="text-sm text-red-400">{sampleDurationError}</p>}
              </div>

              <div className="panel-muted p-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-4 w-4 text-stellara-gold" />
                  <div className="space-y-2 text-sm text-stellara-gray-6">
                    <p>主样本需至少 10 秒。系统会自动生成一段试听音频，默认内容如下：</p>
                    <p className="text-stellara-white">{DEFAULT_PREVIEW_TEXT}</p>
                  </div>
                </div>
              </div>

              {loading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-stellara-gray-6">
                    <span>正在上传并克隆音色</span>
                    <span>请勿关闭页面</span>
                  </div>
                  <Progress value={66} />
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={!canSubmit}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      正在克隆
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      开始克隆
                    </>
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={() => router.push("/voices")}>
                  返回音色列表
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
          <CardHeader>
            <CardTitle>上传建议</CardTitle>
            <CardDescription>先保证稳定，再追求相似度。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-stellara-gray-6">
            <div className="panel-muted p-4">
              <div className="flex items-center gap-2 text-stellara-white">
                <Mic className="h-4 w-4 text-stellara-gold" />
                样本内容
              </div>
              <p className="mt-2">优先用安静环境下的自然说话，不要加背景音乐，不要离麦克风太远。</p>
            </div>
            <div className="panel-muted p-4">
              <div className="flex items-center gap-2 text-stellara-white">
                <Sparkles className="h-4 w-4 text-stellara-gold" />
                样本建议
              </div>
              <p className="mt-2">如果主要用于英语口试，样本里最好包含完整英文句子，而不是零散单词。</p>
            </div>
            <div className="panel-muted p-4">
              <div className="flex items-center gap-2 text-stellara-white">
                <Upload className="h-4 w-4 text-stellara-gold" />
                文件大小
              </div>
              <p className="mt-2">页面会先做基础校验，但真实时长仍以录音内容为准，过短样本可能被供应商拒绝。</p>
            </div>
          </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
