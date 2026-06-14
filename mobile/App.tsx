import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import { useEffect, useMemo, useRef, useState } from "react";
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

const TOKEN_KEY = "velora.mobile.token";
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://velora-ai-character-platform.vercel.app";
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "";
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";
const HAS_GOOGLE_CONFIG = Boolean(GOOGLE_WEB_CLIENT_ID && GOOGLE_ANDROID_CLIENT_ID);

type User = {
  id: string;
  email: string;
  username?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  role?: string | null;
  ageVerified?: boolean;
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
  sequence?: number | null;
};

type Tab = "explore" | "chats" | "chat" | "create" | "settings";
type PasswordAuthMode = "login" | "register";
type CharacterScope = "public" | "mine";
type CharacterVisibility = "PRIVATE" | "PUBLIC" | "UNLISTED";
type RelationshipStyle = "friend" | "romantic" | "mentor" | "rival" | "antagonist";
type InitiativeLevel = "low" | "medium" | "high";
type VerbosityLevel = "concise" | "balanced" | "expressive" | "immersive";
type MessageLength = "short" | "medium" | "long";

type CreateCharacterInput = {
  avatarUrl: string;
  name: string;
  description: string;
  personality: string;
  scenario: string;
  greeting: string;
  tags: string;
  visibility: CharacterVisibility;
  isNSFW: boolean;
  personaRole: string;
  personaTraits: string;
  speakingStyle: string;
  emotionalTone: string;
  relationshipStyle: RelationshipStyle;
  initiativeLevel: InitiativeLevel;
  verbosityLevel: VerbosityLevel;
  motivation: string;
  boundaries: string;
  behavioralRules: string;
  forbiddenBehaviors: string;
  tone: string;
  humor: number;
  romanceLevel: number;
  seriousness: number;
  initiative: number;
  messageLength: MessageLength;
  roleplayIntensity: number;
};

type ProfileUpdateInput = {
  username: string;
  avatarUrl: string;
  bio: string;
  ageVerified: boolean;
};

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

function getGoogleAuthError(error: unknown) {
  const coded = error as { code?: string; message?: string };
  if (coded.code === statusCodes.SIGN_IN_CANCELLED) {
    return "Google sign-in was cancelled.";
  }
  if (coded.code === statusCodes.IN_PROGRESS) {
    return "Google sign-in is already in progress.";
  }
  if (coded.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
    return "Google Play Services is not available or needs an update.";
  }

  return error instanceof Error ? error.message : "Google sign-in failed.";
}

