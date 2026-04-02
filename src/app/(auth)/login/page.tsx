"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/brand-logo";
import { toast } from "@/components/ui/use-toast";
import { LoginSunlit } from "@/components/login-sunlit";
import { Loader2 } from "lucide-react";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const redirect = searchParams.get("redirect") || "/voices";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        toast({ title: "注册失败", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "注册成功", description: "请查收邮箱确认链接" });
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast({ title: "登录失败", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "登录成功", description: "欢迎回来，正在进入控制台。" });
        await new Promise((resolve) => window.setTimeout(resolve, 250));
        router.push(redirect);
      }
    }

    setLoading(false);
  };

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-[#090d18] px-4 py-4 sm:py-6">
      <LoginSunlit />

      <div className="relative z-10 mx-auto flex h-full w-full max-w-[min(96vw,1800px)] flex-col items-center justify-between">
        <div className="flex min-h-0 w-full flex-1 items-center justify-center pt-[1vh] text-center">
          <BrandLogo
            priority
            className="mx-auto w-[min(64vw,630px)] justify-center sm:w-[min(62vw,896px)] lg:w-[min(60vw,1092px)]"
            imageClassName="drop-shadow-[0_28px_72px_rgba(232,201,138,0.25)]"
          />
        </div>

        <div className="login-glass-panel mb-4 w-full max-w-md rounded-[28px] px-6 py-6 sm:mb-6 sm:px-8 sm:py-8">
          <form onSubmit={handleSubmit} className="relative z-10 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                name="email"
                autoComplete="email"
                spellCheck={false}
                placeholder="your@email.com…"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border-white/10 bg-white/6 backdrop-blur-sm focus-visible:ring-stellara-gold/80"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                name="password"
                autoComplete={isSignUp ? "new-password" : "current-password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border-white/10 bg-white/6 backdrop-blur-sm focus-visible:ring-stellara-gold/80"
                required
                minLength={6}
              />
            </div>
            <Button
              type="submit"
              className="mt-1 w-full shadow-[0_10px_30px_rgba(216,179,106,0.24)]"
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSignUp ? "注册" : "登录"}
            </Button>
            <div className="text-center text-sm text-stellara-gray-6">
              <button
                type="button"
                className="text-stellara-gold hover:underline"
                onClick={() => setIsSignUp(!isSignUp)}
              >
                {isSignUp ? "已有账户？登录" : "没有账户？注册"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
