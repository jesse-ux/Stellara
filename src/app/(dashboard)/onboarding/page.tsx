import Link from "next/link";
import { ArrowRight, Mic, Sparkles, Wand2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const onboardingSteps = [
  {
    icon: Mic,
    title: "录一段清晰样本",
    description: "准备一段 10 秒以上的英语样本，上传或直接录音都可以。",
  },
  {
    icon: Sparkles,
    title: "创建你的第一个音色",
    description: "系统会根据样本克隆个人音色，并自动生成试听预览。",
  },
  {
    icon: Wand2,
    title: "立即生成第一段音频",
    description: "克隆完成后直接进入生成页，用示例文本先试听效果。",
  },
];

export default function OnboardingPage() {
  return (
    <div className="space-y-8">
      <div className="page-header">
        <div className="max-w-3xl">
          <h1 className="page-title">先完成第一段音频</h1>
          <p className="page-subtitle mt-2">
            Stellara 最快的体验方式不是先管理音色，而是先创建一个可用音色，然后立即试听你的第一段英语口语。
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>首次使用只做三步</CardTitle>
          <CardDescription>
            先跑通一次完整闭环，再决定是否继续补更多样本或生成更长内容。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            {onboardingSteps.map((step, index) => (
              <div key={step.title} className="panel-muted rounded-[24px] p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stellara-gold/12 text-stellara-gold">
                    <step.icon className="h-4 w-4" />
                  </div>
                  <div className="text-xs uppercase tracking-[0.22em] text-stellara-gray-6">
                    Step {index + 1}
                  </div>
                </div>
                <div className="mt-4 text-lg font-medium text-stellara-white">{step.title}</div>
                <p className="mt-2 text-sm leading-6 text-stellara-gray-6">{step.description}</p>
              </div>
            ))}
          </div>

          <div className="panel-muted rounded-[24px] p-5">
            <div className="text-sm text-stellara-gray-6">
              建议先准备一段自然的英文句子，不要背景音乐，不要太靠近麦克风。第一次先用短文本试听，效果确认后再生成长内容。
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/voices/new">
                开始创建第一个音色
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/generate">我已经有音色，直接去生成</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
