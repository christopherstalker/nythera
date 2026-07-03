const MAX_DIMENSION = 512;
const MAX_DATA_URL_LENGTH = 2_000_000;
const MAX_UPLOAD_BYTES = 6_000_000;
const IMAGE_EXT_PATTERN = /\.(jpe?g|png|webp|gif|heic|heif)$/i;

function isImageFile(file: File) {
  if (file.type.startsWith("image/")) {
    return true;
  }

  return IMAGE_EXT_PATTERN.test(file.name);
}

function fitSize(width: number, height: number, max: number) {
  if (width <= max && height <= max) {
    return { width, height };
  }

  const scale = max / Math.max(width, height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

async function hasAllowedImageSignature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));

  const png = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const webp = bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
  const gif = bytes.length >= 6 && ascii(0, 4) === "GIF8" && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61;
  const heic = bytes.length >= 12 && ascii(4, 8) === "ftyp" && ["heic", "heix", "hevc", "hevx", "heif", "mif1"].includes(ascii(8, 12));

  return png || jpeg || webp || gif || heic;
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read image. Try JPG or PNG."));
    image.src = url;
  });
}

type DecodedImage = {
  width: number;
  height: number;
  draw: (context: CanvasRenderingContext2D, width: number, height: number) => void;
  cleanup: () => void;
};

async function decodeImageFile(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap !== "undefined") {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (context, width, height) => {
          context.drawImage(bitmap, 0, 0, width, height);
        },
        cleanup: () => {
          bitmap.close();
        }
      };
    } catch {}
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      draw: (context, width, height) => {
        context.drawImage(image, 0, 0, width, height);
      },
      cleanup: () => {
        URL.revokeObjectURL(objectUrl);
      }
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

export async function compressImageFile(file: File): Promise<string> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Image must be smaller than 6MB.");
  }

  if (!isImageFile(file)) {
    throw new Error("Choose an image file.");
  }

  if (!(await hasAllowedImageSignature(file))) {
    throw new Error("Choose a valid JPG, PNG, WEBP, GIF, or HEIC image.");
  }

  const decoded = await decodeImageFile(file);

  try {
    const { width, height } = fitSize(decoded.width, decoded.height, MAX_DIMENSION);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not process image.");
    }

    decoded.draw(context, width, height);

    let quality = 0.88;
    let dataUrl = canvas.toDataURL("image/jpeg", quality);

    while (dataUrl.length > MAX_DATA_URL_LENGTH && quality > 0.45) {
      quality -= 0.08;
      dataUrl = canvas.toDataURL("image/jpeg", quality);
    }

    if (dataUrl.length > 2_100_000) {
      throw new Error("Image is still too large. Try a smaller photo.");
    }

    return dataUrl;
  } finally {
    decoded.cleanup();
  }
}
