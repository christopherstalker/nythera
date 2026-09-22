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
  moderationStatus: "APPROVED",
  likes: index * 3,
  ratingAverage: 4.5,
  updatedAt: "2026-09-11T12:00:00Z",
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
  name: "Storykeeper",
  email: "fixture@example.test",
  role: "USER",
  ageVerified: true,
  bio: "Collecting quiet moments and unlikely adventures.",
  accentColor: "#A9795A",
  profileSettings: {}
};
const appearances = new Map();
let connected = false;
let replyNumber = 0;
const appAppearances = new Map();
let personaProfiles = [
  {
    id: "fixture-persona",
    label: "The night wanderer",
    displayName: "Alex",
    surname: "Vale",
    avatarUrl: "",
    appearance:
      "Dark curls, grey-green eyes and a weathered coat. Ink stains their fingers. Their voice is soft, with a hint of the coast.",
    summary:
      "Quiet at first, quick with dry humor once comfortable. They listen closely and rarely make promises they cannot keep.",
    background: "Grew up beside a lighthouse.",
    traits: ["Observant", "Slow to trust"],
    likes: ["Rain"],
    dislikes: ["Being rushed"],
    boundaries: ["Use they/them pronouns"],
    isDefault: true,
    visibility: "PRIVATE"
  }
];
let maxOutputTokens = null;

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
    if (/^\/api\/characters\/fixture-character-\d+\/test-scene$/.test(url.pathname)) {
      replyNumber++;
      response.end(
        JSON.stringify({
          content:
            replyNumber % 2
              ? "Elena turns the brass compass over in her hand. “There’s a bridge upstream. We can take our time.” She leaves the choice with you, studying the path that follows the bank."
              : "“The water can wait.” Elena closes her fingers around the compass you gave her. “I know a crossing where we won’t have to leave dry ground.” She gestures toward the lanterns upstream and waits.",
          model: "Connected model",
          characterUpdatedAt: "2026-09-11T12:00:00Z",
          generatedAt: new Date().toISOString()
        })
      );
      return;
    }
    switch (url.pathname) {
      case "/api/chats/fixture-chat-0/context":
        payload = {
          messageId: "fixture-message-0",
          trace: {
            version: 1,
            createdAt: "2026-09-11T12:30:00Z",
            estimatedTokens: 6840,
            tokenBudget: 14360,
            droppedMessages: 2,
            semanticEnabled: true,
            entries: [
              {
                kind: "memory",
                text: "Elena is carrying the brass compass you gave her.",
                included: true,
                reason: "Pinned fact included in this request"
              },
              {
                kind: "memory",
                text: "You prefer a quiet route away from deep water.",
                included: true,
                reason: "Retrieved and included in this request"
              },
              {
                kind: "lore",
                text: "The archive closes at midnight. Its north entrance stays unlocked for the night keeper.",
                included: true,
                reason: "Activated lore · archive, midnight"
              },
              {
                kind: "lore",
                text: "The forest observatory is a day’s walk from the city.",
                included: false,
                reason: "No keyword match, selection limit, or text transformed during assembly"
              }
            ]
          }
        };
        break;
      case "/api/keys":
        if (request.method === "PATCH") {
          let body = "";
          for await (const chunk of request) body += chunk;
          maxOutputTokens = JSON.parse(body).maxOutputTokens;
        }
        if (request.method === "POST") connected = true;
        payload =
          request.method === "POST"
            ? {
                key: {
                  id: "fixture-key",
                  provider: "openai",
                  displayName: "OpenAI",
                  defaultModel: "gpt-4o-mini",
                  credentialStatus: "VALID"
                }
              }
            : {
                keys: connected
                  ? [
                      {
                        id: "fixture-key",
                        provider: "openai",
                        displayName: "OpenAI",
                        defaultModel: "gpt-4o-mini",
                        credentialStatus: "VALID"
                      }
                    ]
                  : [],
                maxOutputTokens: null
              };
        break;
      case "/api/keys/models":
        payload = { providers: connected ? [{ provider: "openai", models: ["gpt-4o-mini"], source: "live" }] : [] };
        break;
      case "/api/user-persona": {
        let activeProfileId = personaProfiles[0]?.id;
        if (request.method === "PUT") {
          let body = "";
          for await (const chunk of request) body += chunk;
          const changes = JSON.parse(body);
          const existing = personaProfiles.find((persona) => persona.id === changes.profileId);
          const saved = {
            ...changes,
            id: existing?.id || `fixture-persona-${personaProfiles.length + 1}`,
            isDefault: existing?.isDefault ?? false
          };
          personaProfiles = existing
            ? personaProfiles.map((persona) => (persona.id === saved.id ? saved : persona))
            : [...personaProfiles, saved];
          activeProfileId = saved.id;
        }
        payload = {
          profiles: personaProfiles,
          activeProfileId,
          activeProfile: personaProfiles.find((persona) => persona.id === activeProfileId),
          defaultProfileId: personaProfiles.find((persona) => persona.isDefault)?.id ?? null
        };
        break;
      }
      case "/api/settings/theme": {
        const userId = scenario.userId || "fixture-user";
        if (request.method === "PATCH") {
          let body = "";
          for await (const chunk of request) body += chunk;
          appAppearances.set(userId, JSON.parse(body).appearance);
        }
        payload = { appearance: appAppearances.get(userId) ?? null };
        break;
      }
      case "/api/settings/appearance": {
        let scope = url.searchParams.get("chatId") || "defaults";
        if (request.method === "PATCH") {
          let body = "";
          for await (const chunk of request) body += chunk;
          const changes = JSON.parse(body);
          scope = changes.chatId || "defaults";
          appearances.set(scope, changes.appearance);
        }
        const selectedChat = chats.find((chat) => chat.id === scope);
        payload = {
          appearance: appearances.get(scope) || null,
          story: selectedChat
            ? { id: selectedChat.id, title: selectedChat.title, character: selectedChat.character.name }
            : null
        };
        break;
      }
      case "/api/auth/session":
        payload = {
          user: {
            id: scenario.userId || "fixture-user",
            name: profile.name || profile.username,
            username: profile.username,
            email: "fixture@example.test",
            role: "USER"
          },
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
