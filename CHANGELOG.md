# Changelog

## 2026-06-02

- Added custom board deletion from `Board settings` with Android confirm dialog.
- Added in-app MyInstants sound search in the custom board add-sound panel.
- Added direct add from search result by resolving the MyInstants page to a playable MP3 URL.
- Removed `Previous`, `Stop`, `Next`, `Top`, and hide/show transport controls from the live player dock.
- Kept the player dock volume-only and made the volume slider easier to drag with a larger touch zone and safer bottom spacing.
- Reworked volume dragging to use measured screen coordinates instead of local touch coordinates for smoother Android swipes.
- Made `Starter Board` a normal locally stored board, so it can be managed, edited, exported, and deleted.
- Added board name editing plus board logo and color choices in `Board settings`.
- Made header `Settings` open `Manage` for every open board.
- Added board logo/color metadata to `.soundboard.json` export/import.
- Filtered MyInstants search results so sounds already present in the current board are not shown as add options.
- Removed a MyInstants search result immediately after it is successfully added.
- Removed the board selector rail from the open soundboard view; board switching now happens from the homepage via `Back`.
- Compacted the open soundboard grid to fit more sound pads per screen while keeping each pad tappable.
- Added dynamic sound pad scaling: small boards get larger pads, larger boards compact down with a fixed minimum tappable size.
- Increased the minimum sound pad size and capped large boards at 3 pads per row.
- Rebuilt and refreshed the standalone local APK at `Soundboard-release.apk`.

## 2026-06-01

- Created Expo React Native app from blank TypeScript template.
- Added local soundboard creation and browsing.
- Added sound import from device audio files with `expo-document-picker` and `expo-file-system`.
- Added direct audio URL validation and playback with `expo-audio`.
- Added local metadata persistence with AsyncStorage.
- Added EAS preview APK build configuration and `build:android:apk` script.
- Documented sound adding flow and APK sharing steps.
- Replaced deprecated React Native `SafeAreaView` with `react-native-safe-area-context` for clean Expo Go testing.
- Added bundled Kenney Interface Sounds board with six built-in `.ogg` sounds.
- Added Metro config for bundling `.ogg` sound assets.
- Restyled the app with a cleaner mobile soundboard interface.
- Added MyInstants instant page URL resolving to direct `/media/sounds/` audio files.
- Added `build:android:apk:local` script for a no-token local release APK build.
- Added local Gradle Foojay resolver workaround for Gradle 9 APK builds.
- Redesigned the mobile UI with cleaner board cards, larger touch targets, a clearer add-sound panel, and colored sound pads with play state.
- Split board playback from board editing.
- Added sound rename and delete controls in edit mode.
- Removed decorative source-example UI assets from the app; only relevant bundled sounds remain.
- Made playback the primary UI: board list opens straight to pads, create board is behind `+`, and add/rename/delete controls are behind `Manage`.
- Refactored the full UI into a modern playback-first layout with a library summary, compact app header, board detail hero, now-playing card, and cleaner sound pad grid.
- Added full custom board export/import as `.soundboard.json`, including URL sounds and imported device audio encoded into the export file.
- Added homepage `Settings` with `Import board`, while keeping board cards and sound playback as the main homepage flow.
- Added board-level `Board settings` under `Manage` with `Export board` and `Import board`.
- Added visual-only playback progress bars on sound pads; finished sounds leave the bar full without adding playback text.
- Simplified the UI copy and moved to a darker neon soundboard design based on a generated design direction.
- Removed hidden/leftover playback status text and old source/sample labels from the app UI.
- Made `.soundboard.json` import tolerate UTF-8 BOM files from external tools.
- Reworked the UI closer to the neon soundboard reference with a waveform header, horizontal board rail, 3-column glowing sound pads, and a compact player dock.
- Added a generated neon soundboard app icon and refreshed Expo icon, Android adaptive icon, monochrome icon, splash icon, and favicon assets.
- Added missing in-app image assets for neon background, sound pad icons, board rail icons, header controls, player controls, and volume.
- Replaced key glyph controls with PNG assets, improved the detail back button placement, made settings actions clearer, and fixed the volume bar to reflect/set actual playback volume.
- Made large boards scroll correctly by keeping the player dock fixed below the sound grid and adding enough bottom padding for 10-20+ sound pads.
- Replaced the built-in `Interface Sounds` board with a `Starter Board` containing three MyInstants sounds.
- Compacted the player controls into a smaller dock with hide/show and top controls so sound pads stay dominant.
- Added an `i` help button in the add-sound form explaining how to paste MyInstants page URLs or direct audio URLs.
- Removed bundled interface sound assets from the app.
