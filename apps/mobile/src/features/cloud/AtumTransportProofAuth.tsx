import { decodeRelayJwt } from "@t3tools/shared/relayJwt";
import * as Effect from "effect/Effect";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import { activateCloudRelayAccount, deactivateCloudRelayAccount } from "./cloudAccountService";

const PLATFORM_ORIGIN = "https://api.atumplatform.com";
const SIGN_IN_SOURCE = { uri: `${PLATFORM_ORIGIN}/login` };
const ASSERTION_PATH = "/api/work/connect/assertion";

function isPlatformPage(url: string): boolean {
  try {
    return new URL(url).origin === PLATFORM_ORIGIN;
  } catch {
    return false;
  }
}

function assertionRequestScript(id: number): string {
  return `
    if (window === window.top && location.origin === ${JSON.stringify(PLATFORM_ORIGIN)}) {
      (async () => {
        const post = (response) => window.ReactNativeWebView.postMessage(
          JSON.stringify({ id: ${id}, ...response })
        );
        try {
          const response = await fetch(${JSON.stringify(ASSERTION_PATH)}, {
            method: "POST",
            credentials: "same-origin",
            cache: "no-store",
            redirect: "manual",
          });
          if (!response.ok) {
            post({ unavailable: true });
            return;
          }
          const body = await response.json();
          post({ assertion: typeof body.assertion === "string" ? body.assertion : null });
        } catch {
          post({ unavailable: true });
        }
      })();
    }
    true;
  `;
}

interface PendingAssertion {
  readonly resolve: (assertion: string) => void;
  readonly reject: (error: Error) => void;
}

function assertionUnavailable(): Error {
  return new Error("The Atum web session did not return a fresh Work assertion.");
}

/** W0 fixture. Keep the browser's session in WebKit and request assertions only in its top frame. */
export function AtumTransportProofAuth({ children }: { readonly children: ReactNode }) {
  const browser = useRef<WebView>(null);
  const page = useRef<string | null>(null);
  const currentAccount = useRef<string | null>(null);
  const sequence = useRef(0);
  const [pending] = useState(() => new Map<number, PendingAssertion>());
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    return () => {
      for (const request of pending.values()) request.reject(assertionUnavailable());
      deactivateCloudRelayAccount();
    };
  }, [pending]);

  function requestAssertion(): Promise<string> {
    const view = browser.current;
    if (!view || !page.current || !isPlatformPage(page.current)) {
      return Promise.reject(assertionUnavailable());
    }
    return new Promise((resolve, reject) => {
      const id = ++sequence.current;
      const timeout = setTimeout(() => {
        pending.get(id)?.reject(assertionUnavailable());
      }, 8_000);
      pending.set(id, {
        resolve: (assertion) => {
          clearTimeout(timeout);
          pending.delete(id);
          resolve(assertion);
        },
        reject: (error) => {
          clearTimeout(timeout);
          pending.delete(id);
          reject(error);
        },
      });
      view.injectJavaScript(assertionRequestScript(id));
    });
  }

  function handleMessage({ nativeEvent }: WebViewMessageEvent) {
    if (!isPlatformPage(nativeEvent.url)) return;
    try {
      const message: unknown = JSON.parse(nativeEvent.data);
      if (typeof message !== "object" || !message || !("id" in message)) return;
      if (typeof message.id !== "number") return;
      const request = pending.get(message.id);
      if (!request) return;
      if ("assertion" in message && typeof message.assertion === "string") {
        request.resolve(message.assertion);
      } else {
        request.reject(assertionUnavailable());
      }
    } catch {
      // Ignore malformed messages. Never include a bridge payload in an error.
    }
  }

  function assertionOwner(assertion: string): string {
    return Effect.runSync(
      decodeRelayJwt(assertion).pipe(
        Effect.flatMap((claims) =>
          typeof claims.sub === "string" && claims.sub.length > 0
            ? Effect.succeed(claims.sub)
            : Effect.fail(assertionUnavailable()),
        ),
        Effect.mapError(assertionUnavailable),
      ),
    );
  }

  function handlePageLoad(url: string) {
    page.current = url;
    if (!isPlatformPage(url) || currentAccount.current !== null) return;
    void requestAssertion().then(
      (assertion) => {
        if (page.current !== url || currentAccount.current !== null) return;
        try {
          const accountId = assertionOwner(assertion);
          currentAccount.current = accountId;
          activateCloudRelayAccount(accountId, {
            getAssertion: async () => {
              const fresh = await requestAssertion();
              if (assertionOwner(fresh) !== accountId) throw assertionUnavailable();
              return fresh;
            },
          });
          setSignedIn(true);
        } catch {
          // An invalid assertion leaves the login page visible.
        }
      },
      () => {
        // A clean WebKit session reaches the Atum login page.
      },
    );
  }

  return (
    <SafeAreaProvider>
      {children}
      <SafeAreaView
        accessibilityElementsHidden={signedIn}
        accessibilityViewIsModal={!signedIn}
        pointerEvents={signedIn ? "none" : "auto"}
        style={signedIn ? styles.backgroundBrowser : styles.signIn}
      >
        <WebView
          ref={browser}
          source={SIGN_IN_SOURCE}
          incognito
          cacheEnabled={false}
          originWhitelist={["https://*"]}
          onShouldStartLoadWithRequest={({ url }) => url.startsWith("https://")}
          setSupportMultipleWindows={false}
          onLoadStart={() => {
            page.current = null;
            for (const request of pending.values()) request.reject(assertionUnavailable());
          }}
          onLoad={({ nativeEvent }) => handlePageLoad(nativeEvent.url)}
          onMessage={handleMessage}
          onContentProcessDidTerminate={() => browser.current?.reload()}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  signIn: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "white",
  },
  backgroundBrowser: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
  },
});
