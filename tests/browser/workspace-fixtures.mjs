import { createServer, request as httpRequest } from "node:http";
import { readFile } from "node:fs/promises";

const names = ["Elena Vale", "Rowan Ash", "Mira Sol", "Atlas Reed", "Nova Finch", "Theo Moon", "Iris West"];
const characters = names.map((name, index) => ({
  id: `fixture-character-${index}`,
  name,
  description: [
    "A patient detective following the city's forgotten stories.",
    "A wandering cartographer with a map of impossible places.",
    "A quiet astronomer listening for signals beyond the horizon."
  ][index % 3],
  visibility: index % 2 ? "PRIVATE" : "PUBLIC",
  tags: ["adventure"],
  ratingAvg: 0,
  ratingCount: 0,
  _count: { chats: index + 1 }
}));
const chats = characters.slice(0, 5).map((character, index) => ({
  id: `fixture-chat-${index}`,
  title: [
    "The midnight archive",
    "A map without borders",
    "Signals in the silence",
    "The long way home",
    "An unexpected visitor"
  ][index],
  character,
  chapterNumber: index + 1,
  lastActiveAt: new Date(Date.UTC(2026, 8, 5 - index, 12)).toISOString(),
  updatedAt: new Date(Date.UTC(2026, 8, 5 - index, 12)).toISOString(),
  messages: [
    {
      id: `fixture-message-${index}`,
      role: "ASSISTANT",
      content: "The door opens quietly. A familiar voice breaks the silence: ‘I was hoping you would come back.’",
      createdAt: "2026-09-05T12:00:00Z",
      sequence: 1
    }
  ]
}));
const library = { mine: characters.slice(0, 3), liked: characters.slice(2, 5), chats };
const rooms = [
  {
    id: "fixture-room",
    title: "The observatory",
    messageCount: 24,
    lastActiveAt: "2026-09-05T12:00:00Z",
    characters: characters.slice(0, 3).map((character) => ({ character })),
    messages: [{ content: "There is one constellation missing from the chart.", role: "ASSISTANT" }]
  }
];
let profile = {
  username: "storykeeper",
  email: "fixture@example.test",
  role: "USER",
  ageVerified: true,
  bio: "Collecting quiet moments and unlikely adventures.",
  accentColor: "#A9795A",
  profileSettings: {}
};

createServer(async (request, response) => {
  const url = new URL(request.url, "http://127.0.0.1:3100");
  if (url.pathname.startsWith("/api/")) {
    const scenario = JSON.parse(await readFile("output/workspace-ux/scenario.json", "utf8").catch(() => "{}"));
    response.setHeader("content-type", "application/json");
    response.setHeader("cache-control", "no-store");
    if (scenario.failPath === url.pathname && (!scenario.method || scenario.method === request.method)) {
      response.writeHead(503);
      response.end(JSON.stringify({ error: "Test connection unavailable" }));
      return;
    }
    let payload = {};
    switch (url.pathname) {
      case "/api/auth/session":
        payload = {
          user: { id: "fixture-user", name: "Storykeeper", email: "fixture@example.test", role: "USER" },
          expires: "2050-01-01T00:00:00Z"
        };
        break;
      case "/api/chats":
        payload = { chats };
        break;
      case "/api/chats/recent-characters":
        payload = { chats };
        break;
      case "/api/library":
        payload = library;
        break;
      case "/api/characters":
        payload = { characters };
        break;
      case "/api/rooms":
        payload = request.method === "POST" ? { room: rooms[0] } : { rooms };
        break;
      case "/api/profile":
        if (request.method === "PATCH") {
          let body = "";
          for await (const chunk of request) body += chunk;
          profile = { ...profile, ...JSON.parse(body) };
        }
        payload = { profile };
        break;
      case "/api/keys":
        payload = { keys: [] };
        break;
      case "/api/keys/models":
        payload = { models: {} };
        break;
      case "/api/chats/fixture-chat-0":
        payload = { chat: chats[0] };
        break;
      case "/api/chats/fixture-chat-0/share":
        payload = { url: "/share/fixture-chat-0" };
        break;
      default:
        payload = { personas: [], memories: [], messages: [], scheduledMessages: [], preferences: {} };
    }
    response.end(JSON.stringify(payload));
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405);
    response.end();
    return;
  }
  const headers = { ...request.headers, host: "127.0.0.1:3000" };
  delete headers.cookie;
  delete headers.authorization;
  const upstream = httpRequest(
    { hostname: "127.0.0.1", port: 3000, path: request.url, method: request.method, headers },
    (page) => {
      const pageHeaders = { ...page.headers };
      delete pageHeaders["set-cookie"];
      response.writeHead(page.statusCode, pageHeaders);
      page.pipe(response);
    }
  );
  upstream.on("error", () => {
    response.writeHead(502);
    response.end("Start the local app on port 3000 before running UI fixtures.");
  });
  upstream.end();
}).listen(3100, "127.0.0.1", () =>
  console.log("Isolated UI fixtures: http://127.0.0.1:3100. API calls never reach the application database.")
);
