import { StatusBar } from "expo-status-bar";
import * as Google from "expo-auth-session/providers/google";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

WebBrowser.maybeCompleteAuthSession();

const TOKEN_KEY = "velora.mobile.token";
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://velora-ai-character-platform.vercel.app";
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "";
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";
const HAS_GOOGLE_CONFIG = Platform.select({
  android: Boolean(GOOGLE_ANDROID_CLIENT_ID),
  web: Boolean(GOOGLE_WEB_CLIENT_ID),
  default: Boolean(GOOGLE_ANDROID_CLIENT_ID || GOOGLE_WEB_CLIENT_ID)
});

type User = {
  id: string;
  email: string;
  username?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
};

type Character = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  description: string;
  personality: string;
  scenario?: string | null;
  greeting: string;
  tags: string[];
  likes: number;
  ratingAverage: number;
};

type Chat = {
  id: string;
  title?: string | null;
  character: Character;
  messages: Message[];
  lastActiveAt?: string;
};

type Message = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  createdAt: string;
};

type Tab = "explore" | "chats" | "chat" | "create" | "settings";

async function tokenStoreGet() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function tokenStoreSet(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

async function tokenStoreClear() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function api<T>(path: string, token?: string | null, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {})
    }
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error ?? `Request failed: ${response.status}`);
  }

  return body as T;
}

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("explore");
  const [characters, setCharacters] = useState<Character[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: GOOGLE_ANDROID_CLIENT_ID || "missing-google-android-client-id.apps.googleusercontent.com",
    webClientId: GOOGLE_WEB_CLIENT_ID || "missing-google-web-client-id.apps.googleusercontent.com",
    scopes: ["openid", "profile", "email"],
    selectAccount: true
  });

  useEffect(() => {
    void restoreSession();
  }, []);

  useEffect(() => {
    if (response?.type === "success") {
      const idToken = response.params.id_token || response.authentication?.idToken;
      if (idToken) {
        void finishGoogleLogin(idToken);
      } else {
        setStatus("Google did not return an ID token. Check Android OAuth client setup.");
      }
    }
  }, [response]);

  useEffect(() => {
    if (token) {
      void loadCharacters();
      void loadChats();
    }
  }, [token]);

  async function restoreSession() {
    try {
      const saved = await tokenStoreGet();
      if (!saved) {
        return;
      }

      const body = await api<{ user: User }>("/api/mobile/me", saved);
      setToken(saved);
      setUser(body.user);
    } catch {
      await tokenStoreClear();
    } finally {
      setBooting(false);
    }
  }

  async function finishGoogleLogin(idToken: string) {
    setBusy(true);
    setStatus(null);
    try {
      const body = await api<{ token: string; user: User }>("/api/mobile/auth/google", null, {
        method: "POST",
        body: JSON.stringify({ idToken })
      });
      await tokenStoreSet(body.token);
      setToken(body.token);
      setUser(body.user);
      setTab("explore");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Google sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function loadCharacters(nextQuery = query) {
    try {
      const params = new URLSearchParams();
      if (nextQuery.trim()) {
        params.set("q", nextQuery.trim());
      }
      params.set("take", "50");
      const body = await api<{ characters: Character[] }>(`/api/mobile/characters?${params.toString()}`, token);
      setCharacters(body.characters);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load characters.");
    }
  }

  async function loadChats() {
    if (!token) {
      return;
    }

    try {
      const body = await api<{ chats: Chat[] }>("/api/mobile/chats", token);
      setChats(body.chats);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load chats.");
    }
  }

  async function startChat(characterId: string) {
    if (!token) {
      return;
    }

    setBusy(true);
    try {
      const body = await api<{ chat: Chat }>("/api/mobile/chats", token, {
        method: "POST",
        body: JSON.stringify({ characterId })
      });
      setActiveChat(body.chat);
      setTab("chat");
      await loadChats();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not start chat.");
    } finally {
      setBusy(false);
    }
  }

  async function openChat(chatId: string) {
    if (!token) {
      return;
    }

    setBusy(true);
    try {
      const body = await api<{ chat: Chat }>(`/api/mobile/chats/${chatId}`, token);
      setActiveChat(body.chat);
      setTab("chat");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not open chat.");
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(content: string) {
    if (!token || !activeChat || !content.trim()) {
      return;
    }

    const optimistic: Message = {
      id: `local-${Date.now()}`,
      role: "USER",
      content: content.trim(),
      createdAt: new Date().toISOString()
    };
    setActiveChat((current) => (current ? { ...current, messages: [...current.messages, optimistic] } : current));
    setBusy(true);
    try {
      const body = await api<{ chat: Pick<Chat, "id" | "title">; userMessage: Message; assistantMessage: Message }>(
        `/api/mobile/chats/${activeChat.id}/message`,
        token,
        {
          method: "POST",
          body: JSON.stringify({
            message: content.trim(),
            requestId: `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}`
          })
        }
      );
      setActiveChat((current) =>
        current
          ? {
              ...current,
              title: body.chat.title,
              messages: [...current.messages.filter((message) => message.id !== optimistic.id), body.userMessage, body.assistantMessage]
            }
          : current
      );
      await loadChats();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not send message.");
      setActiveChat((current) => (current ? { ...current, messages: current.messages.filter((message) => message.id !== optimistic.id) } : current));
    } finally {
      setBusy(false);
    }
  }

  async function createCharacter(input: {
    name: string;
    description: string;
    personality: string;
    scenario: string;
    greeting: string;
    tags: string;
  }) {
    if (!token) {
      return;
    }

    setBusy(true);
    try {
      const tags = input.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 12);
      const body = await api<{ character: Character }>("/api/mobile/characters", token, {
        method: "POST",
        body: JSON.stringify({
          name: input.name,
          description: input.description,
          personality: input.personality,
          scenario: input.scenario,
          greeting: input.greeting,
          tags,
          visibility: "PRIVATE",
          isNSFW: false
        })
      });
      setCharacters((current) => [body.character, ...current]);
      setStatus("Character created.");
      setTab("explore");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not create character.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await tokenStoreClear();
    setToken(null);
    setUser(null);
    setChats([]);
    setActiveChat(null);
  }

  const content = useMemo(() => {
    if (booting) {
      return <LoadingState label="Opening Velora" />;
    }

    if (!token || !user) {
      return (
        <AuthScreen
          busy={busy}
          requestReady={Boolean(request)}
          hasGoogleConfig={HAS_GOOGLE_CONFIG}
          status={status}
          onGoogle={() => void promptAsync()}
        />
      );
    }

    if (tab === "chats") {
      return <ChatsScreen chats={chats} busy={busy} onRefresh={loadChats} onOpen={openChat} />;
    }

    if (tab === "chat") {
      return <ChatScreen chat={activeChat} busy={busy} onBack={() => setTab("chats")} onSend={sendMessage} />;
    }

    if (tab === "create") {
      return <CreateScreen busy={busy} onCreate={createCharacter} />;
    }

    if (tab === "settings") {
      return <SettingsScreen user={user} apiUrl={API_URL} onLogout={logout} />;
    }

    return (
      <ExploreScreen
        characters={characters}
        query={query}
        busy={busy}
        onQuery={(value) => {
          setQuery(value);
          void loadCharacters(value);
        }}
        onRefresh={() => loadCharacters()}
        onStartChat={startChat}
      />
    );
  }, [activeChat, booting, busy, characters, chats, query, request, status, tab, token, user]);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.shell}>
        {token && user ? <AppHeader user={user} status={status} /> : null}
        {content}
        {token && user ? <BottomTabs tab={tab} onChange={setTab} /> : null}
      </View>
    </SafeAreaView>
  );
}

function AuthScreen({
  busy,
  requestReady,
  hasGoogleConfig,
  status,
  onGoogle
}: {
  busy: boolean;
  requestReady: boolean;
  hasGoogleConfig: boolean;
  status: string | null;
  onGoogle: () => void;
}) {
  return (
    <View style={styles.auth}>
      <View style={styles.logoMark}>
        <Text style={styles.logoV}>V</Text>
      </View>
      <Text style={styles.heroTitle}>Velora</Text>
      <Text style={styles.heroText}>AI characters with memory, cozy chats, and secure model access.</Text>
      <PrimaryButton label="Continue with Google" disabled={busy || !requestReady || !hasGoogleConfig} onPress={onGoogle} />
      {!hasGoogleConfig ? (
        <Text style={styles.warning}>Set EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID before building for Google Play.</Text>
      ) : null}
      {status ? <Text style={styles.statusText}>{status}</Text> : null}
    </View>
  );
}

function AppHeader({ user, status }: { user: User; status: string | null }) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.brand}>Velora</Text>
        <Text style={styles.muted}>{user.username ?? user.name ?? user.email}</Text>
      </View>
      {status ? <Text style={styles.headerStatus}>{status}</Text> : null}
    </View>
  );
}

