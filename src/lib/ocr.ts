export const MAX_OCR_IMAGE_BYTES = 3 * 1024 * 1024;
export const MAX_OCR_IMAGE_DIMENSION = 1600;
export const OCR_ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export function validateOcrImage(file: File) {
  if (!file.type.startsWith("image/")) {
    return "请上传图片文件";
  }

  if (
    file.type &&
    !OCR_ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof OCR_ACCEPTED_IMAGE_TYPES)[number])
  ) {
    return "当前仅支持 JPG、PNG、WEBP 或 HEIC 图片";
  }

  if (file.size > MAX_OCR_IMAGE_BYTES * 2) {
    return "图片过大，请重新拍摄或裁剪后重试";
  }

  return null;
}

export function normalizeOcrText(text: string) {
  return cleanOcrArtifacts(text)
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/([a-z])\n([a-z])/g, "$1 $2")
    .replace(/([a-z])-\n([a-z])/gi, "$1$2")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function cleanOcrArtifacts(text: string) {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>|<\/div>|<\/li>|<\/h\d>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\\underline\{\\text\{([^}]*)\}\}/g, "$1")
    .replace(/\\text\{([^}]*)\}/g, "$1")
    .replace(/\\underline\{([^}]*)\}/g, "$1")
    .replace(/\\[a-zA-Z]+\{([^}]*)\}/g, "$1")
    .replace(/\$([^$]+)\$/g, "$1")
    .replace(/[_*`#~]+/g, "")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/[ \t]+([,.;:!?])/g, "$1");
}
