import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { createClient, getServiceClient } from "@/lib/supabase/server";
import { getErrorMessage, MiniMaxError, textToSpeech } from "@/lib/minimax";
import { buildGeneratedAudioPath, GENERATED_AUDIO_BUCKET } from "@/lib/storage";
import { validateGenerationText } from "@/lib/voice";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = (await request.json()) as { voiceId?: string; text?: string };
  const voiceId = body.voiceId?.trim();
  const text = body.text ?? "";
  const textValidationError = validateGenerationText(text);

  if (!voiceId) {
    return NextResponse.json({ error: "请选择音色" }, { status: 400 });
  }

  if (textValidationError) {
    return NextResponse.json({ error: textValidationError }, { status: 400 });
  }

  const { data: voice, error: voiceError } = await supabase
    .from("voices")
    .select("id, name, minimax_voice_id, status")
    .eq("id", voiceId)
    .eq("user_id", user.id)
    .single();

  if (voiceError || !voice) {
    return NextResponse.json({ error: "音色不存在" }, { status: 404 });
  }

  if (voice.status !== "active" && voice.status !== "expiring") {
    return NextResponse.json({ error: "当前音色不可用于生成" }, { status: 400 });
  }

  const taskId = uuidv4();

  const { error: insertError } = await supabase.from("generation_tasks").insert({
    id: taskId,
    user_id: user.id,
    voice_id: voice.id,
    text: text.trim(),
    status: "processing",
  });

  if (insertError) {
    return NextResponse.json({ error: `创建任务失败：${insertError.message}` }, { status: 500 });
  }

  try {
    const result = await textToSpeech({
      voiceId: voice.minimax_voice_id,
      text: text.trim(),
    });

    const storageClient = await getServiceClient();
    const audioResponse = await fetch(result.audioUrl, {
      signal: AbortSignal.timeout(60000),
    });

    if (!audioResponse.ok) {
      throw new Error(`下载生成音频失败：${audioResponse.status}`);
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const storagePath = buildGeneratedAudioPath(user.id, taskId);
    const contentType = audioResponse.headers.get("content-type") || "audio/mpeg";

    const { error: uploadError } = await storageClient.storage
      .from(GENERATED_AUDIO_BUCKET)
      .upload(storagePath, audioBuffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`保存生成音频失败：${uploadError.message}`);
    }

    const { data: signedUrlData, error: signedUrlError } = await storageClient.storage
      .from(GENERATED_AUDIO_BUCKET)
      .createSignedUrl(storagePath, 60 * 60 * 24);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      throw new Error(signedUrlError?.message || "生成播放链接失败");
    }

    const completedAt = new Date().toISOString();

    await supabase
      .from("generation_tasks")
      .update({
        status: "completed",
        temp_audio_url: result.audioUrl,
        storage_audio_url: storagePath,
        completed_at: completedAt,
      })
      .eq("id", taskId);

    await supabase
      .from("voices")
      .update({
        last_used_at: completedAt,
        status: voice.status === "expired" ? "active" : voice.status,
      })
      .eq("id", voice.id);

    return NextResponse.json({
      task: {
        id: taskId,
        voice_name: voice.name,
        audio_url: signedUrlData.signedUrl,
        created_at: completedAt,
      },
    });
  } catch (error) {
    const code = error instanceof MiniMaxError ? error.code : undefined;
    const message =
      error instanceof MiniMaxError
        ? getErrorMessage(error.code)
        : "音频生成失败，请稍后重试";

    await supabase
      .from("generation_tasks")
      .update({
        status: "failed",
        error_code: code ?? null,
        error_message: message,
        completed_at: new Date().toISOString(),
      })
      .eq("id", taskId);

    return NextResponse.json({ error: message, code }, { status: 400 });
  }
}
