export type OklchColor = {
  lightness: number;
  chroma: number;
  hue: number;
};

export function hexToOklch(hexColor: string): OklchColor {
  if (!/^#[0-9a-fA-F]{6}$/.test(hexColor)) {
    throw new TypeError(`Expected a six-digit hex color, received ${JSON.stringify(hexColor)}`);
  }

  const red = toLinearSrgb(Number.parseInt(hexColor.slice(1, 3), 16));
  const green = toLinearSrgb(Number.parseInt(hexColor.slice(3, 5), 16));
  const blue = toLinearSrgb(Number.parseInt(hexColor.slice(5, 7), 16));

  const l = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue);
  const m = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue);
  const s = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue);

  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const b = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const chroma = Math.sqrt(a ** 2 + b ** 2);
  const hue = chroma < 0.000001 ? 0 : (Math.atan2(b, a) * 180 / Math.PI + 360) % 360;

  return { lightness, chroma, hue };
}

export function formatOklchChannels({ lightness, chroma, hue }: OklchColor) {
  return `${lightness.toFixed(6)} ${chroma.toFixed(6)} ${hue.toFixed(3)}`;
}

function toLinearSrgb(channel: number) {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}
