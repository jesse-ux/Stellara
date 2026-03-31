"use client";

import { useEffect, useRef, useState } from "react";
import { Download, ExternalLink, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatDuration } from "@/lib/utils";

interface AudioPlayerProps {
  src: string;
  showExternalLink?: boolean;
  showDownloadButton?: boolean;
  autoPlay?: boolean;
  className?: string;
}

export function AudioPlayer({
  src,
  showExternalLink = true,
  showDownloadButton = true,
  autoPlay = false,
  className,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("play", handlePlay);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("play", handlePlay);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    audio.load();

    if (!autoPlay) return;

    void audio.play().catch(() => {
      setIsPlaying(false);
    });
  }, [autoPlay, src]);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      await audio.play();
      return;
    }

    audio.pause();
  };

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextTime = Number(event.target.value);
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  return (
    <div className={cn("panel-muted p-4", className)}>
      <audio ref={audioRef} preload="metadata" src={src} />

      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={isPlaying ? "暂停音频" : "播放音频"}
          onClick={() => {
            void togglePlayback();
          }}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stellara-white text-stellara-dark transition-colors hover:bg-stellara-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stellara-gold/70 focus-visible:ring-offset-2 focus-visible:ring-offset-stellara-dark"
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center justify-between text-xs font-medium tabular-nums text-stellara-gray-6">
            <span>{formatDuration(currentTime)}</span>
            <span>{formatDuration(duration)}</span>
          </div>
          <input
            aria-label="音频播放进度"
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-stellara-gray-3 accent-stellara-gold"
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(currentTime, duration || 0)}
            onChange={handleSeek}
          />
        </div>

        <div className="flex items-center gap-1">
          {showDownloadButton && (
            <a href={src} download>
              <Button variant="ghost" size="icon" aria-label="下载音频">
                <Download className="h-4 w-4" />
              </Button>
            </a>
          )}

          {showExternalLink && (
            <a href={src} target="_blank" rel="noreferrer">
              <Button variant="ghost" size="icon" aria-label="打开音频链接">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
