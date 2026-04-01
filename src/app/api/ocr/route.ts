import { NextResponse } from "next/server";
import { recognizeTextFromImage } from "@/lib/paddle";
import { validateOcrImage } from "@/lib/ocr";
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
  const file = formData.get("image");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "请先拍照或选择图片" }, { status: 400 });
  }

  const validationError = validateOcrImage(file);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const result = await recognizeTextFromImage(file);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "OCR 识别失败，请稍后重试",
      },
      { status: 400 }
    );
  }
}
