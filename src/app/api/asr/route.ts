import { NextResponse } from "next/server";
import { validateAsrAudio } from "@/lib/asr";
import { recognizeSpeechFromAudio } from "@/lib/google-speech";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("audio");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "请先录音" }, { status: 400 });
  }

  const validationError = validateAsrAudio(file);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const result = await recognizeSpeechFromAudio(file);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "语音识别失败，请稍后重试",
      },
      { status: 400 }
    );
  }
}
