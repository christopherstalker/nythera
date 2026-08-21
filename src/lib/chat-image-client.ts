import { CHAT_IMAGE_TYPES, MAX_CHAT_IMAGE_BYTES, type ChatImageType } from "@/lib/chat-attachments";

const MAX_IMAGE_EDGE = 1400;
const IMAGE_LOAD_TIMEOUT_MS = 15_000;
const CANVAS_ENCODE_TIMEOUT_MS = 15_000;

export async function prepareChatImage(file: File) {
  if (file.type && !file.type.startsWith("image/")) {
    throw new Error("Choose an image file.");
  }

  const image = await loadImage(file);
  try {
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    if (scale === 1 && CHAT_IMAGE_TYPES.includes(file.type as ChatImageType) && file.size <= MAX_CHAT_IMAGE_BYTES) {
      return { file, width, height };
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser cannot prepare the image.");

    context.drawImage(image, 0, 0, width, height);
    const blob = await compressCanvas(canvas);
    if (blob.size > MAX_CHAT_IMAGE_BYTES) {
      throw new Error("The image is still too large after compression.");
    }

    const name = `${file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "image"}.jpg`;
    return { file: new File([blob], name, { type: "image/jpeg" satisfies ChatImageType }), width, height };
  } finally {
    URL.revokeObjectURL(image.src);
  }
}

async function loadImage(file: File) {
  const url = URL.createObjectURL(file);
  const image = new Image();
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const timeout = window.setTimeout(() => fail("That image took too long to load."), IMAGE_LOAD_TIMEOUT_MS);

    function fail(message: string) {
      window.clearTimeout(timeout);
      URL.revokeObjectURL(url);
      reject(new Error(message));
    }

    image.onload = () => {
      window.clearTimeout(timeout);
      resolve(image);
    };
    image.onerror = () => fail("That image could not be read.");
    image.src = url;
  });
}

async function compressCanvas(canvas: HTMLCanvasElement) {
  for (const quality of [0.86, 0.72, 0.58]) {
    const blob = await canvasToBlob(canvas, quality);
    if (blob && blob.size <= MAX_CHAT_IMAGE_BYTES) return blob;
  }
  const blob = await canvasToBlob(canvas, 0.48);
  if (!blob) throw new Error("That image could not be prepared.");
  return blob;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error("That image took too long to prepare.")),
      CANVAS_ENCODE_TIMEOUT_MS
    );
    canvas.toBlob((blob) => {
      window.clearTimeout(timeout);
      resolve(blob);
    }, "image/jpeg", quality);
  });
}
