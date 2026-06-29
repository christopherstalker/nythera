"use client";

import { useEffect, useRef } from "react";

const vertexShaderSource = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const fragmentShaderSource = `
precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;

float field(vec2 p) {
  vec2 q = p;
  q.x += sin(p.y * 2.4 + u_time * 0.08) * 0.16;
  q.y += cos(p.x * 2.1 - u_time * 0.07) * 0.12;
  float ridge = 0.0;
  ridge += 0.40 / (0.22 + abs(q.y + sin(q.x * 1.7 + u_time * 0.11) * 0.22));
  ridge += 0.25 / (0.30 + abs(q.y - cos(q.x * 1.2 - u_time * 0.09) * 0.34));
  return ridge;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
  float v = field(p);
  vec3 ink = vec3(0.018, 0.016, 0.030);
  vec3 violet = vec3(0.42, 0.28, 0.82);
  vec3 teal = vec3(0.15, 0.72, 0.76);
  vec3 rose = vec3(0.86, 0.28, 0.48);
  float vignette = smoothstep(0.95, 0.12, distance(uv, vec2(0.5)));
  vec3 color = ink;
  color += violet * smoothstep(0.55, 2.7, v) * 0.18;
  color += teal * smoothstep(0.85, 3.4, v + sin(p.x * 2.0) * 0.18) * 0.12;
  color += rose * smoothstep(1.15, 3.8, v + cos(p.y * 1.7) * 0.14) * 0.08;
  color *= 0.68 + vignette * 0.42;
  gl_FragColor = vec4(color, 1.0);
}
`;

export function AuroraWebglBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const gl = canvas?.getContext("webgl", {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true
    });

    if (!canvas || !gl) {
      return;
    }

    const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
    if (!program) {
      return;
    }

    const positionLocation = gl.getAttribLocation(program, "a_position");
    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
    const timeLocation = gl.getUniformLocation(program, "u_time");
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

    let frame = 0;
    let start = performance.now();

    const render = () => {
      const width = Math.max(1, Math.floor(canvas.clientWidth * window.devicePixelRatio));
      const height = Math.max(1, Math.floor(canvas.clientHeight * window.devicePixelRatio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }

      gl.useProgram(program);
      gl.enableVertexAttribArray(positionLocation);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      gl.uniform1f(timeLocation, reduceMotion ? 0 : (performance.now() - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      if (!reduceMotion) {
        frame = requestAnimationFrame(render);
      }
    };

    render();
    return () => {
      cancelAnimationFrame(frame);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-nythera-webgl-ambient="true"
      className="pointer-events-none fixed inset-0 -z-20 h-full w-full opacity-90"
    />
  );
}

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) {
    return null;
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertexShader || !fragmentShader) {
    return null;
  }

  const program = gl.createProgram();
  if (!program) {
    return null;
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  return program;
}
