import "dotenv/config";

const proxyUrl = process.env.VALIDATION_PROXY_URL || "http://127.0.0.1:3002/api/proxy/llm";
const token = process.env.INTERNAL_API_TOKEN;

if (!token) {
  console.error(JSON.stringify({ status: "fail", error: "INTERNAL_API_TOKEN is not configured." }, null, 2));
  process.exit(1);
}

const started = Date.now();
const response = await fetch(proxyUrl, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    authorization: `Bearer ${token}`
  },
  body: JSON.stringify({
    messages: [
      {
        role: "system",
        content: "Reply with one short sentence confirming Velora proxy validation. Do not mention secrets."
      },
      {
        role: "user",
        content: "Validate Gemini streaming with a calm one-sentence response."
      }
    ],
    model: "gemini-2.5-flash",
    temperature: 0.2,
    userId: "validation",
    chatId: "validation"
  })
});

if (!response.ok || !response.body) {
  console.error(
    JSON.stringify(
      {
        status: "fail",
        httpStatus: response.status,
        error: await response.text().catch(() => "Proxy request failed.")
      },
      null,
      2
    )
  );
  process.exit(1);
}

const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = "";
let text = "";
let usage = null;

while (true) {
  const { value, done } = await reader.read();
  if (done) {
    break;
  }

  buffer += decoder.decode(value, { stream: true });
  const events = buffer.split("\n\n");
  buffer = events.pop() ?? "";

  for (const event of events) {
    const data = event
      .split("\n")
      .find((line) => line.startsWith("data: "))
      ?.slice(6);

    if (!data) {
      continue;
    }

    const chunk = JSON.parse(data);
    if (chunk.type === "delta") {
      text += chunk.text;
    }
    if (chunk.type === "usage") {
      usage = chunk;
    }
    if (chunk.type === "error") {
      throw new Error(chunk.message);
    }
  }
}

const sane = text.trim().length > 8 && !/AIza|GOCSPX|api[_ -]?key/i.test(text);
console.log(
  JSON.stringify(
    {
      status: sane ? "success" : "fail",
      latencyMs: Date.now() - started,
      usage,
      responsePreview: text.trim().slice(0, 160)
    },
    null,
    2
  )
);

if (!sane) {
  process.exit(1);
}
