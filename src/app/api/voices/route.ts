import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { cloneVoice, getErrorMessage, MiniMaxError, uploadFile } from "@/lib/minimax";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_PREVIEW_TEXT,
  sanitizeVoiceName,
  validateVoiceSample,
} from "@/lib/voice";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("sample") as File | null;
  const rawName = String(formData.get("name") ?? "");

  if (!file) {
    return NextResponse.json({ error: "请上传声音样本" }, { status: 400 });
  }

  const validationError = validateVoiceSample(file);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const name = sanitizeVoiceName(rawName) || "我的音色";
  const minimaxVoiceId = `voice_${user.id.slice(0, 8)}_${uuidv4().replace(/-/g, "").slice(0, 12)}`;

  try {
    const sampleFileId = await uploadFile(file, "voice_clone");
    console.log("[/api/voices] sample uploaded", {
      userId: user.id,
      sampleFileId,
      fileName: file.name,
      fileSize: file.size,
    });

    const cloneResult = await cloneVoice({
      fileId: sampleFileId,
      voiceId: minimaxVoiceId,
      previewText: DEFAULT_PREVIEW_TEXT,
    });
    console.log("[/api/voices] clone succeeded", {
      userId: user.id,
      minimaxVoiceId,
      hasDemoAudio: Boolean(cloneResult.demoAudioUrl),
    });

    const { data, error } = await supabase
      .from("voices")
      .insert({
        user_id: user.id,
        name,
        minimax_voice_id: minimaxVoiceId,
        status: "active",
        preview_url: cloneResult.demoAudioUrl ?? null,
        last_used_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("[/api/voices] database insert failed", {
        userId: user.id,
        minimaxVoiceId,
        error,
      });
      return NextResponse.json(
        { error: `音色已克隆成功，但保存失败：${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ voice: data });
  } catch (error) {
    if (error instanceof MiniMaxError) {
      console.error("[/api/voices] MiniMaxError", {
        code: error.code,
        message: error.message,
      });
      return NextResponse.json(
        { error: getErrorMessage(error.code), code: error.code },
        { status: 400 }
      );
    }

    console.error("[/api/voices] Unexpected error", error);
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development"
            ? `创建音色失败：${error instanceof Error ? error.message : String(error)}`
            : "创建音色失败，请稍后重试",
      },
      { status: 500 }
    );
  }
}