function ExploreScreen({
  characters,
  query,
  busy,
  onQuery,
  onRefresh,
  onStartChat
}: {
  characters: Character[];
  query: string;
  busy: boolean;
  onQuery: (value: string) => void;
  onRefresh: () => void;
  onStartChat: (characterId: string) => void;
}) {
  return (
    <FlatList
      data={characters}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      refreshing={busy}
      onRefresh={onRefresh}
      ListHeaderComponent={
        <View style={styles.heroCard}>
          <Text style={styles.screenTitle}>Find your next character</Text>
          <Text style={styles.bodyText}>Search public personas, start a chat, or create your own private character.</Text>
          <TextInput value={query} onChangeText={onQuery} placeholder="Search mood, genre, or name" placeholderTextColor="#8d879d" style={styles.input} />
        </View>
      }
      ListEmptyComponent={<EmptyState title="No visible characters" description="Create your first private character or wait for public approvals." />}
      renderItem={({ item }) => <CharacterCard character={item} onStart={() => onStartChat(item.id)} />}
    />
  );
}

function CharacterCard({ character, onStart }: { character: Character; onStart: () => void }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Avatar name={character.name} uri={character.avatarUrl} />
        <View style={styles.cardTitleWrap}>
          <Text style={styles.cardTitle}>{character.name}</Text>
          <Text style={styles.muted}>{character.likes} likes</Text>
        </View>
      </View>
      <Text style={styles.bodyText}>{character.description}</Text>
      <View style={styles.tags}>
        {character.tags.slice(0, 4).map((tag) => (
          <Text key={tag} style={styles.tag}>
            {tag}
          </Text>
        ))}
      </View>
      <PrimaryButton label="Start chat" onPress={onStart} />
    </View>
  );
}

