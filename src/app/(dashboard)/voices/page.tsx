"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Mic, AlertTriangle, Clock, XCircle, Volume2 } from "lucide-react";
import Link from "next/link";
import { cn, daysUntilExpiry, formatDate } from "@/lib/utils";
import { withDerivedVoiceStatus } from "@/lib/voice-status";
import { toast } from "@/components/ui/use-toast";
import type { Voice } from "@/types";

const statusConfig = {
  cloning: { label: "克隆中", color: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: Clock },
  active: { label: "活跃", color: "bg-green-500/10 text-green-400 border-green-500/20", icon: Mic },
  expiring: { label: "即将过期", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", icon: AlertTriangle },
  expired: { label: "已过期", color: "bg-red-500/10 text-red-400 border-red-500/20", icon: XCircle },
};

export default function VoicesPage() {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(true);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    loadVoices();
  }, []);

  const loadVoices = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("voices")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setVoices((data as Voice[]).map(withDerivedVoiceStatus));
    setLoading(false);
  };

  const handlePreview = (voice: Voice) => {
    if (!voice.preview_url) {
      toast({
        title: "没有可用预览",
        description: "当前音色还没有生成试听音频。",
        variant: "destructive",
      });
      return;
    }

    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current.currentTime = 0;
    }

    const audio = new Audio(voice.preview_url);
    activeAudioRef.current = audio;

    void audio.play().catch(() => {
      toast({
        title: "无法自动播放",
        description: "浏览器阻止了自动播放，请稍后重试。",
      });
    });
  };

  return (
    <div className="space-y-8">
      <div className="page-header">
        <div>
          <h1 className="page-title">我的音色</h1>
          <p className="page-subtitle mt-1">查看当前可用音色，直接试听预览，并关注有效期状态。</p>
        </div>
        <Link href="/voices/new">
          <Button>
            <PlusCircle className="w-4 h-4 mr-2" />
            克隆新音色
          </Button>
        </Link>
      </div>

      {/* Voice list */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-5">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 shrink-0 rounded-2xl bg-stellara-gray-3" />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="h-6 w-32 rounded bg-stellara-gray-3" />
                        <div className="mt-2 h-4 w-52 rounded bg-stellara-gray-3" />
                      </div>
                      <div className="h-6 w-16 rounded-full bg-stellara-gray-3" />
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {[1, 2, 3].map((panel) => (
                        <div key={panel} className="panel-muted p-3">
                          <div className="h-3 w-16 rounded bg-stellara-gray-3" />
                          <div className="mt-2 h-4 w-20 rounded bg-stellara-gray-3" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-1">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="h-4 w-44 rounded bg-stellara-gray-3" />
                  <div className="h-9 w-28 rounded-xl bg-stellara-gray-3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : voices.length === 0 ? (
        <Card className="text-center">
          <Mic className="w-12 h-12 text-stellara-gray-5 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-stellara-white mb-2">还没有克隆音色</h3>
          <p className="text-stellara-gray-6 mb-6">上传一段你的声音，开始克隆你的第一个音色</p>
          <Link href="/voices/new">
            <Button>
              <PlusCircle className="w-4 h-4 mr-2" />
              克隆新音色
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {voices.map((rawVoice) => {
            const voice = withDerivedVoiceStatus(rawVoice);
            const config = statusConfig[voice.status];
            const StatusIcon = config.icon;
            const daysLeft = voice.last_used_at ? daysUntilExpiry(voice.last_used_at) : null;
            return (
              <Card key={voice.id} className="glass-hover">
                <CardHeader className="pb-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-stellara-white/5 text-stellara-gold">
                      <StatusIcon className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <CardTitle className="truncate text-lg">{voice.name}</CardTitle>
                          <p className="mt-1 text-sm text-stellara-gray-6">
                            个人音色资产，可直接用于英语口试与朗读生成。
                          </p>
                        </div>
                        <Badge className={cn("shrink-0 text-xs border", config.color)}>
                          {config.label}
                        </Badge>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                        <div className="panel-muted p-3">
                          <div className="text-xs uppercase tracking-[0.18em] text-stellara-gray-6">
                            创建时间
                          </div>
                          <div className="mt-1 text-sm text-stellara-white">
                            {formatDate(voice.created_at)}
                          </div>
                        </div>
                        <div className="panel-muted p-3">
                          <div className="text-xs uppercase tracking-[0.18em] text-stellara-gray-6">
                            有效状态
                          </div>
                          <div className="mt-1 text-sm text-stellara-white">{config.label}</div>
                        </div>
                        <div className="panel-muted p-3 col-span-2 sm:col-span-1">
                          <div className="text-xs uppercase tracking-[0.18em] text-stellara-gray-6">
                            剩余时间
                          </div>
                          <div className={cn("mt-1 text-sm", daysLeft !== null && daysLeft <= 1 ? "text-red-400" : "text-stellara-white")}>
                            {daysLeft !== null && voice.status !== "cloning" ? `${daysLeft} 天` : "处理中"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-1">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm text-stellara-gray-6">
                      {voice.preview_url ? "试听可用于快速确认音色质量。" : "当前没有可用的试听音频。"}
                    </div>
                    <Button
                      variant={voice.preview_url ? "outline" : "ghost"}
                      size="sm"
                      className="shrink-0"
                      onClick={() => handlePreview(voice)}
                      disabled={!voice.preview_url}
                    >
                      <Volume2 className="w-4 h-4 mr-2" />
                      试听预览
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
