# Decisions

## 2026-06-02

- Use MyInstants public search HTML for in-app sound search because no backend or paid/API dependency is allowed.
- Limit search results to 12 unique instant pages to keep the mobile add panel usable.
- Keep manual URL add as a fallback because HTML scraping can break if MyInstants changes.
- Delete only custom boards and require Android confirmation. Built-in boards stay read-only.
- Best-effort delete copied local file sounds when deleting a custom board; URL sounds only remove metadata.
- Remove transport controls from the live player dock because sound pad playback is the primary workflow.
- Keep volume visible but move it higher and enlarge the hitbox to avoid Android gesture-zone conflicts.
- Use measured `pageX` slider coordinates instead of responder `locationX` because Android drag events can jump when the thumb moves across nested views.
- Seed `Starter Board` into AsyncStorage once instead of rendering it as a hardcoded read-only board. This lets users edit/delete it and prevents it from reappearing after deletion.
- Store board `iconIndex` and `colorIndex` as small metadata fields instead of copying custom image files for logos.
- Include board logo/color metadata in export/import so shared boards keep their visual identity.
- De-duplicate MyInstants search options by normalized sound name because search results only expose page URLs before resolving direct audio.
- Keep in-app search limited to MyInstants because those results match short soundboard-style sounds better than broader sources.
- Treat MyInstants search `404` responses as empty results because the site can return `404` for queries with no matches.
- Put `Play` beside `Add` in search results so a sound can be previewed before it is stored in the board.
- Put `Manage sounds` above add/settings controls because active sounds and delete actions are the first thing users need in manage mode.
- Keep board switching on the homepage only. This gives the open board more vertical space and makes `Back` the clear way to pick another board.
- Use at most a 3-column sound pad grid in play mode. Four columns saved space but made the buttons feel too small.
- Scale sound pads from board sound count and screen width instead of using fixed percentages. Keep `100dp` as the minimum visual pad size because it stays comfortably tappable on Android.
- Keep in-app search MyInstants-only after testing extra sources. `soundboard.com` direct MP3s can work, but reported app errors make it a poor live source without a backend/proxy.
- Do not add `101soundboards.com` as a live source because unauthenticated direct requests returned `403`, making it unreliable without a backend/proxy.
- Keep de-duplication by normalized MyInstants result name and URL so already-added sounds stay hidden.
- Keep `Manage sounds` collapsed by default because playback/add flow needs vertical space and active-sound deletion is only needed on demand.
- Keep the header settings control icon-only to reduce header clutter, but retain the `Settings` accessibility label for screen readers and Android UI tests.
- Keep add-sound help in one tappable `(i)` alert, but split the text by method so users can quickly choose search, file import, MyInstants URL, or direct audio URL.
- Do not require `Sound name` before device file import. Use the picked file name as the default sound name, while still allowing a typed override.
- Remove the file-import name override from the main add panel because browse/select should be the whole import flow; renaming remains available afterward in `Manage sounds`.

## 2026-06-01

- Use managed Expo with TypeScript because repo was empty and scope requires React Native + Expo.
- Use AsyncStorage for metadata because no backend, auth, or sync is allowed.
- Store imported device audio in Expo document storage under a `sounds` directory.
- Use `expo-audio` instead of deprecated `expo-av`, following Expo SDK 56 docs.
- Support direct audio URLs and MyInstants instant pages. MyInstants pages are resolved client-side to the first direct `/media/sounds/` audio file found in the page HTML.
- Avoid native Android project/config changes. Removed auto-added `expo-audio` plugin from `app.json` because basic foreground playback does not require background audio config.
- Keep EAS Build available, but use a local no-token release APK path for direct testing/sharing. The local path runs Expo prebuild and generates native Android files only when the script is executed.
- Patch React Native's local Foojay Gradle resolver from `0.5.0` to `1.0.0` before local Android builds because Gradle 9 fails on `IBM_SEMERU` with the bundled resolver version.
- Add Android package `com.soundboard.app` and `versionCode` because EAS Android builds need stable app identity/versioning.
- Bundle only the six small files from `source examlpes/Sounds` as a read-only built-in board. This avoids copying the large full asset pack and keeps user-created boards separate from bundled examples.
- Keep Kenney `License.txt` with the bundled sounds. License is CC0.
- Add `ogg` to Metro asset extensions because Expo SDK 56 Metro did not resolve `.ogg` files without explicit asset config.
- Do not use decorative source-example UI assets in the release UI. Keep only the bundled interface sounds because they directly support the soundboard purpose.
- Use a cleaner production-style mobile UI: system font for body text, large cards and pads for touch accuracy, and colored sound pads for fast scanning.
- Separate player mode from edit mode so playback stays fast and editing controls do not clutter the live soundboard.
- Remove `userInterfaceStyle` from Expo config instead of adding `expo-system-ui`; the app already controls its visible light UI styles.
- Keep the modern UI playback-first: home lists boards, board detail opens directly to sound pads, creation stays behind `+`, and add/rename/delete stays behind `Manage`.
- Avoid extra UI dependencies for this refactor; use React Native primitives so the APK stays simple and local-build friendly.
- Use `expo-sharing` only for exporting a real shareable file from Android. Keep import on `expo-document-picker`.
- Export custom boards as `.soundboard.json`. URL sounds keep their resolved URL; device-file sounds are embedded as base64 so the whole board can move to another device.
- Do not export the built-in sample board because it is already bundled in every install and should stay read-only.
- Use `AudioPlayer.currentTime`, `duration`, and `playing` with a short polling interval for playback bars because the app already owns a `createAudioPlayer` instance.
- Keep playback progress visual-only: no extra playback labels, no now-playing card, and no `ON` state text.
- Use the generated mockup as design direction only. Do not bundle it as an app asset, so the APK stays code-native and small.
- Keep board playback visually dominant: dark shell, high-contrast sound pads, minimal labels, and edit/import/export behind controls.
- Strip a leading UTF-8 BOM before parsing imported `.soundboard.json` files because files created by Windows tools may include one.
- Use code-native neon styling and text glyphs for the reference-inspired UI instead of adding image assets or icon dependencies, keeping the APK simple and offline-friendly.
- Use a generated bitmap logo for app-store/launcher assets because the icon benefits from the same glossy neon visual style as the app UI.
- Use local PNG assets for the main soundboard/control visuals instead of extra icon dependencies, keeping the app self-contained and APK-friendly.
- Keep the `Settings` entry as a visible large button, but route custom board settings through edit mode so playback stays the default board screen.
- Keep the player dock outside the board scroll area on detail screens. This keeps transport/volume/add controls available while the sound grid scrolls, and bottom padding keeps the last row tappable on 10-20+ sound boards.
- Use a read-only URL-based `Starter Board` instead of bundled local interface sounds because the requested defaults are MyInstants sounds and this keeps the APK smaller.
- Keep only exact stress-test board names out of loaded user boards (`Stress 24`, `Stress 24 Local`, `StressFiles24`) so test artifacts disappear without broadly deleting user data.
- Use a tappable `i` help control instead of desktop hover behavior because this is a mobile Android app.
