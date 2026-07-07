export function checkWebGLSupportAndCapability(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) {
    return false;
  }

  const isTabletWidth = window.innerWidth >= 768 && window.innerWidth <= 1024;
  if (isTabletWidth) {
    return false;
  }

  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
  if (!gl) {
    return false;
  }

  const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
  if (debugInfo) {
    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    if (typeof renderer === "string" && /(swiftshader|llvmpipe|software)/i.test(renderer)) {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      return false;
    }
  }

  gl.getExtension("WEBGL_lose_context")?.loseContext();
  return true;
}
