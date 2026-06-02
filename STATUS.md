# Status

## 2026-06-02

Status: GROEN

Implemented:
- Custom boards can be deleted from `Manage` > `Board settings` with a confirm dialog.
- Default/read-only boards cannot be deleted.
- Custom board add flow now supports `Search sounds` using MyInstants search results.
- Search results can be added directly; the app resolves the MyInstants page URL to a direct audio URL before storing it.
- Live player dock is volume-only. `Previous`, `Stop`, `Next`, `Top`, and hide/show controls are removed from the UI.
- Volume slider has a larger touch target, larger thumb, and more bottom spacing for easier Android dragging.
- Volume slider now uses measured screen coordinates while dragging, so horizontal swipes are stable instead of jumpy.
- `Starter Board` is now seeded into local storage once and can be edited, renamed, exported, and deleted like any other board.
- Board settings now includes board name, logo, and color controls.
- Header `Settings` opens board `Manage` for any selected board.
- Board export/import now includes logo and color metadata.
- MyInstants search no longer shows results whose sound name already exists in the current board.
- Added search results are removed from the visible add-options immediately after successful add.
- Open soundboards no longer show the board selector rail; use `Back` to return to board selection.
- Open soundboards now use at most 3 sound pads per row so buttons stay large enough for comfortable tapping.
- Sound pads now scale by sound count: 1-4 sounds use larger pads and 5+ sounds use 3-column pads with a 100dp minimum.
- In-app sound search is MyInstants-only again.
- Search results have `Play` preview and `Add` actions.
- Board `Manage` now shows active sounds and `Delete` controls at the top before add/settings controls.
- MyInstants empty-search `404` pages now show clear `No results` feedback instead of a generic search failure.
- Earlier standalone APK was rebuilt, installed on `onedroid`, and refreshed at `Soundboard-release.apk`.
- `Manage sounds` is now collapsed by default and expands under the toggle.
- Adding a sound now shows a short `Added` confirmation that disappears automatically.
- Extra live sources were removed again after testing/user error reports; search is MyInstants-only.
- `101soundboards.com` is not integrated because it returned `403` for unauthenticated direct requests.
- Latest standalone APK was rebuilt, installed on Pixel_8 (`emulator-5554`), and refreshed at `Soundboard-release.apk`.
- Header `Settings` is now icon-only while retaining the `Settings` accessibility label.
- Latest standalone APK was rebuilt, installed on Pixel_8 (`emulator-5554`), and refreshed at `Soundboard-release.apk`.
- Add-sound `(i)` help now explains each add method separately: search, preview/add, file import, MyInstants URL, direct audio URL, and sound name.
- Latest standalone APK was rebuilt, installed on Pixel_8 (`emulator-5554`), and refreshed at `Soundboard-release.apk`.
- Device audio import no longer requires a prefilled sound name. If the field is empty, the app uses the selected file name without its extension.
- Latest standalone APK was rebuilt, installed on Pixel_8 (`emulator-5554`), and refreshed at `Soundboard-release.apk`.
- The add-sound panel no longer shows a name field before `Import file`; `Sound name for URL` now appears only in the URL add section.
- Latest standalone APK was rebuilt, installed on Pixel_8 (`emulator-5554`), and refreshed at `Soundboard-release.apk`.

Risks:
- MyInstants has no official app API here; search parses public HTML and can break if the website changes.
- Search/add via MyInstants needs internet on the phone. Already-added URL sounds also need internet unless imported from local file.
- Existing local user-created boards remain after APK update by design.
- Search still depends on MyInstants public HTML and may change if MyInstants changes its pages.
- GitHub publishing is blocked until a GitHub remote exists or GitHub CLI is installed/authenticated.
- Existing Android UI tests can still find the header control by `content-desc="Settings"`.
- The help alert uses Android's native alert layout; long localized help copy should be rechecked if more methods are added.
- Expo DocumentPicker opens the Android system file picker; the app can allow browsing to Downloads, but it cannot force every Android device to start in Downloads.
- File import no longer supports a manual name override before picking; users can still rename imported sounds from `Manage sounds`.

## 2026-06-01

Status: GROEN

