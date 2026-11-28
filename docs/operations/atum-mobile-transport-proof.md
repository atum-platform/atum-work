# Atum Work mobile transport proof

W0 uses one development-only iOS build, one owner-linked Mac, and one existing visible thread. Set `APP_VARIANT=development ATUM_MOBILE_TRANSPORT_PROOF=1` for both Expo prebuild and JavaScript bundling. The app is **Atum Work Transport**, bundle ID `com.atum.work-transport-proof`. Keep this fixture on the local spike branch.

The embedded Atum login opens `https://api.atumplatform.com/login` in an ephemeral WebKit session. It POSTs to `/api/work/connect/assertion` from the same origin for each ManagedRelay credential read. The reviewed fork adapter feeds the 60-second assertion to the native T3 client. Assertion payloads, relay access tokens and environment session tokens stay in memory. T3 persists its proof key and selected connection so the Mac can recognize the phone after a relaunch. You will sign in again after force-quitting because the browser session is ephemeral.

The proof enables ManagedRelay at `https://relay.atumplatform.com` under client ID `t3-mobile`. Clerk, OTA updates, external tracing and crash reporting, agent notification registration, and the subscription widget are outside the proof configuration. The Mac continues to own device approval and thread access.

## Local build

Use the fork checkout at `/Volumes/AtumTestFlight/projects/atum-work`. Use the pinned Node and pnpm versions from `package.json` and put all package and native caches on the build volume. Run native commands under the shared lock.

```sh
cd /Volumes/AtumTestFlight/projects/atum-work
export TMPDIR=/Volumes/AtumTestFlight/tmp
export XDG_CACHE_HOME=/Volumes/AtumTestFlight/work-w0/cache
export npm_config_cache=/Volumes/AtumTestFlight/npm-cache
export CP_HOME_DIR=/Volumes/AtumTestFlight/work-w0/cache/cocoapods
export CP_CACHE_DIR=/Volumes/AtumTestFlight/work-w0/cache/pod-cache
export COCOAPODS_DISABLE_STATS=1 EXPO_NO_TELEMETRY=1
export APP_VARIANT=development ATUM_MOBILE_TRANSPORT_PROOF=1 EXPO_NO_DOTENV=1
pnpm --filter @t3tools/mobile... install --frozen-lockfile \
  --ignore-scripts --store-dir /Volumes/AtumTestFlight/pnpm-store
lockf -k /Volumes/AtumTestFlight/.heavy-build.lock pnpm rebuild --pending
cd apps/mobile
lockf -k /Volumes/AtumTestFlight/.heavy-build.lock pnpm exec expo prebuild --platform ios --no-install
lockf -k /Volumes/AtumTestFlight/.heavy-build.lock pod install --project-directory=ios
```

Use Xcode's Release configuration with **Apple Development** signing so the phone has an embedded JS bundle for the cellular test. For a simulator build, set `CODE_SIGNING_ALLOWED=NO`, use `-destination 'platform=iOS Simulator,id=42AAADDF-0F11-42C1-B19A-29EAE4594941'`, and set `-jobs 2 -derivedDataPath /Volumes/AtumTestFlight/work-w0/DerivedData` under the same lock. Inspect the workspace with `xcodebuild -list` under the lock to get its generated scheme.

## Owner install and test

1. On the Mac, open the running Work environment's **Settings → Sharing & access**. Select the same environment the iPhone will connect to. Verify **Require approval for new T3 Connect devices** is on. This is the environment's `requireConnectDeviceApproval` setting. An explicit false survives an update despite the Atum fork's true default. The owner must enable it in that UI before starting the proof if it is off.
2. On the build Mac, open the generated `.xcworkspace` and sign in under **Xcode → Settings → Apple Accounts** if the signing team is missing. In the app target's **Signing & Capabilities**, enable automatic signing, choose the existing development team, and keep `com.atum.work-transport-proof`. Connect and trust the iPhone, enable **Settings → Privacy & Security → Developer Mode** if needed, and register it with the team if Xcode prompts. This Mac has profiles for the shipping Atum app and its notification extension. W0 needs an Apple Development provisioning profile for the proof bundle ID and this iPhone. [Apple device signing and provisioning](https://developer.apple.com/documentation/xcode/running-your-app-on-simulated-or-physical-devices)
3. Build locally under the shared lock with `-configuration Release -destination 'generic/platform=iOS' -jobs 2 -derivedDataPath /Volumes/AtumTestFlight/work-w0/DerivedData-device CODE_SIGN_IDENTITY='Apple Development'`, passing the generated workspace and scheme. Use the team and profile provisioned in step 2. Install the resulting application with `xcrun devicectl device install app --device <iPhone-UDID> <path-to-app>`. Launch **Atum Work Transport**. Leave the Mac linked and online, disconnect the iPhone from the build Mac, switch off Wi‑Fi, and disable all VPNs including Tailscale.
4. Sign into the embedded Atum page as the Mac's linked owner. Use Atum email/password if the OAuth provider blocks embedded sign-in. Open **Settings → Connections** or its **New connection** screen and look for the Mac in the managed relay list. Tap the Mac. In the Mac's **Sharing & access** pending requests, approve this phone once.
5. Open an existing visible thread on the phone. Start a turn on the Mac in that same thread and confirm one real streamed update arrives on the phone. Note how scrolling and the keyboard feel in a long thread. Force-quit, relaunch, sign back in, and reopen the same thread. Pass requires discovery, one Mac approval, an existing thread, a live update, and reopening without a second approval.

If the owner cannot establish an Atum web session in the WebView, record that result and carry the transport test into the disposable Atum host app as described in PLAN-v2. Stock T3's cloud discovery uses its own identity and relay. Its manual and QR pairing can reach a compatible tunneled environment when it has a valid credential. That is a separate, unverified route for Atum Work.

## Verification

- Public relay OAuth metadata returned HTTP 200 and advertised ES256 DPoP. The unauthenticated assertion POST redirected to Atum login. An authenticated owner session is required to verify discovery and redemption.
- The reviewed relay source admits `t3-mobile` for `environment:status` and `environment:connect`. Its Atum assertion loopback used `t3-web`. The two IDs share the assertion verifier. Live mobile exchange remains part of the physical-device acceptance test.
- The branch starts at `origin/main` (`2eba331ee0`). The Atum identity adapter and assertion-cache opt out come from the reviewed fork revision `17c46972d8`, which had the Atum relay changes absent from main.
- Source-only checks exercised TypeScript transpilation, W0 and stock Expo config, top-frame and origin restrictions in the injected assertion request, request cache policy, and the reused identity adapter. This is independent of an iOS launch or a full typecheck. Logs are under `/Volumes/AtumTestFlight/work-w0/logs`.
- Both the branch and the pinned Mac runtime source (`6ae403613e`) advertise orchestration protocol 2.
- Native verification stopped during setup. The pinned Node 26.13.1 and pnpm 12.14.0 launchers stalled on this host. Node 24 and pnpm 11 could read a temporary projection of the workspace lockfile. The projection removed the package-manager lock document and represented the existing `undici` catalog resolution as its exact locked version. The fallback verified the dependency supply-chain policy, but package linking did not complete. The tracked package inputs were restored.
- CocoaPods was absent from PATH. Its Ruby gem dependencies were fetched on the build volume, and the offline installation stayed queued behind the shared lock for the duration of the attempt. Full typecheck, project tests, prebuild, simulator launch, and owner discovery are pending. There is no device artifact. The designated simulator was already shut down and no DerivedData was created.