async function pickImageDataUrl() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert("Photo access", "Allow photo access to choose an avatar from your phone.");
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: "images",
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.68,
    base64: true
  });

  if (result.canceled) {
    return null;
  }

  const asset = result.assets[0];
  if (!asset?.base64) {
    Alert.alert("Avatar", "Could not read this image. Try another one.");
    return null;
  }

  const mimeType = asset.mimeType?.startsWith("image/") ? asset.mimeType : "image/jpeg";
  const dataUrl = `data:${mimeType};base64,${asset.base64}`;
  if (dataUrl.length > 2_100_000) {
    Alert.alert("Avatar too large", "Choose or crop a smaller image. Velora accepts avatars under about 1.5MB.");
    return null;
  }

  return dataUrl;
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
  const [characterScope, setCharacterScope] = useState<CharacterScope>("public");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (GOOGLE_WEB_CLIENT_ID) {
      GoogleSignin.configure({
        webClientId: GOOGLE_WEB_CLIENT_ID,
        scopes: ["openid", "profile", "email"],
        offlineAccess: false,
        profileImageSize: 160
      });
    }
    void restoreSession();
  }, []);

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

  async function finishGoogleLogin() {
    setBusy(true);
    setStatus(null);
    try {
      if (!HAS_GOOGLE_CONFIG) {
        throw new Error("Google login is not configured in this APK.");
      }

      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      await GoogleSignin.signOut().catch(() => undefined);
      const google = await GoogleSignin.signIn();
      if (google.type !== "success") {
        setStatus("Google sign-in was cancelled.");
        return;
      }

      const idToken = google.data.idToken;
      if (!idToken) {
        throw new Error("Google did not return an ID token. Check the Web OAuth client id.");
      }

      const body = await api<{ token: string; user: User }>("/api/mobile/auth/google", null, {
        method: "POST",
        body: JSON.stringify({ idToken })
      });
      await tokenStoreSet(body.token);
      setToken(body.token);
      setUser(body.user);
      setTab("explore");
    } catch (error) {
      setStatus(getGoogleAuthError(error));
    } finally {
      setBusy(false);
    }
  }

  async function finishPasswordAuth(input: { mode: PasswordAuthMode; email: string; password: string; username: string }) {
    setBusy(true);
    setStatus(null);
    try {
      const path = input.mode === "login" ? "/api/mobile/auth/login" : "/api/mobile/auth/register";
      const body = await api<{ token: string; user: User }>(path, null, {
        method: "POST",
        body: JSON.stringify({
          email: input.email.trim(),
          password: input.password,
          ...(input.mode === "register" ? { username: input.username.trim() } : {})
        })
      });
      await tokenStoreSet(body.token);
      setToken(body.token);
      setUser(body.user);
      setTab("explore");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Email sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function loadCharacters(nextQuery = query, nextScope = characterScope) {
    try {
      const params = new URLSearchParams();
      if (nextQuery.trim()) {
        params.set("q", nextQuery.trim());
      }
      if (nextScope === "mine") {
        params.set("mine", "true");
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
      setChats(body.chats.map(normalizeChat));
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
      setActiveChat(normalizeChat(body.chat));
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
      setActiveChat(normalizeChat(body.chat));
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

    const requestId = createMobileRequestId();
    const optimistic: Message = {
      id: `local-user-${requestId}`,
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
            requestId
          })
        }
      );
      setActiveChat((current) =>
        current
          ? {
              ...current,
              title: body.chat.title,
              messages: reconcileMessages(current.messages, optimistic.id, body.userMessage, body.assistantMessage)
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

  async function createCharacter(input: CreateCharacterInput) {
    if (!token) {
      return;
    }

    setBusy(true);
    try {
      const tags = splitList(input.tags, 12).map((tag) => tag.slice(0, 32));
      const body = await api<{ character: Character }>("/api/mobile/characters", token, {
        method: "POST",
        body: JSON.stringify({
          name: input.name,
          avatarUrl: input.avatarUrl,
          description: input.description,
          personality: input.personality,
          scenario: input.scenario,
          greeting: input.greeting,
          communicationStyle: {
            tone: input.tone.trim() || undefined,
            humor: input.humor,
            romanceLevel: input.romanceLevel,
            seriousness: input.seriousness,
            initiative: input.initiative,
            messageLength: input.messageLength,
            roleplayIntensity: input.roleplayIntensity
          },
          persona: {
            name: input.name,
            role: input.personaRole.trim() || undefined,
            personalityTraits: splitList(input.personaTraits, 16),
            speakingStyle: input.speakingStyle.trim() || undefined,
            emotionalTone: input.emotionalTone.trim() || undefined,
            initiativeLevel: input.initiativeLevel,
            boundaries: splitList(input.boundaries, 16),
            motivation: input.motivation.trim() || undefined,
            behavioralRules: splitList(input.behavioralRules, 16),
            forbiddenBehaviors: splitList(input.forbiddenBehaviors, 16),
            verbosityLevel: input.verbosityLevel,
            relationshipStyle: input.relationshipStyle
          },
          tags,
          visibility: input.visibility,
          isNSFW: input.isNSFW
        })
      });
      setCharacters((current) => [body.character, ...current]);
      setStatus("Character created.");
      setCharacterScope("mine");
      setTab("explore");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not create character.");
    } finally {
      setBusy(false);
    }
  }

  async function updateProfile(input: ProfileUpdateInput) {
    if (!token) {
      return;
    }

    if (input.username && !/^[a-zA-Z0-9_]{3,24}$/.test(input.username)) {
      Alert.alert("Username", "Username must be 3-24 letters, numbers, or underscores.");
      return;
    }

    setBusy(true);
    try {
      const body = await api<{ user: User }>("/api/mobile/profile", token, {
        method: "PATCH",
        body: JSON.stringify({
          username: input.username.trim(),
          avatarUrl: input.avatarUrl,
          bio: input.bio.trim(),
          ageVerified: input.ageVerified
        })
      });
      setUser(body.user);
      setStatus("Profile saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save profile.");
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
          hasGoogleConfig={HAS_GOOGLE_CONFIG}
          status={status}
          onGoogle={() => void finishGoogleLogin()}
          onPasswordAuth={(input) => void finishPasswordAuth(input)}
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
      return <SettingsScreen user={user} apiUrl={API_URL} busy={busy} onSave={updateProfile} onLogout={logout} />;
    }

    return (
      <ExploreScreen
        characters={characters}
        query={query}
        scope={characterScope}
        busy={busy}
        onQuery={(value) => {
          setQuery(value);
          void loadCharacters(value, characterScope);
        }}
        onScope={(value) => {
          setCharacterScope(value);
          void loadCharacters(query, value);
        }}
        onRefresh={() => loadCharacters()}
        onStartChat={startChat}
      />
    );
  }, [activeChat, booting, busy, characterScope, characters, chats, query, status, tab, token, user]);

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
  hasGoogleConfig,
  status,
  onGoogle,
  onPasswordAuth
}: {
  busy: boolean;
  hasGoogleConfig: boolean;
  status: string | null;
  onGoogle: () => void;
  onPasswordAuth: (input: { mode: PasswordAuthMode; email: string; password: string; username: string }) => void;
}) {
  const [mode, setMode] = useState<PasswordAuthMode>("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  function submitPasswordAuth() {
    const nextEmail = email.trim();
    const nextUsername = username.trim();
    if (!nextEmail.includes("@") || password.length < 8) {
      Alert.alert("Check details", "Use a valid email and a password with at least 8 characters.");
      return;
    }

    if (mode === "register" && !/^[a-zA-Z0-9_]{3,24}$/.test(nextUsername)) {
      Alert.alert("Username", "Username must be 3-24 letters, numbers, or underscores.");
      return;
    }

    onPasswordAuth({ mode, email: nextEmail, password, username: nextUsername });
  }

  return (
    <KeyboardAvoidingView style={styles.authWrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.auth} keyboardShouldPersistTaps="handled">
        <View style={styles.logoMark}>
          <Text style={styles.logoV}>V</Text>
        </View>
        <Text style={styles.heroTitle}>Velora</Text>
        <Text style={styles.heroText}>AI characters with memory, cozy chats, and secure model access.</Text>

        <PrimaryButton label="Continue with Google" disabled={busy || !hasGoogleConfig} onPress={onGoogle} />
        {!hasGoogleConfig ? <Text style={styles.warning}>Google login needs Android and Web OAuth client IDs. Email login works now.</Text> : null}

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.authCard}>
          <View style={styles.authModeRow}>
            <Pressable style={[styles.modePill, mode === "login" && styles.activeModePill]} onPress={() => setMode("login")}>
              <Text style={[styles.modeText, mode === "login" && styles.activeModeText]}>Log in</Text>
            </Pressable>
            <Pressable style={[styles.modePill, mode === "register" && styles.activeModePill]} onPress={() => setMode("register")}>
              <Text style={[styles.modeText, mode === "register" && styles.activeModeText]}>Create</Text>
            </Pressable>
          </View>

          {mode === "register" ? (
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="Username"
              placeholderTextColor="#8d879d"
              autoCapitalize="none"
              style={styles.input}
            />
          ) : null}

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor="#8d879d"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            style={styles.input}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor="#8d879d"
            secureTextEntry
            textContentType={mode === "login" ? "password" : "newPassword"}
            style={styles.input}
          />
          <PrimaryButton label={busy ? "Please wait..." : mode === "login" ? "Log in with email" : "Create account"} disabled={busy} onPress={submitPasswordAuth} />
          <Text style={styles.helperText}>
            {mode === "login" ? "Use the same account you created on the website." : "This creates a normal Velora account without Google Play."}
          </Text>
        </View>

        {status ? <Text style={styles.statusText}>{status}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function AppHeader({ user, status }: { user: User; status: string | null }) {
  const displayName = user.username ?? user.name ?? user.email;
  return (
    <View style={styles.header}>
      <View style={styles.headerIdentity}>
        <View style={styles.headerAvatar}>
          {user.avatarUrl ? <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} /> : <Text style={styles.headerAvatarText}>{displayName.slice(0, 1).toUpperCase()}</Text>}
        </View>
        <View>
          <Text style={styles.brand}>Velora</Text>
          <Text style={styles.muted}>{displayName}</Text>
        </View>
      </View>
      {status ? <Text style={styles.headerStatus}>{status}</Text> : null}
    </View>
  );
}

function ExploreScreen({
  characters,
  query,
  scope,
  busy,
  onQuery,
  onScope,
  onRefresh,
  onStartChat
}: {
  characters: Character[];
  query: string;
  scope: CharacterScope;
  busy: boolean;
  onQuery: (value: string) => void;
  onScope: (value: CharacterScope) => void;
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
          <View style={styles.segmentRow}>
            <SegmentOption label="Public" active={scope === "public"} onPress={() => onScope("public")} />
            <SegmentOption label="Mine" active={scope === "mine"} onPress={() => onScope("mine")} />
          </View>
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          title={scope === "mine" ? "No characters yet" : "No visible characters"}
          description={scope === "mine" ? "Create a persona and it will appear here immediately." : "Create your first private character or wait for public approvals."}
        />
      }
      renderItem={({ item }) => <CharacterCard character={item} onStart={() => onStartChat(item.id)} />}
    />
  );
}

function CharacterCard({ character, onStart }: { character: Character; onStart: () => void }) {
  return (
    <View style={styles.characterCard}>
      <View style={styles.characterAvatarWrap}>
        <Avatar name={character.name} uri={character.avatarUrl} size="lg" />
      </View>
      <Text style={styles.cardTitle}>{character.name}</Text>
      <Text style={styles.muted}>{character.likes} likes</Text>
      <Text style={[styles.bodyText, styles.centerText]}>{character.description}</Text>
      <View style={styles.centerTags}>
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
  const listRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    if (!chat) {
      return;
    }

    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, [chat?.id, chat?.messages.length, busy]);

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
      <View pointerEvents="none" style={styles.chatBackground}>
        {chat.character.avatarUrl ? <Image source={{ uri: chat.character.avatarUrl }} blurRadius={48} resizeMode="cover" style={styles.chatBackgroundImage} /> : null}
        <View style={styles.chatOverlay} />
      </View>
      <View style={styles.chatHeader}>
        <SecondaryButton label="Back" onPress={onBack} />
        <Avatar name={chat.character.name} uri={chat.character.avatarUrl} />
        <View style={styles.chatTitleWrap}>
          <Text style={styles.chatTitle}>{chat.title ?? chat.character.name}</Text>
          <Text style={styles.muted}>Memory-aware conversation</Text>
        </View>
      </View>
      <FlatList
        ref={listRef}
        data={chat.messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messages}
        renderItem={({ item }) => <MessageBubble message={item} character={chat.character} />}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      />
      {busy ? <TypingState /> : null}
      <View style={styles.composer}>
        <View style={styles.composerShell}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={`Message ${chat.character.name}...`}
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
      </View>
    </KeyboardAvoidingView>
  );
}