function ChatsScreen({ chats, busy, onRefresh, onOpen }: { chats: Chat[]; busy: boolean; onRefresh: () => void; onOpen: (id: string) => void }) {
  return (
    <FlatList
      data={chats}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      refreshing={busy}
      onRefresh={onRefresh}
      ListHeaderComponent={<ScreenIntro title="Continue chatting" description="Pick up where the conversation paused." />}
      ListEmptyComponent={<EmptyState title="No chats yet" description="Start from Explore and your chats will appear here." />}
      renderItem={({ item }) => (
        <Pressable style={styles.card} onPress={() => onOpen(item.id)}>
          <View style={styles.cardTop}>
            <Avatar name={item.character.name} uri={item.character.avatarUrl} />
            <View style={styles.cardTitleWrap}>
              <Text style={styles.cardTitle}>{item.title ?? item.character.name}</Text>
              <Text numberOfLines={2} style={styles.muted}>
                {item.messages?.[0]?.content ?? "Open chat"}
              </Text>
            </View>
          </View>
        </Pressable>
      )}
    />
  );
}

function ChatScreen({ chat, busy, onBack, onSend }: { chat: Chat | null; busy: boolean; onBack: () => void; onSend: (content: string) => void }) {
  const [draft, setDraft] = useState("");

  if (!chat) {
    return (
      <View style={styles.center}>
        <EmptyState title="No chat selected" description="Open a chat from Explore or Chats." />
        <SecondaryButton label="Back to chats" onPress={onBack} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.chatWrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.chatHeader}>
        <SecondaryButton label="Back" onPress={onBack} />
        <Text style={styles.chatTitle}>{chat.title ?? chat.character.name}</Text>
      </View>
      <FlatList
        data={chat.messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messages}
        renderItem={({ item }) => <MessageBubble message={item} />}
      />
      {busy ? <TypingState /> : null}
      <View style={styles.composer}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Message character..."
          placeholderTextColor="#8d879d"
          style={[styles.input, styles.composerInput]}
          multiline
        />
        <PrimaryButton
          label="Send"
          disabled={busy || !draft.trim()}
          onPress={() => {
            const next = draft;
            setDraft("");
            onSend(next);
          }}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const mine = message.role === "USER";
  return (
    <View style={[styles.bubble, mine ? styles.userBubble : styles.characterBubble]}>
      <Text style={styles.bubbleText}>{message.content}</Text>
    </View>
  );
}

function CreateScreen({ busy, onCreate }: { busy: boolean; onCreate: (input: { name: string; description: string; personality: string; scenario: string; greeting: string; tags: string }) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [personality, setPersonality] = useState("");
  const [scenario, setScenario] = useState("");
  const [greeting, setGreeting] = useState("");
  const [tags, setTags] = useState("");

  function submit() {
    if (name.length < 2 || description.length < 20 || personality.length < 20 || greeting.length < 2) {
      Alert.alert("Missing details", "Add a name, 20+ character description/personality, and greeting.");
      return;
    }

    onCreate({ name, description, personality, scenario, greeting, tags });
  }

  return (
    <ScrollView contentContainerStyle={styles.listContent}>
      <ScreenIntro title="Create character" description="Build a private persona with a greeting, scenario, and tags." />
      <TextInput value={name} onChangeText={setName} placeholder="Name" placeholderTextColor="#8d879d" style={styles.input} />
      <TextInput value={description} onChangeText={setDescription} placeholder="Short description" placeholderTextColor="#8d879d" style={styles.textarea} multiline />
      <TextInput value={personality} onChangeText={setPersonality} placeholder="Personality and behavior" placeholderTextColor="#8d879d" style={styles.textarea} multiline />
      <TextInput value={scenario} onChangeText={setScenario} placeholder="Scenario optional" placeholderTextColor="#8d879d" style={styles.textarea} multiline />
      <TextInput value={greeting} onChangeText={setGreeting} placeholder="First greeting message" placeholderTextColor="#8d879d" style={styles.textarea} multiline />
      <TextInput value={tags} onChangeText={setTags} placeholder="Tags separated by commas" placeholderTextColor="#8d879d" style={styles.input} />
      <PrimaryButton label={busy ? "Creating..." : "Create private character"} disabled={busy} onPress={submit} />
    </ScrollView>
  );
}

function SettingsScreen({ user, apiUrl, onLogout }: { user: User; apiUrl: string; onLogout: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.listContent}>
      <ScreenIntro title="Settings" description="Native Android app connected to the Velora production backend." />
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{user.name ?? user.username ?? "Velora user"}</Text>
        <Text style={styles.bodyText}>{user.email}</Text>
        <Text style={styles.muted}>{apiUrl}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Google Play setup</Text>
        <Text style={styles.bodyText}>Package: ai.velora.app</Text>
        <Text style={styles.bodyText}>Scheme: velora</Text>
        <Text style={styles.bodyText}>Build profile: production app-bundle</Text>
      </View>
      <SecondaryButton label="Sign out" onPress={onLogout} />
    </ScrollView>
  );
}

function BottomTabs({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "explore", label: "Explore" },
    { id: "chats", label: "Chats" },
    { id: "create", label: "Create" },
    { id: "settings", label: "Settings" }
  ];

  return (
    <View style={styles.tabs}>
      {tabs.map((item) => (
        <Pressable key={item.id} style={[styles.tab, tab === item.id && styles.activeTab]} onPress={() => onChange(item.id)}>
          <Text style={[styles.tabText, tab === item.id && styles.activeTabText]}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Avatar({ name, uri }: { name: string; uri?: string | null }) {
  return (
    <View style={styles.avatar}>
      {uri ? <Image source={{ uri }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase()}</Text>}
    </View>
  );
}

function ScreenIntro({ title, description }: { title: string; description: string }) {
  return (
    <View style={styles.heroCard}>
      <Text style={styles.screenTitle}>{title}</Text>
      <Text style={styles.bodyText}>{description}</Text>
    </View>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.muted}>{description}</Text>
    </View>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color="#A78BFA" />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

function TypingState() {
  return (
    <View style={styles.typing}>
      <ActivityIndicator color="#A78BFA" size="small" />
      <Text style={styles.muted}>Character is writing...</Text>
    </View>
  );
}

function PrimaryButton({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.primaryButton, disabled && styles.disabled]} disabled={disabled} onPress={onPress}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.secondaryButton} onPress={onPress}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0B0B12"
  },
  shell: {
    flex: 1,
    backgroundColor: "#0B0B12"
  },
  auth: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    gap: 18
  },
  logoMark: {
    height: 76,
    width: 76,
    borderRadius: 26,
    backgroundColor: "#171321",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.32)",
    alignItems: "center",
    justifyContent: "center"
  },
  logoV: {
    color: "#A78BFA",
    fontSize: 36,
    fontWeight: "800"
  },
  heroTitle: {
    color: "#F8F7FF",
    fontSize: 46,
    fontWeight: "800",
    letterSpacing: 0
  },
  heroText: {
    color: "#B9B2C8",
    fontSize: 18,
    lineHeight: 28
  },
  header: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  brand: {
    color: "#F8F7FF",
    fontSize: 22,
    fontWeight: "800"
  },
  muted: {
    color: "#9B94AA",
    fontSize: 13,
    lineHeight: 20
  },
  headerStatus: {
    color: "#F0B0CF",
    flex: 1,
    textAlign: "right",
    fontSize: 12
  },
  listContent: {
    padding: 18,
    paddingBottom: 110,
    gap: 14
  },
  heroCard: {
    borderRadius: 30,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "#171321",
    gap: 14
  },
  screenTitle: {
    color: "#F8F7FF",
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800"
  },
  bodyText: {
    color: "#C9C2D8",
    fontSize: 15,
    lineHeight: 23
  },
  card: {
    borderRadius: 26,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "#121018",
    gap: 12
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  cardTitleWrap: {
    flex: 1,
    gap: 4
  },
  cardTitle: {
    color: "#F8F7FF",
    fontSize: 18,
    fontWeight: "700"
  },
  avatar: {
    height: 54,
    width: 54,
    borderRadius: 27,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(167,139,250,0.12)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.25)"
  },
  avatarImage: {
    height: "100%",
    width: "100%"
  },
  avatarText: {
    color: "#D9D1FF",
    fontSize: 20,
    fontWeight: "800"
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  tag: {
    color: "#D9D1FF",
    backgroundColor: "rgba(167,139,250,0.12)",
    borderColor: "rgba(167,139,250,0.18)",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 12
  },
  input: {
    minHeight: 50,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#F8F7FF",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    fontSize: 16
  },
  textarea: {
    minHeight: 108,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#F8F7FF",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    textAlignVertical: "top",
    fontSize: 16
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 999,
    backgroundColor: "#A78BFA",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 16
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    backgroundColor: "rgba(255,255,255,0.04)"
  },
  secondaryButtonText: {
    color: "#F8F7FF",
    fontWeight: "700"
  },
  disabled: {
    opacity: 0.45
  },
  warning: {
    color: "#F0B0CF",
    lineHeight: 22
  },
  statusText: {
    color: "#C9C2D8",
    lineHeight: 22
  },
  tabs: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 14,
    borderRadius: 30,
    padding: 8,
    flexDirection: "row",
    backgroundColor: "rgba(18,16,24,0.96)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 6
  },
  tab: {
    flex: 1,
    minHeight: 48,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center"
  },
  activeTab: {
    backgroundColor: "rgba(167,139,250,0.18)"
  },
  tabText: {
    color: "#9B94AA",
    fontWeight: "700",
    fontSize: 12
  },
  activeTabText: {
    color: "#F8F7FF"
  },
  empty: {
    alignItems: "center",
    padding: 24,
    gap: 8
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 18
  },
  chatWrap: {
    flex: 1
  },
  chatHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  chatTitle: {
    flex: 1,
    color: "#F8F7FF",
    fontSize: 18,
    fontWeight: "800"
  },
  messages: {
    padding: 16,
    paddingBottom: 20,
    gap: 10
  },
  bubble: {
    maxWidth: "86%",
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 11
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(167,139,250,0.22)"
  },
  characterBubble: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)"
  },
  bubbleText: {
    color: "#F8F7FF",
    fontSize: 15,
    lineHeight: 22
  },
  composer: {
    padding: 14,
    paddingBottom: 96,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    gap: 10
  },
  composerInput: {
    maxHeight: 120
  },
  typing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingBottom: 8
  }
});