Implemented:
- Expo React Native app exists.
- Users can create and open soundboards.
- Users can add named sounds from device files.
- Users can add named sounds from direct audio URLs.
- Users can add named sounds from MyInstants instant page URLs; the app stores the resolved direct media URL.
- Users can play sounds from buttons.
- Soundboard metadata persists locally.
- APK sharing is configured through EAS preview build and a local no-token release APK script.
- Built-in `Starter Board` is available with three MyInstants URL sounds.
- UI was redesigned with cleaner board cards, large add buttons, readable labels, and colored sound pads with active play state.
- Player mode and edit mode are split. Player mode is for playback; edit mode is for adding, renaming, and deleting sounds.
- Playback is now the primary UI. Create is behind `+`; editing is behind `Manage`.
- Latest standalone APK was refreshed at `Soundboard-release.apk` after the modern UI refactor.
- Latest APK was emulator-tested for home, built-in board playback, custom board creation, MyInstants URL add, persistence after relaunch, and URL sound playback.
- Custom boards can be exported to `.soundboard.json` from `Manage` > `Board settings`.
- `.soundboard.json` imports are available from homepage `Settings` and from `Manage` > `Board settings`.
- Exported boards include URL sounds and copied device-file sounds as base64 data, then imports recreate the board and copy audio back to local app storage.
- Latest standalone APK was rebuilt after adding export/import and refreshed at `Soundboard-release.apk`.
- Sound pads now show playback progress with a visual bar. The app no longer adds `Playing`, `NOW PLAYING`, or `ON` text for playback state.
- Latest standalone APK was rebuilt after adding progress bars and refreshed at `Soundboard-release.apk`.
- Latest UI pass removed redundant labels/status copy and refreshed the app with a darker playback-first visual style.
- Latest standalone APK was rebuilt after the final visual cleanup, installed on the emulator, and refreshed at `Soundboard-release.apk`.
- Latest standalone APK was rebuilt after the import robustness fix and refreshed at `Soundboard-release.apk`.
- Latest standalone APK was rebuilt after the neon reference UI pass, installed on the emulator, and refreshed at `Soundboard-release.apk`.
- Latest standalone APK was rebuilt after the neon app icon update, installed on the emulator, and refreshed at `Soundboard-release.apk`.
- Latest standalone APK was rebuilt after adding in-app image assets, fixing the volume bar, improving settings rows, and moving the detail back button into the header.
- Latest standalone APK was rebuilt after the large-board scrolling fix, installed on the emulator, and refreshed at `Soundboard-release.apk`.
- Latest standalone APK was rebuilt after the compact dock/default-board update, installed on the emulator, and refreshed at `Soundboard-release.apk`.

Risks:
- Local Node.js is now `v24.16.0`; current PATH still points Java to Java 8 unless `JAVA_HOME` is set for builds.
- `npm audit` reports 10 moderate vulnerabilities from installed dependency tree.
- EAS APK build requires Expo login or `EXPO_TOKEN`; no authenticated APK was produced in this session.
- Standalone local release APK was built, copied to `Soundboard-release.apk`, installed on the emulator, and launched without Metro/Expo Go.
- MyInstants URL add flow was tested in the standalone APK.
- Added MyInstants sound playback was tested; Android reported `PlaybackState PLAYING`.
- Current PATH still points to Java 8, but the build works when `JAVA_HOME` points to installed JDK 21.
- Android emulator initially killed Expo Go under low memory. Retest used the same `Pixel_8` AVD with `-memory 4096` runtime flag.
- Built-in board is read-only; users add their own sounds in custom boards.
- Built-in and custom URL sounds were playback-tested in the standalone APK.
- UI changes were typechecked, Android-exported, installed, launched, and checked on the emulator.
- Export was smoke-tested on Android: `Export board` opened the native share sheet with `ModernBoard.soundboard.json`.
- Progress bar was smoke-tested on Android: tapping a built-in sound rendered a non-text progress view inside the sound pad.
- Latest visual UI pass typechecked and was screenshot-checked on Android home and player screens.
- Import picker was end-to-end tested on Android with a `.soundboard.json` containing one embedded audio file and one URL sound.
- Imported file and imported URL sounds were playback-tested through Android media sessions.
- Neon reference UI pass was typechecked, locally release-built, installed, screenshot-checked on home/detail, and playback-tested through Android media sessions.
- App icon update was config-checked, typechecked, locally release-built, and installed on Android emulator.
- New PNG asset UI, settings rows, header back button, volume adjustment, and playback were tested on the Android emulator.
- Large board scalability was tested on Android with a 24-sound imported board. Top, middle, and bottom pads remained reachable; `Stress 24` played and stopped normally.
- Default board now shows `Starter Board` with three MyInstants sounds. The old `Interface Sounds` board and exact stress-test boards are not shown.
- Player controls can collapse to a small `Show controls` pill and reopen. A `Top` control scrolls the board up.
- Add-sound URL help is available through the `i` button in custom board edit mode.