function MessageBubble({ message, character }: { message: Message; character: Character }) {
  const mine = message.role === "USER";
  return (
    <View style={[styles.messageRow, mine && styles.messageRowMine]}>
      {!mine ? <Avatar name={character.name} uri={character.avatarUrl} size="sm" /> : null}
      <View style={[styles.bubble, mine ? styles.userBubble : styles.characterBubble]}>
        <Text style={styles.bubbleLabel}>{mine ? "You" : character.name}</Text>
        <Text style={styles.bubbleText}>{message.content}</Text>
      </View>
    </View>
  );
}

function CreateScreen({ busy, onCreate }: { busy: boolean; onCreate: (input: CreateCharacterInput) => void }) {
  const steps: Array<{ id: "basics" | "persona" | "style" | "settings"; label: string }> = [
    { id: "basics", label: "Basics" },
    { id: "persona", label: "Persona" },
    { id: "style", label: "Style" },
    { id: "settings", label: "Settings" }
  ];
  const [activeStep, setActiveStep] = useState<(typeof steps)[number]["id"]>("basics");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [personality, setPersonality] = useState("");
  const [scenario, setScenario] = useState("");
  const [greeting, setGreeting] = useState("");
  const [tags, setTags] = useState("");
  const [visibility, setVisibility] = useState<CharacterVisibility>("PRIVATE");
  const [isNSFW, setIsNSFW] = useState(false);
  const [personaRole, setPersonaRole] = useState("");
  const [personaTraits, setPersonaTraits] = useState("");
  const [speakingStyle, setSpeakingStyle] = useState("");
  const [emotionalTone, setEmotionalTone] = useState("");
  const [relationshipStyle, setRelationshipStyle] = useState<RelationshipStyle>("friend");
  const [initiativeLevel, setInitiativeLevel] = useState<InitiativeLevel>("medium");
  const [verbosityLevel, setVerbosityLevel] = useState<VerbosityLevel>("balanced");
  const [motivation, setMotivation] = useState("");
  const [boundaries, setBoundaries] = useState("");
  const [behavioralRules, setBehavioralRules] = useState("");
  const [forbiddenBehaviors, setForbiddenBehaviors] = useState("");
  const [tone, setTone] = useState("");
  const [humor, setHumor] = useState(4);
  const [romanceLevel, setRomanceLevel] = useState(0);
  const [seriousness, setSeriousness] = useState(5);
  const [initiative, setInitiative] = useState(6);
  const [messageLength, setMessageLength] = useState<MessageLength>("medium");
  const [roleplayIntensity, setRoleplayIntensity] = useState(6);

  async function pickAvatar() {
    try {
      const dataUrl = await pickImageDataUrl();
      if (dataUrl) {
        setAvatarUrl(dataUrl);
      }
    } catch (error) {
      Alert.alert("Avatar", error instanceof Error ? error.message : "Could not open image picker.");
    }
  }

  function submit() {
    if (name.trim().length < 2 || description.trim().length < 20 || personality.trim().length < 20 || greeting.trim().length < 2) {
      Alert.alert("Missing details", "Add a name, 20+ character description/personality, and greeting.");
      setActiveStep("basics");
      return;
    }

    onCreate({
      avatarUrl,
      name: name.trim(),
      description: description.trim(),
      personality: personality.trim(),
      scenario: scenario.trim(),
      greeting: greeting.trim(),
      tags,
      visibility,
      isNSFW,
      personaRole,
      personaTraits,
      speakingStyle,
      emotionalTone,
      relationshipStyle,
      initiativeLevel,
      verbosityLevel,
      motivation,
      boundaries,
      behavioralRules,
      forbiddenBehaviors,
      tone,
      humor,
      romanceLevel,
      seriousness,
      initiative,
      messageLength,
      roleplayIntensity
    });
  }

  function nextStep() {
    const index = steps.findIndex((step) => step.id === activeStep);
    const next = steps[index + 1];
    if (next) {
      setActiveStep(next.id);
      return;
    }

    submit();
  }

  function previousStep() {
    const index = steps.findIndex((step) => step.id === activeStep);
    const previous = steps[index - 1];
    if (previous) {
      setActiveStep(previous.id);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.listContent}>
      <ScreenIntro title="Create character" description="Build a persona with avatar, greeting, memory-ready identity, style rules, and visibility settings." />

      <View style={styles.segmentRow}>
        {steps.map((step) => (
          <SegmentOption key={step.id} label={step.label} active={activeStep === step.id} onPress={() => setActiveStep(step.id)} />
        ))}
      </View>

      <CreatePreview avatarUrl={avatarUrl} name={name} description={description} tags={tags} visibility={visibility} isNSFW={isNSFW} />

      {activeStep === "basics" ? (
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Basics</Text>
          <Text style={styles.muted}>Give the character a face, a clear hook, and an opening scene.</Text>
          <Pressable style={styles.avatarPicker} onPress={pickAvatar}>
            <View style={styles.avatarPickerImage}>
              {avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase() || "V"}</Text>}
            </View>
            <View style={styles.cardTitleWrap}>
              <Text style={styles.cardTitle}>{avatarUrl ? "Change avatar" : "Choose avatar"}</Text>
              <Text style={styles.muted}>Pick and crop an image from your phone.</Text>
            </View>
          </Pressable>
          <FieldLabel label="Name" hint="2-80 characters" />
          <TextInput value={name} onChangeText={setName} placeholder="Alya Nightbloom" placeholderTextColor="#8d879d" style={styles.input} />
          <FieldLabel label="Short description" hint="Shown on cards and profile previews" />
          <TextInput value={description} onChangeText={setDescription} placeholder="A gentle moonlit archivist who remembers impossible stories." placeholderTextColor="#8d879d" style={styles.textarea} multiline />
          <FieldLabel label="Personality" hint="Core behavior, values, flaws, and emotional texture" />
          <TextInput value={personality} onChangeText={setPersonality} placeholder="Warm, observant, curious, protective..." placeholderTextColor="#8d879d" style={styles.textarea} multiline />
          <FieldLabel label="Scenario" hint="Optional starting world or relationship context" />
          <TextInput value={scenario} onChangeText={setScenario} placeholder="The user arrives at a hidden library during a violet storm." placeholderTextColor="#8d879d" style={styles.textarea} multiline />
          <FieldLabel label="Greeting" hint="First message the user sees" />
          <TextInput value={greeting} onChangeText={setGreeting} placeholder="The brass bell above the door trembles before you touch it..." placeholderTextColor="#8d879d" style={styles.textarea} multiline />
          <FieldLabel label="Tags" hint="Comma-separated, up to 12" />
          <TextInput value={tags} onChangeText={setTags} placeholder="fantasy, mentor, cozy, lore" placeholderTextColor="#8d879d" style={styles.input} />
        </View>
      ) : null}

      {activeStep === "persona" ? (
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Persona engine</Text>
          <Text style={styles.muted}>These fields help the LLM keep the character stable across long chats.</Text>
          <FieldLabel label="Role or archetype" hint="Who they are in the story" />
          <TextInput value={personaRole} onChangeText={setPersonaRole} placeholder="Runaway princess, sarcastic rival, patient mentor..." placeholderTextColor="#8d879d" style={styles.input} />
          <FieldLabel label="Personality traits" hint="Comma-separated traits" />
          <TextInput value={personaTraits} onChangeText={setPersonaTraits} placeholder="patient, brave, guarded, poetic" placeholderTextColor="#8d879d" style={styles.input} />
          <FieldLabel label="Speaking style" hint="How the character writes and talks" />
          <TextInput value={speakingStyle} onChangeText={setSpeakingStyle} placeholder="Speaks softly, asks vivid questions, avoids modern slang." placeholderTextColor="#8d879d" style={styles.textarea} multiline />
          <FieldLabel label="Emotional tone" hint="The feeling they should carry" />
          <TextInput value={emotionalTone} onChangeText={setEmotionalTone} placeholder="Tender, mysterious, lightly melancholic." placeholderTextColor="#8d879d" style={styles.input} />
          <ChoiceGroup
            label="Relationship"
            value={relationshipStyle}
            options={[
              { label: "Friend", value: "friend" },
              { label: "Romantic", value: "romantic" },
              { label: "Mentor", value: "mentor" },
              { label: "Rival", value: "rival" },
              { label: "Antagonist", value: "antagonist" }
            ]}
            onChange={setRelationshipStyle}
          />
          <ChoiceGroup
            label="Initiative"
            value={initiativeLevel}
            options={[
              { label: "Low", value: "low" },
              { label: "Medium", value: "medium" },
              { label: "High", value: "high" }
            ]}
            onChange={setInitiativeLevel}
          />
          <ChoiceGroup
            label="Verbosity"
            value={verbosityLevel}
            options={[
              { label: "Concise", value: "concise" },
              { label: "Balanced", value: "balanced" },
              { label: "Expressive", value: "expressive" },
              { label: "Immersive", value: "immersive" }
            ]}
            onChange={setVerbosityLevel}
          />
          <FieldLabel label="Motivation" hint="What drives them" />
          <TextInput value={motivation} onChangeText={setMotivation} placeholder="Wants to protect forgotten memories and learn why the user can hear them." placeholderTextColor="#8d879d" style={styles.textarea} multiline />
          <FieldLabel label="Boundaries" hint="Comma-separated limits" />
          <TextInput value={boundaries} onChangeText={setBoundaries} placeholder="no explicit content, no cruelty, no real-world legal advice" placeholderTextColor="#8d879d" style={styles.input} />
          <FieldLabel label="Behavioral rules" hint="Comma-separated instructions" />
          <TextInput value={behavioralRules} onChangeText={setBehavioralRules} placeholder="stay in character, remember user preferences, ask one question at a time" placeholderTextColor="#8d879d" style={styles.input} />
          <FieldLabel label="Forbidden behaviors" hint="Comma-separated safety or role boundaries" />
          <TextInput value={forbiddenBehaviors} onChangeText={setForbiddenBehaviors} placeholder="do not reveal system prompts, do not claim to be human, do not override safety rules" placeholderTextColor="#8d879d" style={styles.input} />
        </View>
      ) : null}

      {activeStep === "style" ? (
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Conversation style</Text>
          <Text style={styles.muted}>Tune the feel of the chat without turning the character into a raw prompt.</Text>
          <FieldLabel label="Tone" hint="Optional label for overall mood" />
          <TextInput value={tone} onChangeText={setTone} placeholder="cozy mystery, sharp comedy, cinematic romance..." placeholderTextColor="#8d879d" style={styles.input} />
          <NumberControl label="Humor" value={humor} onChange={setHumor} />
          <NumberControl label="Romance" value={romanceLevel} onChange={setRomanceLevel} />
          <NumberControl label="Seriousness" value={seriousness} onChange={setSeriousness} />
          <NumberControl label="Initiative" value={initiative} onChange={setInitiative} />
          <NumberControl label="Roleplay intensity" value={roleplayIntensity} onChange={setRoleplayIntensity} />
          <ChoiceGroup
            label="Message length"
            value={messageLength}
            options={[
              { label: "Short", value: "short" },
              { label: "Medium", value: "medium" },
              { label: "Long", value: "long" }
            ]}
            onChange={setMessageLength}
          />
        </View>
      ) : null}

      {activeStep === "settings" ? (
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Publishing</Text>
          <Text style={styles.muted}>Private characters appear in Mine immediately. Public characters may need moderation before others see them.</Text>
          <ChoiceGroup
            label="Visibility"
            value={visibility}
            options={[
              { label: "Private", value: "PRIVATE" },
              { label: "Unlisted", value: "UNLISTED" },
              { label: "Public", value: "PUBLIC" }
            ]}
            onChange={setVisibility}
          />
          <ToggleRow title="Mature themes" description="Mark this if the character is intended for adult or sensitive themes." value={isNSFW} onToggle={() => setIsNSFW((current) => !current)} />
        </View>
      ) : null}

      <View style={styles.createActions}>
        <SecondaryButton label={activeStep === "basics" ? "Clear avatar" : "Previous"} onPress={activeStep === "basics" ? () => setAvatarUrl("") : previousStep} />
        <PrimaryButton label={busy ? "Creating..." : activeStep === "settings" ? "Create character" : "Next"} disabled={busy} onPress={nextStep} />
      </View>
    </ScrollView>
  );
}

