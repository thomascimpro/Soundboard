# Soundboard

Android soundboard app.

## Download APK

Download the APK from the repository root:

```text
Soundboard-release.apk
```

Install on Android:

1. Download `Soundboard-release.apk` to your phone.
2. Open the APK from Files/Downloads.
3. Allow `Install unknown apps` if Android asks for it.
4. Tap `Install`.
5. Open `Soundboard`.

No server, Expo Go, account, or internet connection is needed to open the app. URL-based sounds need internet when played.

## Features

- Create local soundboards.
- Add sounds from device audio files.
- Add sounds from direct online audio URLs or MyInstants instant pages.
- Use a separate player screen for playback and edit screen for sound management.
- Rename and delete sounds from the edit screen.
- Export and import full custom boards as `.soundboard.json`.
- Play sounds from board buttons.
- Persist soundboard metadata locally with AsyncStorage.
- Includes a starter board with three MyInstants sounds.

## Run

```sh
npm install
npm run android
```

Use `npm start` for Expo development server.

## Add sounds

1. Create a soundboard from the Soundboards screen.
2. Open the soundboard.
3. Tap `Manage`.
4. Enter a sound name.
5. Choose one option:
   - `Import file`: pick an audio file from the phone.
   - `Add URL`: paste a direct audio file URL, for example `https://example.com/sound.mp3`, or a MyInstants instant page.
6. Tap `Done`.
7. Tap the sound button to play it.

## Export and import boards

- Open a custom board.
- Tap `Manage`.
- Under `Board settings`, tap `Export board`.
- Share/save the generated `.soundboard.json` file.
- To import, use homepage `Settings` > `Import board`, or `Manage` > `Board settings` > `Import board`.

Exports include URL sounds and imported device audio. Imported boards are copied back into local app storage.

The starter board is stored locally and can be edited, exported, or deleted.

MyInstants example:

```text
https://www.myinstants.com/nl/instant/among-us-role-reveal-sound-34956/
```

The app resolves that page to the real audio file:

```text
https://www.myinstants.com/media/sounds/among-us-role-reveal-sound.mp3
```

## Share an Android APK

The latest local APK is committed in the repository root as `Soundboard-release.apk`.

This project also includes an EAS preview profile that builds an installable APK.

```sh
npm run build:android:apk
```

Requirements:
- Expo account login with `npx eas-cli login`, or `EXPO_TOKEN` in CI.
- Node.js version supported by Expo SDK 56.

After the build finishes, share the APK download URL from EAS or download the APK and send the file.

## Build an Android APK without Expo login

For a free local APK without Expo account or `EXPO_TOKEN`, use:

```sh
npm run build:android:apk:local
```

This generates the native Android project locally and builds a standalone release APK. Output:

```text
android/app/build/outputs/apk/release/app-release.apk
```

Requirements:
- Android Studio / Android SDK.
- JDK version supported by Expo SDK 56.

Use this local APK for direct sharing and testing. Use EAS later only if you need managed cloud builds.

## Notes

- URL import accepts direct audio sources, for example `.mp3`, `.wav`, `.m4a`, `.aac`, `.ogg`, `.opus`, or responses with `audio/*` content type.
- MyInstants instant page URLs are fetched and resolved to the first `/media/sounds/` audio file found on the page.
- No backend, auth, sync, online sharing, or payment features are included.
- Built-in interface sounds are from Kenney Interface Sounds, CC0.
- Only the bundled interface sounds are used from the source examples; decorative UI assets were removed from the app.
