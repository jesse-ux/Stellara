"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Mic, History, PlusCircle, LogOut, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/voices", label: "我的音色", icon: Mic },
  { href: "/voices/new", label: "克隆音色", icon: PlusCircle },
  { href: "/generate", label: "生成音频", icon: Wand2 },
  { href: "/history", label: "生成历史", icon: History },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-b border-stellara-gray-3/80 bg-stellara-gray-1/35 backdrop-blur-md lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:border-b-0 lg:border-r">
        <div className="flex h-full flex-col">
          <div className="border-b border-stellara-gray-3/80 px-5 py-5 lg:px-6">
            <Link href="/voices" className="flex items-center justify-center">
              <Image
                src="/stellara-logo.png"
                alt="Stellara"
                width={240}
                height={116}
                className="h-auto w-[176px] object-contain lg:w-[188px]"
              />
            </Link>
          </div>

          <nav className="flex-1 px-3 py-4 lg:px-4 lg:py-5">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-colors",
                      isActive
                        ? "border border-stellara-gold/25 bg-stellara-gold/10 text-stellara-white"
                        : "border border-transparent text-stellara-gray-6 hover:bg-stellara-gray-2/60 hover:text-stellara-white"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="mt-auto border-t border-stellara-gray-3/80 p-3 lg:p-4">
            <Button
              variant="ghost"
              className="w-full justify-start text-stellara-gray-6 hover:text-stellara-white"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-3" />
              退出登录
            </Button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="page-shell">{children}</div>
      </main>
    </div>
  );
}