function normalizeChat(chat: Chat): Chat {
  return {
    ...chat,
    messages: orderMessages(chat.messages ?? [])
  };
}

function reconcileMessages(messages: Message[], optimisticId: string, userMessage: Message, assistantMessage: Message) {
  const next: Message[] = [];
  let replacedOptimistic = false;

  for (const message of messages) {
    if (message.id === optimisticId) {
      next.push(userMessage);
      replacedOptimistic = true;
      continue;
    }

    if (message.id !== userMessage.id && message.id !== assistantMessage.id) {
      next.push(message);
    }
  }

  if (!replacedOptimistic) {
    next.push(userMessage);
  }

  next.push(assistantMessage);
  return orderMessages(next);
}

function orderMessages(messages: Message[]) {
  if (!messages.some((message) => typeof message.sequence === "number")) {
    return messages;
  }

  return [...messages].sort((first, second) => {
    const sequenceDelta = (first.sequence ?? Number.MAX_SAFE_INTEGER) - (second.sequence ?? Number.MAX_SAFE_INTEGER);
    if (sequenceDelta !== 0) {
      return sequenceDelta;
    }

    const timeDelta = new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime();
    if (timeDelta !== 0) {
      return timeDelta;
    }

    return first.id.localeCompare(second.id);
  });
}

