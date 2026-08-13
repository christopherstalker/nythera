import { MAX_CHAT_IMAGE_BYTES, type ChatImageType } from "@/lib/chat-attachments";

const MAX_IMAGE_EDGE = 1400;

export async function prepareChatImage(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file.");
  }

  const image = await loadImage(file);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot prepare the image.");

  context.drawImage(image, 0, 0, width, height);
  const blob = await compressCanvas(canvas);
  URL.revokeObjectURL(image.src);
  if (blob.size > MAX_CHAT_IMAGE_BYTES) {
    throw new Error("The image is still too large after compression.");
  }

  const name = `${file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "image"}.jpg`;
  return { file: new File([blob], name, { type: "image/jpeg" satisfies ChatImageType }), width, height };
}

async function loadImage(file: File) {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
    return image;
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("That image could not be read.");
  }
}

async function compressCanvas(canvas: HTMLCanvasElement) {
  for (const quality of [0.86, 0.72, 0.58]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= MAX_CHAT_IMAGE_BYTES) return blob;
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.48));
  if (!blob) throw new Error("That image could not be prepared.");
  return blob;
}
