import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "Stellara — AI音色复刻",
  description: "上传你的声音，克隆个人音色，生成高质量语音",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="dark">
      <body>{children}</body>
      <Toaster />
    </html>
  );
}
