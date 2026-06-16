import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Platform, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";

const SITE_URL =
  process.env.EXPO_PUBLIC_SITE_URL ??
  process.env.EXPO_PUBLIC_API_URL ??
  "https://nythera-christopherstalkers-projects.vercel.app";

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }

    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!canGoBack) {
        return false;
      }

      webViewRef.current?.goBack();
      return true;
    });

    return () => subscription.remove();
  }, [canGoBack]);

  return (
    <SafeAreaView style={styles.shell}>
      <StatusBar style="auto" />
      <View style={styles.container}>
        {loadingProgress > 0 && loadingProgress < 1 ? (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.max(8, loadingProgress * 100)}%` }]} />
          </View>
        ) : null}

        <WebView
          ref={webViewRef}
          source={{ uri: SITE_URL }}
          style={styles.webView}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          allowsBackForwardNavigationGestures
          setSupportMultipleWindows={false}
          originWhitelist={["https://*", "http://*"]}
          onLoadStart={() => setLoadError(null)}
          onLoadProgress={(event) => setLoadingProgress(event.nativeEvent.progress)}
          onLoadEnd={() => setLoadingProgress(1)}
          onNavigationStateChange={(navigation) => setCanGoBack(navigation.canGoBack)}
          onError={(event) => setLoadError(event.nativeEvent.description || "Nythera could not load.")}
          onHttpError={(event) => setLoadError(`Nythera returned HTTP ${event.nativeEvent.statusCode}.`)}
          renderLoading={() => (
            <View style={styles.loading}>
              <ActivityIndicator color="#9b59b6" />
            </View>
          )}
          startInLoadingState
        />

        {loadError ? (
          <View style={styles.errorOverlay}>
            <Text style={styles.errorTitle}>Connection problem</Text>
            <Text style={styles.errorText}>{loadError}</Text>
            <Pressable
              accessibilityRole="button"
              style={styles.reloadButton}
              onPress={() => {
                setLoadError(null);
                webViewRef.current?.reload();
              }}
            >
              <Text style={styles.reloadText}>Reload</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: "#0d0d0d"
  },
  container: {
    flex: 1,
    backgroundColor: "#0d0d0d"
  },
  webView: {
    flex: 1,
    backgroundColor: "#0d0d0d"
  },
  progressTrack: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.08)"
  },
  progressFill: {
    height: 3,
    borderRadius: 999,
    backgroundColor: "#9b59b6"
  },
  loading: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0d0d0d"
  },
  errorOverlay: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 28,
    gap: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "#1a1a1a",
    padding: 16
  },
  errorTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700"
  },
  errorText: {
    color: "#b9b9b9",
    fontSize: 13,
    lineHeight: 19
  },
  reloadButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#9b59b6",
    paddingHorizontal: 16,
    paddingVertical: 9
  },
  reloadText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700"
  }
});
