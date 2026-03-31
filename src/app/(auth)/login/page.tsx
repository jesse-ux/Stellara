"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/brand-logo";
import { toast } from "@/components/ui/use-toast";
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
    <div className="relative h-[100dvh] overflow-hidden px-4 py-4 sm:py-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute left-1/2 top-[10vh] h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-stellara-gold/10 blur-[150px]" />
      </div>

      <div className="relative z-10 mx-auto h-full w-full max-w-5xl">
        <div className="absolute inset-x-0 top-[8vh] bottom-[22vh] flex items-center justify-center text-center">
          <BrandLogo
            priority
            className="mx-auto w-full max-w-[700px] justify-center sm:max-w-[860px]"
            imageClassName="drop-shadow-[0_26px_60px_rgba(216,179,106,0.24)]"
          />
        </div>

        <div className="absolute bottom-4 left-1/2 w-full max-w-md -translate-x-1/2 rounded-[28px] border border-stellara-gray-3/80 bg-stellara-gray-1/62 px-6 py-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:bottom-6 sm:px-8 sm:py-8">
          <form onSubmit={handleSubmit} className="space-y-5">
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
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="mt-1 w-full" disabled={loading}>
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