function createMobileRequestId() {
  return `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function splitList(value: string, max: number) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, max);
}

function SegmentOption({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.segmentPill, active && styles.segmentPillActive]} onPress={onPress}>
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <View style={styles.fieldLabelRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

function ChoiceGroup<T extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: T;
  options: Array<{ label: string; value: T }>;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.choiceGroup}>
      <FieldLabel label={label} />
      <View style={styles.choiceWrap}>
        {options.map((option) => (
          <Pressable key={option.value} style={[styles.choicePill, value === option.value && styles.choicePillActive]} onPress={() => onChange(option.value)}>
            <Text style={[styles.choiceText, value === option.value && styles.choiceTextActive]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function NumberControl({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  function update(delta: number) {
    onChange(Math.max(0, Math.min(10, value + delta)));
  }

  return (
    <View style={styles.numberControl}>
      <View style={styles.cardTitleWrap}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.muted}>Scale from 0 to 10</Text>
      </View>
      <View style={styles.numberStepper}>
        <Pressable style={styles.numberButton} onPress={() => update(-1)}>
          <Text style={styles.numberButtonText}>-</Text>
        </Pressable>
        <Text style={styles.numberValue}>{value}</Text>
        <Pressable style={styles.numberButton} onPress={() => update(1)}>
          <Text style={styles.numberButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ToggleRow({
  title,
  description,
  value,
  onToggle
}: {
  title: string;
  description: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable style={styles.toggleRow} onPress={onToggle}>
      <View style={styles.cardTitleWrap}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.muted}>{description}</Text>
      </View>
      <View style={[styles.toggleTrack, value && styles.toggleTrackOn]}>
        <View style={[styles.toggleDot, value && styles.toggleDotOn]} />
      </View>
    </Pressable>
  );
}

function CreatePreview({
  avatarUrl,
  name,
  description,
  tags,
  visibility,
  isNSFW
}: {
  avatarUrl: string;
  name: string;
  description: string;
  tags: string;
  visibility: CharacterVisibility;
  isNSFW: boolean;
}) {
  const previewTags = splitList(tags, 4);
  const displayName = name.trim() || "New character";

  return (
    <View style={styles.previewCard}>
      <View style={styles.previewGlow} />
      <View style={styles.cardTop}>
        <View style={styles.previewAvatar}>
          {avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{displayName.slice(0, 1).toUpperCase()}</Text>}
        </View>
        <View style={styles.cardTitleWrap}>
          <Text style={styles.cardTitle}>{displayName}</Text>
          <Text style={styles.muted}>{visibility.toLowerCase()} preview</Text>
        </View>
      </View>
      <Text style={styles.bodyText}>{description.trim() || "Your character card preview will update as you write."}</Text>
      <View style={styles.tags}>
        {previewTags.map((tag) => (
          <Text key={tag} style={styles.tag}>
            {tag}
          </Text>
        ))}
        {isNSFW ? <Text style={styles.warningTag}>mature</Text> : null}
      </View>
    </View>
  );
}

function SettingsScreen({
  user,
  apiUrl,
  busy,
  onSave,
  onLogout
}: {
  user: User;
  apiUrl: string;
  busy: boolean;
  onSave: (input: ProfileUpdateInput) => void;
  onLogout: () => void;
}) {
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? "");
  const [username, setUsername] = useState(user.username ?? "");
  const [bio, setBio] = useState(user.bio ?? "");
  const [ageVerified, setAgeVerified] = useState(user.ageVerified ?? false);
  const displayName = username.trim() || user.name || user.email;

  useEffect(() => {
    setAvatarUrl(user.avatarUrl ?? "");
    setUsername(user.username ?? "");
    setBio(user.bio ?? "");
    setAgeVerified(user.ageVerified ?? false);
  }, [user.id, user.avatarUrl, user.username, user.bio, user.ageVerified]);

  async function pickProfileAvatar() {
    try {
      const dataUrl = await pickImageDataUrl();
      if (dataUrl) {
        setAvatarUrl(dataUrl);
      }
    } catch (error) {
      Alert.alert("Avatar", error instanceof Error ? error.message : "Could not open image picker.");
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.listContent}>
      <ScreenIntro title="Profile" description="Your account avatar and identity are shared between the website and Android app." />
      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Account identity</Text>
        <Text style={styles.muted}>{user.email}</Text>
        <Pressable style={styles.avatarPicker} onPress={pickProfileAvatar}>
          <View style={styles.avatarPickerImage}>
            {avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{displayName.slice(0, 1).toUpperCase()}</Text>}
          </View>
          <View style={styles.cardTitleWrap}>
            <Text style={styles.cardTitle}>{avatarUrl ? "Change profile avatar" : "Choose profile avatar"}</Text>
            <Text style={styles.muted}>Pick and crop an image from your phone.</Text>
          </View>
        </Pressable>
        <FieldLabel label="Username" hint="3-24 letters, numbers, or underscores" />
        <TextInput value={username} onChangeText={setUsername} placeholder="username" placeholderTextColor="#8d879d" autoCapitalize="none" style={styles.input} />
        <FieldLabel label="Bio" hint="Optional profile note" />
        <TextInput value={bio} onChangeText={setBio} placeholder="A short note about you" placeholderTextColor="#8d879d" style={styles.textarea} multiline />
        <ToggleRow
          title="Age-gated settings"
          description="Confirm this account can access mature-content controls where allowed."
          value={ageVerified}
          onToggle={() => setAgeVerified((current) => !current)}
        />
        <View style={styles.createActions}>
          {avatarUrl ? <SecondaryButton label="Clear avatar" onPress={() => setAvatarUrl("")} /> : null}
          <PrimaryButton label={busy ? "Saving..." : "Save profile"} disabled={busy} onPress={() => onSave({ username, avatarUrl, bio, ageVerified })} />
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>App connection</Text>
        <Text style={styles.bodyText}>{apiUrl}</Text>
        <Text style={styles.bodyText}>Package: ai.velora.app</Text>
        <Text style={styles.bodyText}>Scheme: velora</Text>
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

function Avatar({ name, uri, size = "md" }: { name: string; uri?: string | null; size?: "sm" | "md" | "lg" }) {
  return (
    <View style={[styles.avatar, size === "sm" && styles.avatarSmall, size === "lg" && styles.avatarLarge]}>
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
    backgroundColor: "#07060B"
  },
  shell: {
    flex: 1,
    backgroundColor: "#07060B"
  },
  auth: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
    gap: 18
  },
  authWrap: {
    flex: 1,
    backgroundColor: "#07060B"
  },
  authCard: {
    borderRadius: 30,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.045)",
    backgroundColor: "#111019",
    gap: 12
  },
  authModeRow: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
    gap: 4
  },
  modePill: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center"
  },
  activeModePill: {
    backgroundColor: "rgba(167,139,250,0.2)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.24)"
  },
  modeText: {
    color: "#9B94AA",
    fontWeight: "700"
  },
  activeModeText: {
    color: "#F8F7FF"
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)"
  },
  dividerText: {
    color: "#8d879d",
    fontWeight: "700"
  },
  helperText: {
    color: "#9B94AA",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center"
  },
  logoMark: {
    height: 76,
    width: 76,
    borderRadius: 38,
    backgroundColor: "#14111D",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.24)",
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  headerIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1
  },
  headerAvatar: {
    height: 42,
    width: 42,
    borderRadius: 21,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(167,139,250,0.12)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.25)"
  },
  headerAvatarText: {
    color: "#D9D1FF",
    fontSize: 16,
    fontWeight: "800"
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
    padding: 20,
    paddingBottom: 118,
    gap: 18
  },
  heroCard: {
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.028)",
    backgroundColor: "#111019",
    gap: 16
  },
  segmentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  segmentPill: {
    minHeight: 40,
    borderRadius: 999,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.038)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.045)"
  },
  segmentPillActive: {
    backgroundColor: "rgba(167,139,250,0.16)",
    borderColor: "rgba(167,139,250,0.22)"
  },
  segmentText: {
    color: "#9B94AA",
    fontWeight: "800",
    fontSize: 13
  },
  segmentTextActive: {
    color: "#F8F7FF"
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
    borderRadius: 30,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.028)",
    backgroundColor: "#111019",
    gap: 14
  },
  characterCard: {
    borderRadius: 30,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.028)",
    backgroundColor: "#111019",
    gap: 12,
    alignItems: "center"
  },
  characterAvatarWrap: {
    height: 108,
    width: 108,
    borderRadius: 54,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(167,139,250,0.075)"
  },
  formSection: {
    borderRadius: 30,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.028)",
    backgroundColor: "#111019",
    gap: 16
  },
  sectionTitle: {
    color: "#F8F7FF",
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800"
  },
  avatarPicker: {
    minHeight: 96,
    borderRadius: 24,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(167,139,250,0.075)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.14)"
  },
  avatarPickerImage: {
    height: 72,
    width: 72,
    borderRadius: 24,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(167,139,250,0.14)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.28)"
  },
  previewCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 30,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.12)",
    backgroundColor: "#12101A",
    gap: 12
  },
  previewGlow: {
    position: "absolute",
    right: -44,
    top: -44,
    height: 150,
    width: 150,
    borderRadius: 75,
    backgroundColor: "rgba(167,139,250,0.12)"
  },
  previewAvatar: {
    height: 70,
    width: 70,
    borderRadius: 28,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(167,139,250,0.14)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.28)"
  },
  warningTag: {
    color: "#FFD6E8",
    backgroundColor: "rgba(240,176,207,0.12)",
    borderColor: "rgba(240,176,207,0.2)",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 12
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
  avatarSmall: {
    height: 40,
    width: 40,
    borderRadius: 20
  },
  avatarLarge: {
    height: 88,
    width: 88,
    borderRadius: 44
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
  centerTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8
  },
  centerText: {
    textAlign: "center"
  },
  tag: {
    color: "#D9D1FF",
    backgroundColor: "rgba(167,139,250,0.12)",
    borderColor: "rgba(167,139,250,0.12)",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 12
  },
  fieldLabelRow: {
    gap: 3
  },
  fieldLabel: {
    color: "#F8F7FF",
    fontSize: 14,
    fontWeight: "800"
  },
  fieldHint: {
    color: "#8d879d",
    fontSize: 12,
    lineHeight: 18
  },
  choiceGroup: {
    gap: 8
  },
  choiceWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  choicePill: {
    minHeight: 38,
    borderRadius: 999,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.038)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.045)"
  },
  choicePillActive: {
    backgroundColor: "rgba(167,139,250,0.16)",
    borderColor: "rgba(167,139,250,0.32)"
  },
  choiceText: {
    color: "#9B94AA",
    fontWeight: "700",
    fontSize: 13
  },
  choiceTextActive: {
    color: "#F8F7FF"
  },
  numberControl: {
    minHeight: 72,
    borderRadius: 22,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.035)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)"
  },
  numberStepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  numberButton: {
    height: 38,
    width: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(167,139,250,0.14)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.22)"
  },
  numberButtonText: {
    color: "#F8F7FF",
    fontSize: 20,
    fontWeight: "800"
  },
  numberValue: {
    minWidth: 22,
    textAlign: "center",
    color: "#F8F7FF",
    fontSize: 18,
    fontWeight: "800"
  },
  toggleRow: {
    minHeight: 88,
    borderRadius: 22,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.035)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)"
  },
  toggleTrack: {
    height: 34,
    width: 58,
    borderRadius: 17,
    padding: 4,
    backgroundColor: "rgba(255,255,255,0.09)"
  },
  toggleTrackOn: {
    backgroundColor: "rgba(167,139,250,0.28)"
  },
  toggleDot: {
    height: 26,
    width: 26,
    borderRadius: 13,
    backgroundColor: "#C9C2D8"
  },
  toggleDotOn: {
    transform: [{ translateX: 24 }],
    backgroundColor: "#F8F7FF"
  },
  input: {
    minHeight: 50,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#F8F7FF",
    backgroundColor: "rgba(255,255,255,0.038)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
    fontSize: 16
  },
  textarea: {
    minHeight: 108,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#F8F7FF",
    backgroundColor: "rgba(255,255,255,0.038)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
    textAlignVertical: "top",
    fontSize: 16
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 999,
    backgroundColor: "#9B7CFF",
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
    borderColor: "rgba(255,255,255,0.065)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    backgroundColor: "rgba(255,255,255,0.035)"
  },
  secondaryButtonText: {
    color: "#F8F7FF",
    fontWeight: "700"
  },
  createActions: {
    gap: 10
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
    backgroundColor: "rgba(17,16,25,0.94)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.035)",
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
    backgroundColor: "rgba(167,139,250,0.16)"
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
    flex: 1,
    backgroundColor: "#07060B"
  },
  chatBackground: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden"
  },
  chatBackgroundImage: {
    position: "absolute",
    top: -60,
    left: -60,
    right: -60,
    bottom: -60,
    opacity: 0.12
  },
  chatOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(7,6,11,0.88)"
  },
  chatHeader: {
    marginHorizontal: 14,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 30,
    backgroundColor: "rgba(17,16,25,0.74)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.03)",
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  chatTitleWrap: {
    flex: 1,
    minWidth: 0
  },
  chatTitle: {
    color: "#F8F7FF",
    fontSize: 18,
    fontWeight: "800"
  },
  messages: {
    padding: 18,
    paddingBottom: 28,
    gap: 14
  },
  messageRow: {
    maxWidth: "92%",
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10
  },
  messageRowMine: {
    alignSelf: "flex-end",
    justifyContent: "flex-end"
  },
  bubble: {
    maxWidth: "100%",
    borderRadius: 24,
    paddingHorizontal: 15,
    paddingVertical: 12
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(167,139,250,0.18)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.12)"
  },
  characterBubble: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.035)"
  },
  bubbleLabel: {
    color: "#AFA6C4",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4
  },
  bubbleText: {
    color: "#F8F7FF",
    fontSize: 15,
    lineHeight: 23
  },
  composer: {
    padding: 14,
    paddingBottom: 96,
    gap: 10
  },
  composerShell: {
    borderRadius: 30,
    padding: 8,
    gap: 10,
    backgroundColor: "rgba(17,16,25,0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.035)"
  },
  composerInput: {
    maxHeight: 120,
    borderWidth: 0,
    backgroundColor: "rgba(255,255,255,0.025)"
  },
  typing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingBottom: 8
  }
});
