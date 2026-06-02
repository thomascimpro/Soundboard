import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  GestureResponderEvent,
  Image,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type SoundSource = 'asset' | 'file' | 'url';

type Sound = {
  id: string;
  name: string;
  uri?: string;
  assetModule?: number;
  source: SoundSource;
};

type Soundboard = {
  id: string;
  name: string;
  sounds: Sound[];
  iconIndex?: number;
  colorIndex?: number;
};

type BoardMode = 'play' | 'edit';

type ExportedSound = {
  name: string;
  source: 'file' | 'url';
  uri?: string;
  fileName?: string;
  mimeType?: string;
  base64?: string;
};

type ExportedSoundboard = {
  app: 'Soundboard';
  version: 1;
  exportedAt: string;
  board: {
    name: string;
    sounds: ExportedSound[];
    iconIndex?: number;
    colorIndex?: number;
  };
};

type SearchSoundResult = {
  id: string;
  name: string;
  pageUrl: string;
};

const STORAGE_KEY = 'soundboard.boards.v1';
const DEFAULT_SEEDED_KEY = 'soundboard.defaultSeeded.v1';
const DIRECT_AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.aac', '.wav', '.ogg', '.opus', '.flac'];
const SOUND_PAD_COLORS = ['#19d4e5', '#ff6f61', '#f8b72f', '#8adf3f', '#9b5cff', '#12c7d8', '#ff4f8b', '#4aa8ff', '#b7f33a'];
const SOUND_GRID_GAP = 8;
const SOUND_GRID_HORIZONTAL_PADDING = 10;
const MIN_SOUND_PAD_SIZE = 100;
const MAX_SOUND_PAD_SIZE = 164;
const UI_ASSETS = {
  back: require('./assets/ui/back.png'),
  grid: require('./assets/ui/grid.png'),
  neonPanel: require('./assets/ui/neon-panel.png'),
  next: require('./assets/ui/next.png'),
  previous: require('./assets/ui/previous.png'),
  settings: require('./assets/ui/settings.png'),
  stop: require('./assets/ui/stop.png'),
  volume: require('./assets/ui/volume.png'),
};
const SOUND_PAD_ICON_ASSETS = [
  require('./assets/ui/wave.png'),
  require('./assets/ui/burst.png'),
  require('./assets/ui/bolt.png'),
  require('./assets/ui/megaphone.png'),
  require('./assets/ui/smile.png'),
  require('./assets/ui/robot.png'),
  require('./assets/ui/heart.png'),
  require('./assets/ui/play.png'),
  require('./assets/ui/disc.png'),
];
const BOARD_ICON_ASSETS = [
  require('./assets/ui/grid.png'),
  require('./assets/ui/megaphone.png'),
  require('./assets/ui/smile.png'),
  require('./assets/ui/play.png'),
  require('./assets/ui/disc.png'),
  require('./assets/ui/wave.png'),
  require('./assets/ui/burst.png'),
  require('./assets/ui/bolt.png'),
];
const SOUND_PAD_ICONS = ['⌁', '✸', 'ϟ', '♬', '☻', '▣', '♡', '▷', '◉'];
const BOARD_ICONS = ['▦', '📣', '☻', '♫', '◌', '⌁', '✸', 'ϟ'];

const DEFAULT_SOUNDBOARD: Soundboard = {
  id: 'default-starter-board',
  name: 'Starter Board',
  iconIndex: 0,
  colorIndex: 0,
  sounds: [
    {
      id: 'default-2000-years-later',
      name: '2000 Years Later',
      source: 'url',
      uri: 'https://www.myinstants.com/media/sounds/spongebob-2000-years-later-2019-download-link.mp3',
    },
    {
      id: 'default-clown-honk',
      name: 'Clown Honk',
      source: 'url',
      uri: 'https://www.myinstants.com/media/sounds/clown-honk-sound.mp3',
    },
    {
      id: 'default-spongebob-fail',
      name: 'Spongebob Fail',
      source: 'url',
      uri: 'https://www.myinstants.com/media/sounds/spongebob-fail.mp3',
    },
  ],
};

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const trimName = (value: string) => value.trim().replace(/\s+/g, ' ');

const normalizeSoundName = (value: string) => trimName(value).toLowerCase();

const normalizeSearchKey = (value: string) =>
  normalizeSoundName(value)
    .replace(/\.(mp3|m4a|aac|wav|ogg|opus|flac)\b/g, '')
    .replace(/\b(sound|sounds|soundss|effect|effects|sfx|audio)\b/g, '')
    .replace(/[^a-z0-9]+/g, '');

const normalizeSearchUrl = (value?: string) => {
  if (!value) {
    return '';
  }

  try {
    const url = new URL(value);
    url.hash = '';
    return url.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return value.trim().replace(/\/$/, '').toLowerCase();
  }
};

const getSimilarSearchQuery = (query: string) => {
  const words = normalizeSoundName(query)
    .replace(/\b(sound|sounds|soundss|effect|effects|sfx|audio|meme|mp3)\b/g, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3);

  if (words.length === 0) {
    return '';
  }

  return words.slice(0, 2).join(' ');
};

const getSearchFallbackQueries = (query: string) => {
  const normalizedQuery = normalizeSoundName(query);
  const queries = new Set<string>();
  const similarQuery = getSimilarSearchQuery(query);

  if (similarQuery && similarQuery !== normalizedQuery) {
    queries.add(similarQuery);
  }

  const words = normalizedQuery.split(/\s+/).filter(Boolean);
  const lastWord = words.at(-1);

  if (lastWord && lastWord.length > 3 && lastWord.endsWith('s')) {
    queries.add([...words.slice(0, -1), lastWord.slice(0, -1)].join(' '));
  }

  return [...queries];
};

const getSoundDirectory = () => new Directory(Paths.document, 'sounds');

const getExportFileName = (name: string) => `${trimName(name).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'soundboard'}.soundboard.json`;

const getSoundIcon = (sound: Sound, index: number) => {
  const name = sound.name.toLowerCase();

  if (name.includes('click') || name.includes('tap')) {
    return '⌁';
  }

  if (name.includes('switch') || name.includes('zap') || name.includes('fail')) {
    return 'ϟ';
  }

  if (name.includes('laugh') || name.includes('fun') || name.includes('among')) {
    return '☻';
  }

  if (name.includes('music') || name.includes('song')) {
    return '♫';
  }

  return SOUND_PAD_ICONS[index % SOUND_PAD_ICONS.length];
};

const getSoundIconAsset = (sound: Sound, index: number) => {
  const name = sound.name.toLowerCase();

  if (name.includes('click') || name.includes('tap')) {
    return require('./assets/ui/wave.png');
  }

  if (name.includes('switch') || name.includes('zap') || name.includes('fail')) {
    return require('./assets/ui/bolt.png');
  }

  if (name.includes('laugh') || name.includes('fun') || name.includes('among')) {
    return require('./assets/ui/smile.png');
  }

  if (name.includes('music') || name.includes('song')) {
    return require('./assets/ui/play.png');
  }

  return SOUND_PAD_ICON_ASSETS[index % SOUND_PAD_ICON_ASSETS.length];
};

const normalizeIndex = (value: unknown, fallback: number, length: number) => {
  const numberValue = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
  return ((numberValue % length) + length) % length;
};

const getBoardIconIndex = (board: Soundboard, fallback: number) =>
  normalizeIndex(board.iconIndex, fallback, BOARD_ICON_ASSETS.length);

const getBoardColorIndex = (board: Soundboard, fallback: number) =>
  normalizeIndex(board.colorIndex, fallback, SOUND_PAD_COLORS.length);

const getBoardColor = (board: Soundboard, fallback: number) => SOUND_PAD_COLORS[getBoardColorIndex(board, fallback)];

const normalizeBoard = (board: Soundboard, index: number): Soundboard => ({
  ...board,
  iconIndex: getBoardIconIndex(board, index),
  colorIndex: getBoardColorIndex(board, index),
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getNameFromInstantUrl = (url: string) => {
  const slug = url.split('/instant/')[1]?.split('/')[0] ?? 'Sound';
  const withoutId = slug.replace(/-\d+$/, '');

  return decodeURIComponent(withoutId)
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Sound';
};

const getExtension = (name: string) => {
  const cleanName = name.split('?')[0].split('#')[0];
  const dotIndex = cleanName.lastIndexOf('.');
  return dotIndex >= 0 ? cleanName.slice(dotIndex).toLowerCase() : '';
};

const hasDirectAudioExtension = (url: URL) =>
  DIRECT_AUDIO_EXTENSIONS.some((extension) => url.pathname.toLowerCase().endsWith(extension));

const isHttpUrl = (url: URL) => ['http:', 'https:'].includes(url.protocol);

const isMyInstantsHost = (hostname: string) => hostname === 'myinstants.com' || hostname.endsWith('.myinstants.com');

const findMyInstantsAudioUrl = (pageUrl: string, html: string) => {
  const normalizedHtml = html.replace(/\\\//g, '/').replace(/&amp;/g, '&');
  const matches =
    normalizedHtml.match(
      /(?:https?:)?\/\/(?:www\.)?myinstants\.com\/media\/sounds\/[^"' <>)\\]+|\/media\/sounds\/[^"' <>)\\]+/gi,
    ) ?? [];

  for (const match of matches) {
    try {
      const absoluteUrl = match.startsWith('//') ? `https:${match}` : new URL(match, pageUrl).toString();
      const audioUrl = new URL(absoluteUrl);

      if (isMyInstantsHost(audioUrl.hostname) && hasDirectAudioExtension(audioUrl)) {
        return audioUrl.toString();
      }
    } catch {
      // Try the next match.
    }
  }

  return null;
};

const isDirectAudioUrl = async (rawUrl: string) => {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  if (!isHttpUrl(url)) {
    return false;
  }

  try {
    const response = await fetch(rawUrl, { method: 'HEAD' });
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';

    if (response.ok && contentType.startsWith('audio/')) {
      return true;
    }

    if (response.ok && contentType.includes('application/octet-stream')) {
      return hasDirectAudioExtension(url);
    }
  } catch {
    return hasDirectAudioExtension(url);
  }

  return hasDirectAudioExtension(url);
};

const resolveAudioUrl = async (rawUrl: string) => {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (!isHttpUrl(url)) {
    return null;
  }

  if (await isDirectAudioUrl(rawUrl)) {
    return rawUrl;
  }

  if (!isMyInstantsHost(url.hostname)) {
    return null;
  }

  try {
    const response = await fetch(rawUrl);

    if (!response.ok) {
      return null;
    }

    const resolvedUrl = findMyInstantsAudioUrl(rawUrl, await response.text());

    if (resolvedUrl && (await isDirectAudioUrl(resolvedUrl))) {
      return resolvedUrl;
    }
  } catch {
    return null;
  }

  return null;
};

const searchMyInstants = async (query: string): Promise<SearchSoundResult[]> => {
  const searchUrl = `https://www.myinstants.com/en/search/?name=${encodeURIComponent(query)}`;
  const response = await fetch(searchUrl);

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    throw new Error('Search failed.');
  }

  const html = await response.text();
  const matches = html.matchAll(/href=["']([^"']*\/instant\/[^"']+)["']/gi);
  const seenUrls = new Set<string>();
  const results: SearchSoundResult[] = [];

  for (const match of matches) {
    try {
      const pageUrl = new URL(match[1], searchUrl).toString();
      const url = new URL(pageUrl);

      if (!isMyInstantsHost(url.hostname) || seenUrls.has(pageUrl)) {
        continue;
      }

      seenUrls.add(pageUrl);
      results.push({
        id: pageUrl,
        name: getNameFromInstantUrl(pageUrl),
        pageUrl,
      });

      if (results.length >= 12) {
        break;
      }
    } catch {
      // Try the next result.
    }
  }

  return results;
};

const searchSoundSources = async (query: string) => {
  return searchMyInstants(query);
};

const dedupeSearchResults = (results: SearchSoundResult[], existingSounds: Sound[]) => {
  const existingNames = new Set(existingSounds.map((sound) => normalizeSearchKey(sound.name)));
  const existingUrls = new Set(existingSounds.map((sound) => normalizeSearchUrl(sound.uri)).filter(Boolean));
  const seenNames = new Set<string>();
  const seenUrls = new Set<string>();
  const seenIds = new Set<string>();

  return results.filter((result) => {
    const nameKey = normalizeSearchKey(result.name);
    const urlKey = normalizeSearchUrl(result.pageUrl);

    if (!nameKey || seenIds.has(result.id) || existingNames.has(nameKey) || seenNames.has(nameKey)) {
      return false;
    }

    if (urlKey && (existingUrls.has(urlKey) || seenUrls.has(urlKey))) {
      return false;
    }

    seenIds.add(result.id);
    seenNames.add(nameKey);

    if (urlKey) {
      seenUrls.add(urlKey);
    }

    return true;
  });
};

export default function App() {
  const { width: windowWidth } = useWindowDimensions();
  const [boards, setBoards] = useState<Soundboard[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [boardMode, setBoardMode] = useState<BoardMode>('play');
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [boardName, setBoardName] = useState('');
  const [soundName, setSoundName] = useState('');
  const [soundUrl, setSoundUrl] = useState('');
  const [soundSearchQuery, setSoundSearchQuery] = useState('');
  const [soundSearchFeedback, setSoundSearchFeedback] = useState('');
  const [soundSearchResults, setSoundSearchResults] = useState<SearchSoundResult[]>([]);
  const [isManageSoundsOpen, setIsManageSoundsOpen] = useState(false);
  const [actionNotice, setActionNotice] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [playingSoundId, setPlayingSoundId] = useState<string | null>(null);
  const [finishedSoundId, setFinishedSoundId] = useState<string | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [volume, setVolume] = useState(1);
  const playerRef = useRef<AudioPlayer | null>(null);
  const detailScrollRef = useRef<ScrollView | null>(null);
  const volumeTrackRef = useRef<View | null>(null);
  const volumeTrackMetricsRef = useRef({ width: 1, x: 0 });
  const actionNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visibleBoards = useMemo(() => boards, [boards]);
  const totalSoundCount = useMemo(
    () => visibleBoards.reduce((total, board) => total + board.sounds.length, 0),
    [visibleBoards],
  );
  const selectedBoard = useMemo(
    () => visibleBoards.find((board) => board.id === selectedBoardId) ?? null,
    [selectedBoardId, visibleBoards],
  );
  const soundGridMetrics = useMemo(() => {
    const soundCount = selectedBoard?.sounds.length ?? 0;
    const availableWidth = Math.max(MIN_SOUND_PAD_SIZE, windowWidth - SOUND_GRID_HORIZONTAL_PADDING * 2);
    const preferredColumns = soundCount <= 4 ? 2 : 3;
    const maxColumnsByMinSize = Math.max(
      1,
      Math.floor((availableWidth + SOUND_GRID_GAP) / (MIN_SOUND_PAD_SIZE + SOUND_GRID_GAP)),
    );
    const columns = Math.max(1, Math.min(preferredColumns, maxColumnsByMinSize));
    const rawSize = (availableWidth - SOUND_GRID_GAP * (columns - 1)) / columns;
    const size = Math.floor(Math.max(MIN_SOUND_PAD_SIZE, Math.min(MAX_SOUND_PAD_SIZE, rawSize)));

    return {
      borderRadius: size < 100 ? 13 : 16,
      iconMarginTop: Math.max(10, Math.round(size * 0.14)),
      iconSize: Math.max(32, Math.min(58, Math.round(size * 0.34))),
      labelFontSize: size < 100 ? 10 : size < 130 ? 11 : 13,
      labelLineHeight: size < 100 ? 12 : size < 130 ? 13 : 15,
      padding: size < 100 ? 7 : 10,
      size,
    };
  }, [selectedBoard?.sounds.length, windowWidth]);
  useEffect(() => {
    const loadBoards = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        const defaultSeeded = await AsyncStorage.getItem(DEFAULT_SEEDED_KEY);
        const parsedBoards = stored ? JSON.parse(stored) : [];
        const cleanedBoards = Array.isArray(parsedBoards)
          ? parsedBoards.filter((board) => !['Stress 24', 'Stress 24 Local', 'StressFiles24'].includes(board?.name))
          : [];
        const normalizedBoards = cleanedBoards.map((board, index) => normalizeBoard(board, index));
        const shouldSeedDefault =
          defaultSeeded !== 'true' && !normalizedBoards.some((board) => board.id === DEFAULT_SOUNDBOARD.id);

        setBoards(shouldSeedDefault ? [DEFAULT_SOUNDBOARD, ...normalizedBoards] : normalizedBoards);

        if (shouldSeedDefault) {
          await AsyncStorage.setItem(DEFAULT_SEEDED_KEY, 'true');
        }
      } catch {
        Alert.alert('Load failed', 'Could not load saved soundboards.');
      } finally {
        setIsLoaded(true);
      }
    };

    setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
    loadBoards();

    return () => {
      if (actionNoticeTimerRef.current) {
        clearTimeout(actionNoticeTimerRef.current);
      }

      playerRef.current?.release();
    };
  }, []);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(boards)).catch(() => {
      Alert.alert('Save failed', 'Could not save soundboards.');
    });
  }, [boards, isLoaded]);

  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (boardMode === 'edit') {
      setIsManageSoundsOpen(false);
    }
  }, [boardMode, selectedBoardId]);

  useEffect(() => {
    if (!playingSoundId) {
      return;
    }

    const interval = setInterval(() => {
      const player = playerRef.current;

      if (!player) {
        return;
      }

      const duration = Number.isFinite(player.duration) ? player.duration : 0;
      const currentTime = Number.isFinite(player.currentTime) ? player.currentTime : 0;
      const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;

      setPlaybackProgress(progress);

      if (duration > 0 && currentTime >= duration - 0.05 && !player.playing) {
        setPlaybackProgress(1);
        setFinishedSoundId(playingSoundId);
        setPlayingSoundId(null);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [playingSoundId]);

  const updateBoard = (boardId: string, updater: (board: Soundboard) => Soundboard) => {
    setBoards((currentBoards) => currentBoards.map((board) => (board.id === boardId ? updater(board) : board)));
  };

  const addBoard = () => {
    const name = trimName(boardName);

    if (!name) {
      Alert.alert('Name required', 'Enter a soundboard name.');
      return;
    }

    const board: Soundboard = {
      id: createId(),
      name,
      sounds: [],
      iconIndex: boards.length % BOARD_ICON_ASSETS.length,
      colorIndex: boards.length % SOUND_PAD_COLORS.length,
    };
    setBoards((currentBoards) => [board, ...currentBoards]);
    setBoardName('');
    setShowCreatePanel(false);
    setShowSettingsPanel(false);
    setSelectedBoardId(board.id);
    setBoardMode('edit');
  };

  const addSoundToBoard = (sound: Sound) => {
    if (!selectedBoardId) {
      return;
    }

    updateBoard(selectedBoardId, (board) => ({ ...board, sounds: [sound, ...board.sounds] }));
    setSoundName('');
    setSoundUrl('');
    setActionNotice('Added');

    if (actionNoticeTimerRef.current) {
      clearTimeout(actionNoticeTimerRef.current);
    }

    actionNoticeTimerRef.current = setTimeout(() => {
      setActionNotice('');
      actionNoticeTimerRef.current = null;
    }, 1400);
  };

  const openBoard = (boardId: string) => {
    setSelectedBoardId(boardId);
    setBoardMode('play');
    setIsManageSoundsOpen(false);
  };

  const closeBoard = () => {
    setSelectedBoardId(null);
    setBoardMode('play');
  };

  const renameSound = (soundId: string, name: string) => {
    if (!selectedBoardId) {
      return;
    }

    updateBoard(selectedBoardId, (board) => ({
      ...board,
      sounds: board.sounds.map((sound) => (sound.id === soundId ? { ...sound, name } : sound)),
    }));
  };

  const renameBoard = (name: string) => {
    if (!selectedBoardId) {
      return;
    }

    updateBoard(selectedBoardId, (board) => ({ ...board, name }));
  };

  const setBoardIcon = (iconIndex: number) => {
    if (!selectedBoardId) {
      return;
    }

    updateBoard(selectedBoardId, (board) => ({ ...board, iconIndex }));
  };

  const setBoardColor = (colorIndex: number) => {
    if (!selectedBoardId) {
      return;
    }

    updateBoard(selectedBoardId, (board) => ({ ...board, colorIndex }));
  };

  const deleteSound = (sound: Sound) => {
    if (!selectedBoardId) {
      return;
    }

    Alert.alert('Delete sound', sound.name || 'Delete this sound?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          updateBoard(selectedBoardId, (board) => ({
            ...board,
            sounds: board.sounds.filter((item) => item.id !== sound.id),
          }));

          if (playingSoundId === sound.id) {
            playerRef.current?.release();
            playerRef.current = null;
            setPlayingSoundId(null);
            setFinishedSoundId(null);
            setPlaybackProgress(0);
          }
        },
      },
    ]);
  };

  const deleteBoard = () => {
    if (!selectedBoard) {
      return;
    }

    Alert.alert('Delete board?', `Delete "${selectedBoard.name}" and all sounds in this board?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const boardToDelete = selectedBoard;

          stopSound();
          setBoards((currentBoards) => currentBoards.filter((board) => board.id !== boardToDelete.id));
          setSelectedBoardId(null);
          setBoardMode('play');
          setShowCreatePanel(false);
          setShowSettingsPanel(false);

          await Promise.all(
            boardToDelete.sounds
              .filter((sound) => sound.source === 'file' && sound.uri)
              .map((sound) => FileSystemLegacy.deleteAsync(sound.uri as string, { idempotent: true }).catch(() => undefined)),
          );
        },
      },
    ]);
  };

  const importSoundFromDevice = async () => {
    if (!selectedBoardId) {
      return;
    }

    setBusyAction('file');

    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: 'audio/*',
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];
      const extension = getExtension(asset.name) || '.audio';
      const pickedName = trimName(asset.name.replace(/\.[^/.]+$/, ''));
      const name = pickedName || 'Imported sound';
      const soundDirectory = getSoundDirectory();

      if (!soundDirectory.exists) {
        soundDirectory.create({ idempotent: true, intermediates: true });
      }

      const destination = new File(soundDirectory, `${createId()}${extension}`);
      await new File(asset.uri).copy(destination, { overwrite: true });

      addSoundToBoard({
        id: createId(),
        name,
        source: 'file',
        uri: destination.uri,
      });
    } catch {
      Alert.alert('Import failed', 'Could not import this audio file.');
    } finally {
      setBusyAction(null);
    }
  };

  const addSoundFromUrl = async () => {
    const name = trimName(soundName);
    const url = soundUrl.trim();

    if (!selectedBoardId || !name) {
      Alert.alert('Sound name required', 'Enter a sound name before adding a URL.');
      return;
    }

    if (!url) {
      Alert.alert('URL required', 'Enter an audio URL or a MyInstants page URL.');
      return;
    }

    setBusyAction('url');

    try {
      const resolvedUrl = await resolveAudioUrl(url);

      if (!resolvedUrl) {
        Alert.alert('Audio URL required', 'Use a direct audio URL or a MyInstants instant page.');
        return;
      }

      addSoundToBoard({
        id: createId(),
        name,
        source: 'url',
        uri: resolvedUrl,
      });
    } catch {
      Alert.alert('URL check failed', 'Could not verify this audio URL.');
    } finally {
      setBusyAction(null);
    }
  };

  const searchSounds = async () => {
    const query = trimName(soundSearchQuery);

    if (!query) {
      Alert.alert('Search required', 'Enter a sound search term.');
      return;
    }

    Keyboard.dismiss();
    setBusyAction('search');
    setSoundSearchFeedback('');

    try {
      let results = await searchSoundSources(query);
      let feedback = '';

      if (results.length === 0) {
        for (const fallbackQuery of getSearchFallbackQueries(query)) {
          results = await searchSoundSources(fallbackQuery);

          if (results.length > 0) {
            feedback = `No exact results for "${query}". Showing similar results for "${fallbackQuery}".`;
            break;
          }
        }
      }

      const availableResults = dedupeSearchResults(results, selectedBoard?.sounds ?? []).slice(0, 24);

      setSoundSearchResults(availableResults);

      if (availableResults.length === 0) {
        const message =
          results.length > 0
            ? 'All found sounds are already in this board.'
            : `No soundboard sounds found for "${query}". Try a shorter name, another meme keyword, or paste a URL.`;
        setSoundSearchFeedback(message);
        Alert.alert('No results', message);
        return;
      }

      setSoundSearchFeedback(feedback || `${availableResults.length} sounds found.`);
    } catch {
      const message = 'Could not search sounds right now. Try again or paste a URL.';
      setSoundSearchFeedback(message);
      Alert.alert('Search failed', message);
    } finally {
      setBusyAction(null);
    }
  };

  const previewSearchResult = async (result: SearchSoundResult) => {
    setBusyAction(`search-preview:${result.id}`);

    try {
      const resolvedUrl = await resolveAudioUrl(result.pageUrl);

      if (!resolvedUrl) {
        Alert.alert('Preview unavailable', 'Could not find direct audio for this result.');
        return;
      }

      playSound({
        id: `preview:${result.id}`,
        name: result.name,
        source: 'url',
        uri: resolvedUrl,
      });
    } catch {
      Alert.alert('Preview failed', 'Could not preview this sound.');
    } finally {
      setBusyAction(null);
    }
  };

  const addSoundFromSearchResult = async (result: SearchSoundResult) => {
    if (!selectedBoardId) {
      return;
    }

    setBusyAction(`search-add:${result.id}`);

    try {
      const resolvedUrl = await resolveAudioUrl(result.pageUrl);

      if (!resolvedUrl) {
        Alert.alert('Sound unavailable', 'Could not find direct audio for this result.');
        return;
      }

      addSoundToBoard({
        id: createId(),
        name: result.name,
        source: 'url',
        uri: resolvedUrl,
      });
      const addedName = normalizeSearchKey(result.name);
      const addedUrl = normalizeSearchUrl(resolvedUrl);
      setSoundSearchResults((currentResults) =>
        currentResults.filter(
          (item) =>
            item.id !== result.id &&
            normalizeSearchKey(item.name) !== addedName &&
            (!addedUrl || normalizeSearchUrl(item.pageUrl) !== addedUrl),
        ),
      );
    } catch {
      Alert.alert('Add failed', 'Could not add this sound.');
    } finally {
      setBusyAction(null);
    }
  };

  const updateVolume = (nextVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(nextVolume, 1));
    setVolume(clampedVolume);

    if (playerRef.current) {
      playerRef.current.volume = clampedVolume;
    }
  };

  const measureVolumeTrack = (onMeasured?: (metrics: { width: number; x: number }) => void) => {
    volumeTrackRef.current?.measureInWindow((x, _y, width) => {
      const metrics = { width: Math.max(width, 1), x };
      volumeTrackMetricsRef.current = metrics;
      onMeasured?.(metrics);
    });
  };

  const updateVolumeFromPageX = (pageX: number, metrics = volumeTrackMetricsRef.current) => {
    updateVolume((pageX - metrics.x) / metrics.width);
  };

  const startVolumeDrag = (event: GestureResponderEvent) => {
    const pageX = event.nativeEvent.pageX;
    measureVolumeTrack((metrics) => updateVolumeFromPageX(pageX, metrics));
  };

  const moveVolumeDrag = (event: GestureResponderEvent) => {
    updateVolumeFromPageX(event.nativeEvent.pageX);
  };

  const playSound = (sound: Sound) => {
    try {
      const source = sound.assetModule ?? sound.uri;

      if (!source) {
        Alert.alert('Playback failed', 'This sound has no usable source.');
        return;
      }

      playerRef.current?.release();
      const player = createAudioPlayer(source);
      player.volume = volume;
      playerRef.current = player;
      player.seekTo(0);
      player.play();
      setPlayingSoundId(sound.id);
      setFinishedSoundId(null);
      setPlaybackProgress(0);
    } catch {
      Alert.alert('Playback failed', 'Could not play this sound.');
    }
  };

  const stopSound = () => {
    playerRef.current?.release();
    playerRef.current = null;
    setPlayingSoundId(null);
    setFinishedSoundId(null);
    setPlaybackProgress(0);
  };

  const showUrlHelp = () => {
    Alert.alert(
      'Add sound help',
      [
        'Search: type a sound name and tap Search. Use Play to preview, then Add to save it.',
        'Import file: tap Import file and browse to an audio file, for example in Downloads. The file name is used automatically.',
        'MyInstants page URL: paste a MyInstants instant page link. The app finds the playable MP3 automatically.',
        'Direct audio URL: paste a direct .mp3, .wav, .ogg, .m4a, .aac, .opus, or .flac link.',
        'Sound name: only needed for Add URL. Search results and imported files use their own names.',
      ].join('\n\n'),
    );
  };

  const createBoardFromExport = async (payload: unknown) => {
    if (!isRecord(payload) || payload.app !== 'Soundboard' || payload.version !== 1 || !isRecord(payload.board)) {
      throw new Error('Invalid export file.');
    }

    const exportedName = trimName(String(payload.board.name ?? ''));
    const exportedSounds = payload.board.sounds;

    if (!exportedName || !Array.isArray(exportedSounds)) {
      throw new Error('Invalid export file.');
    }

    const soundDirectory = getSoundDirectory();

    if (!soundDirectory.exists) {
      soundDirectory.create({ idempotent: true, intermediates: true });
    }

    const importedSounds: Sound[] = [];
    const iconIndex = normalizeIndex(payload.board.iconIndex, 0, BOARD_ICON_ASSETS.length);
    const colorIndex = normalizeIndex(payload.board.colorIndex, 0, SOUND_PAD_COLORS.length);

    for (const exportedSound of exportedSounds) {
      if (!isRecord(exportedSound)) {
        throw new Error('Invalid sound in export.');
      }

      const name = trimName(String(exportedSound.name ?? ''));
      const source = exportedSound.source;

      if (!name) {
        throw new Error('Invalid sound in export.');
      }

      if (source === 'url') {
        const uri = String(exportedSound.uri ?? '');

        if (!uri) {
          throw new Error('Invalid URL sound in export.');
        }

        importedSounds.push({ id: createId(), name, source: 'url', uri });
        continue;
      }

      if (source === 'file') {
        const base64 = String(exportedSound.base64 ?? '');
        const fileName = String(exportedSound.fileName ?? '');
        const extension = getExtension(fileName) || '.audio';

        if (!base64) {
          throw new Error('Invalid file sound in export.');
        }

        const destination = new File(soundDirectory, `${createId()}${extension}`);
        await FileSystemLegacy.writeAsStringAsync(destination.uri, base64, {
          encoding: FileSystemLegacy.EncodingType.Base64,
        });

        importedSounds.push({ id: createId(), name, source: 'file', uri: destination.uri });
        continue;
      }

      throw new Error('Unsupported sound in export.');
    }

    return {
      id: createId(),
      name: exportedName,
      sounds: importedSounds,
      iconIndex,
      colorIndex,
    };
  };

  const importBoard = async () => {
    setBusyAction('import');

    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: ['application/json', 'text/*', '*/*'],
      });

      if (result.canceled) {
        return;
      }

      const text = (await new File(result.assets[0].uri).text()).replace(/^\uFEFF/, '');
      const importedBoard = await createBoardFromExport(JSON.parse(text));

      setBoards((currentBoards) => [importedBoard, ...currentBoards]);
      setSelectedBoardId(importedBoard.id);
      setBoardMode('play');
      setShowSettingsPanel(false);
      setShowCreatePanel(false);
    } catch {
      Alert.alert('Import failed', 'Choose a valid .soundboard.json export file.');
    } finally {
      setBusyAction(null);
    }
  };

  const exportBoard = async () => {
    if (!selectedBoard) {
      return;
    }

    setBusyAction('export');

    try {
      const exportedSounds: ExportedSound[] = [];

      for (const sound of selectedBoard.sounds) {
        if (sound.source === 'url' && sound.uri) {
          exportedSounds.push({ name: sound.name, source: 'url', uri: sound.uri });
          continue;
        }

        if (sound.source === 'file' && sound.uri) {
          const file = new File(sound.uri);

          if (!file.exists) {
            throw new Error('Missing audio file.');
          }

          exportedSounds.push({
            name: sound.name,
            source: 'file',
            fileName: file.name,
            mimeType: file.type || 'audio/*',
            base64: await file.base64(),
          });
          continue;
        }

        throw new Error('Unsupported sound source.');
      }

      const payload: ExportedSoundboard = {
        app: 'Soundboard',
        version: 1,
        exportedAt: new Date().toISOString(),
        board: {
          name: selectedBoard.name,
          sounds: exportedSounds,
          iconIndex: getBoardIconIndex(selectedBoard, 0),
          colorIndex: getBoardColorIndex(selectedBoard, 0),
        },
      };
      const exportFile = new File(Paths.cache, getExportFileName(selectedBoard.name));

      if (exportFile.exists) {
        exportFile.delete();
      }

      exportFile.create();
      exportFile.write(JSON.stringify(payload, null, 2));

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(exportFile.uri, {
          dialogTitle: 'Export soundboard',
          mimeType: 'application/json',
        });
      } else {
        Alert.alert('Export ready', exportFile.uri);
      }

    } catch {
      Alert.alert('Export failed', 'Could not export this board.');
    } finally {
      setBusyAction(null);
    }
  };

  const renderBoardList = () => (
    <View style={styles.listSection}>
      {renderBoardRail()}

      <View style={styles.screenTopBar}>
        <Text style={styles.screenTitle}>
          {visibleBoards.length} boards · {totalSoundCount} sounds
        </Text>
        <View style={styles.topBarActions}>
          <Pressable
            accessibilityLabel="Create soundboard"
            onPress={() => {
              setShowCreatePanel((value) => !value);
              setShowSettingsPanel(false);
            }}
            style={[styles.iconButton, showCreatePanel && styles.iconButtonActive]}
          >
            <Text style={[styles.iconButtonText, showCreatePanel && styles.iconButtonTextActive]}>
              {showCreatePanel ? 'x' : '+'}
            </Text>
          </Pressable>
        </View>
      </View>

      {showSettingsPanel && (
        <View style={styles.settingsPanel}>
          <View style={styles.settingsHeaderRow}>
            <Image source={UI_ASSETS.settings} style={styles.settingsHeaderIcon} />
            <Text style={styles.sectionTitle}>Settings</Text>
          </View>
          <Pressable
            disabled={busyAction !== null}
            onPress={importBoard}
            style={[styles.settingsRow, busyAction !== null && styles.disabledButton]}
          >
            <Text style={styles.settingsRowText}>{busyAction === 'import' ? 'Importing...' : 'Import board'}</Text>
            <Text style={styles.settingsRowArrow}>&gt;</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setShowCreatePanel(true);
              setShowSettingsPanel(false);
            }}
            style={styles.settingsRow}
          >
            <Text style={styles.settingsRowText}>New board</Text>
            <Text style={styles.settingsRowArrow}>&gt;</Text>
          </Pressable>
        </View>
      )}

      {showCreatePanel && (
        <View style={styles.createPanel}>
          <Text style={styles.sectionTitle}>New board</Text>
          <TextInput
            accessibilityLabel="Soundboard name"
            onChangeText={setBoardName}
            onSubmitEditing={addBoard}
            placeholder="Board name"
            returnKeyType="done"
            style={styles.input}
            value={boardName}
          />
          <Pressable onPress={addBoard} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Create</Text>
          </Pressable>
        </View>
      )}

      <FlatList
        contentContainerStyle={styles.boardList}
        data={visibleBoards}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.emptyText}>No soundboards yet.</Text>}
        renderItem={({ item, index }) => {
          const boardColor = getBoardColor(item, index);
          const boardIconIndex = getBoardIconIndex(item, index);

          return (
          <Pressable
            onPress={() => openBoard(item.id)}
            style={[styles.boardItem, { borderColor: boardColor }]}
          >
            <View style={styles.boardInfo}>
              <View style={[styles.boardIconBadge, { borderColor: boardColor }]}>
                <Image
                  source={BOARD_ICON_ASSETS[boardIconIndex]}
                  style={[
                    styles.boardIconImage,
                    { tintColor: boardColor },
                  ]}
                />
                <Text style={styles.boardIconText}>{(item.name.trim()[0] ?? 'B').toUpperCase()}</Text>
              </View>
              <View style={styles.boardTextBlock}>
                <Text numberOfLines={1} style={styles.boardName}>
                  {item.name}
                </Text>
                <View style={styles.boardMetaRow}>
                  <Text style={styles.metaText}>
                    {item.sounds.length} {item.sounds.length === 1 ? 'sound' : 'sounds'}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.openPill}>
              <Text style={styles.openText}>&gt;</Text>
            </View>
          </Pressable>
          );
        }}
      />

      <View style={styles.homeControlDock}>
        <Pressable
          accessibilityLabel="Create soundboard"
          onPress={() => {
            setShowCreatePanel(true);
            setShowSettingsPanel(false);
          }}
          style={styles.addDockButton}
        >
          <Text style={styles.addDockPlus}>+</Text>
          <Text style={styles.addDockText}>Add</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderWaveMark = () => (
    <View style={styles.waveMark}>
      {[22, 34, 48, 58, 44, 30, 18].map((height, index) => (
        <View key={`${height}-${index}`} style={[styles.waveBar, { height }]} />
      ))}
    </View>
  );

  const renderBoardRail = () => (
    <ScrollView
      contentContainerStyle={styles.boardRailContent}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.boardRail}
    >
      {visibleBoards.map((board, index) => {
        const active = board.id === selectedBoard?.id;
        const boardColor = getBoardColor(board, index);
        const boardIconIndex = getBoardIconIndex(board, index);

        return (
          <Pressable
            accessibilityLabel={board.name}
            key={board.id}
            onPress={() => openBoard(board.id)}
            style={[styles.boardRailItem, active && styles.boardRailItemActive]}
          >
            <Image
              source={BOARD_ICON_ASSETS[boardIconIndex]}
              style={[
                styles.boardRailIconImage,
                { tintColor: active ? '#42f5ff' : boardColor },
              ]}
            />
            <Text style={[styles.boardRailIcon, active && styles.boardRailIconActive]}>
              {BOARD_ICONS[boardIconIndex]}
            </Text>
            <View style={[styles.miniProgressTrack, active && styles.miniProgressTrackActive]} />
          </Pressable>
        );
      })}
    </ScrollView>
  );

  const renderPlayerDock = () => (
    <View style={styles.playerDock}>
      <View style={styles.volumeRow}>
        <Image source={UI_ASSETS.volume} style={styles.volumeIconImage} />
        <View
          ref={volumeTrackRef}
          accessibilityLabel="Volume"
          collapsable={false}
          onLayout={() => requestAnimationFrame(() => measureVolumeTrack())}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={startVolumeDrag}
          onResponderMove={moveVolumeDrag}
          onResponderTerminationRequest={() => false}
          onStartShouldSetResponder={() => true}
          onStartShouldSetResponderCapture={() => true}
          style={styles.volumeTrack}
        >
          <View style={[styles.volumeFill, { width: `${volume * 100}%` }]} />
          <View style={[styles.volumeThumb, { left: `${Math.max(0.03, Math.min(volume, 0.97)) * 100}%` }]} />
        </View>
        <Text style={styles.volumeText}>{Math.round(volume * 100)}%</Text>
      </View>
    </View>
  );

  const renderBoardDetail = () => {
    if (!selectedBoard) {
      return null;
    }

    const renderManageSounds = () => (
      <View style={styles.addPanel}>
        <Pressable
          accessibilityLabel="Manage sounds"
          onPress={() => setIsManageSoundsOpen((isOpen) => !isOpen)}
          style={styles.manageSoundsToggle}
        >
          <View>
            <Text style={styles.sectionTitle}>Manage sounds</Text>
            <Text style={styles.manageSoundsMeta}>
              {selectedBoard.sounds.length} {selectedBoard.sounds.length === 1 ? 'sound' : 'sounds'}
            </Text>
          </View>
          <Text style={styles.manageSoundsChevron}>{isManageSoundsOpen ? '^' : 'v'}</Text>
        </Pressable>
        {isManageSoundsOpen && (
          selectedBoard.sounds.length === 0 ? (
            <View style={styles.emptyPanel}>
              <Text style={styles.emptyTitle}>No sounds</Text>
            </View>
          ) : (
            <View style={styles.editList}>
              {selectedBoard.sounds.map((sound) => (
                <View key={sound.id} style={styles.editSoundItem}>
                  <TextInput
                    accessibilityLabel="Sound name"
                    onChangeText={(value) => renameSound(sound.id, value)}
                    placeholder="Sound name"
                    style={[styles.input, styles.editSoundInput]}
                    value={sound.name}
                  />
                  <Pressable onPress={() => deleteSound(sound)} style={styles.deleteButton}>
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )
        )}
      </View>
    );

    return (
      <View style={styles.detailScreen}>
      <ScrollView
        ref={detailScrollRef}
        contentContainerStyle={[styles.detailContent, boardMode === 'play' && styles.detailContentWithDock]}
        keyboardShouldPersistTaps="handled"
        style={styles.detailScroll}
      >
        {boardMode === 'play' ? (
          <View style={styles.playTopBar}>
            <View style={styles.playTitleBlock}>
              <Text numberOfLines={1} style={styles.playBoardTitle}>
                {selectedBoard.name}
              </Text>
              <Text style={styles.playBoardMeta}>
                {selectedBoard.sounds.length} {selectedBoard.sounds.length === 1 ? 'sound' : 'sounds'}
              </Text>
            </View>
            <Pressable onPress={() => setBoardMode('edit')} style={styles.editButton}>
              <Text style={styles.editButtonText}>Manage</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.detailHero}>
            <View style={styles.detailActionRow}>
              <Pressable onPress={() => setBoardMode('play')} style={styles.backButton}>
                <Text style={styles.backButtonText}>Done</Text>
              </Pressable>
            </View>

            <Text numberOfLines={2} style={styles.title}>
              Edit board
            </Text>

            <View style={styles.detailMetaRow}>
              <Text style={styles.metaPill}>
                {selectedBoard.sounds.length} {selectedBoard.sounds.length === 1 ? 'sound' : 'sounds'}
              </Text>
            </View>
          </View>
        )}

        {boardMode === 'play' ? (
          <>
            <View style={styles.soundSection}>
              {selectedBoard.sounds.length === 0 ? (
                <View style={styles.emptyPanel}>
                  <Text style={styles.emptyTitle}>No sounds</Text>
                  <Pressable onPress={() => setBoardMode('edit')} style={styles.primaryButton}>
                    <Text style={styles.primaryButtonText}>Edit board</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.soundGrid}>
                  {selectedBoard.sounds.map((sound, index) => {
                    const isPlaying = playingSoundId === sound.id;
                    const isFinished = finishedSoundId === sound.id;
                    const progress = isPlaying ? playbackProgress : isFinished ? 1 : 0;
                    const color = SOUND_PAD_COLORS[index % SOUND_PAD_COLORS.length];

                    return (
                      <Pressable
                        key={sound.id}
                        onPress={() => playSound(sound)}
                        style={[
                          styles.soundButton,
                          {
                            borderColor: color,
                            borderRadius: soundGridMetrics.borderRadius,
                            height: soundGridMetrics.size,
                            padding: soundGridMetrics.padding,
                            width: soundGridMetrics.size,
                          },
                          isPlaying && styles.playingSoundButton,
                          isFinished && styles.finishedSoundButton,
                        ]}
                      >
                        <View style={[styles.padGlow, { backgroundColor: color }]} />
                        <Image
                          source={getSoundIconAsset(sound, index)}
                          style={[
                            styles.soundButtonIconImage,
                            {
                              height: soundGridMetrics.iconSize,
                              marginTop: soundGridMetrics.iconMarginTop,
                              tintColor: color,
                              width: soundGridMetrics.iconSize,
                            },
                          ]}
                        />
                        <View style={styles.soundButtonTextBlock}>
                          <Text
                            numberOfLines={2}
                            style={[
                              styles.soundButtonText,
                              {
                                fontSize: soundGridMetrics.labelFontSize,
                                lineHeight: soundGridMetrics.labelLineHeight,
                              },
                            ]}
                          >
                            {sound.name}
                          </Text>
                        </View>
                        {(isPlaying || isFinished) && (
                          <View style={styles.progressTrack}>
                            <View style={[styles.progressFill, { backgroundColor: color, width: `${Math.max(progress * 100, 4)}%` }]} />
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={styles.playerDockSpacer} />
          </>
        ) : (
          <View>
            {renderManageSounds()}

            <View style={styles.addPanel}>
                <View style={styles.addPanelHeader}>
                  <Text style={styles.sectionTitle}>Add sound</Text>
                  <Pressable accessibilityLabel="Add sound help" onPress={showUrlHelp} style={styles.infoButton}>
                    <Text style={styles.infoButtonText}>i</Text>
                  </Pressable>
                </View>
                <TextInput
                  accessibilityLabel="Search sounds"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={(value) => {
                    setSoundSearchQuery(value);
                    setSoundSearchFeedback('');
                  }}
                  onSubmitEditing={searchSounds}
                  placeholder="Search sounds"
                  returnKeyType="search"
                  style={styles.input}
                  submitBehavior="submit"
                  value={soundSearchQuery}
                />
                <Pressable
                  disabled={busyAction !== null}
                  onPress={searchSounds}
                  style={[styles.secondaryButton, styles.searchButton, busyAction !== null && styles.disabledButton]}
                >
                  <Text style={styles.secondaryButtonText}>{busyAction === 'search' ? 'Searching...' : 'Search'}</Text>
                </Pressable>
                {actionNotice ? <Text style={styles.actionNoticeText}>{actionNotice}</Text> : null}
                {soundSearchFeedback ? <Text style={styles.searchFeedbackText}>{soundSearchFeedback}</Text> : null}
                {soundSearchResults.length > 0 && (
                  <View style={styles.searchResults}>
                    {soundSearchResults.map((result) => {
                      const isAdding = busyAction === `search-add:${result.id}`;
                      const isPreviewing = busyAction === `search-preview:${result.id}`;

                      return (
                        <View key={result.id} style={styles.searchResultItem}>
                          <View style={styles.searchResultTextBlock}>
                            <Text numberOfLines={2} style={styles.searchResultText}>
                              {result.name}
                            </Text>
                          </View>
                          <View style={styles.searchResultActions}>
                            <Pressable
                              disabled={busyAction !== null}
                              onPress={() => previewSearchResult(result)}
                              style={[styles.previewResultButton, busyAction !== null && styles.disabledButton]}
                            >
                              <Text style={styles.previewResultButtonText}>{isPreviewing ? '...' : 'Play'}</Text>
                            </Pressable>
                            <Pressable
                              disabled={busyAction !== null}
                              onPress={() => addSoundFromSearchResult(result)}
                              style={[styles.searchResultButton, busyAction !== null && styles.disabledButton]}
                            >
                              <Text style={styles.searchResultButtonText}>{isAdding ? '...' : 'Add'}</Text>
                            </Pressable>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
                <Pressable
                  disabled={busyAction !== null}
                  onPress={importSoundFromDevice}
                  style={[styles.secondaryButton, styles.deviceButton, busyAction !== null && styles.disabledButton]}
                >
                  <Text style={styles.secondaryButtonText}>{busyAction === 'file' ? 'Importing...' : 'Import file'}</Text>
                </Pressable>

                <TextInput
                  accessibilityLabel="Sound name"
                  onChangeText={setSoundName}
                  placeholder="Sound name for URL"
                  style={styles.input}
                  value={soundName}
                />
                <TextInput
                  accessibilityLabel="Audio URL"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  onChangeText={setSoundUrl}
                  placeholder="MyInstants page URL or direct audio URL"
                  style={styles.input}
                  value={soundUrl}
                />
                <Pressable
                  disabled={busyAction !== null}
                  onPress={addSoundFromUrl}
                  style={[styles.secondaryButton, styles.urlButton, busyAction !== null && styles.disabledButton]}
                >
                  <Text style={styles.secondaryButtonText}>{busyAction === 'url' ? 'Checking...' : 'Add URL'}</Text>
                </Pressable>
            </View>

            <View style={styles.addPanel}>
                <View style={styles.settingsHeaderRow}>
                  <Image source={UI_ASSETS.settings} style={styles.settingsHeaderIcon} />
                  <Text style={styles.sectionTitle}>Board settings</Text>
                </View>
                <TextInput
                  accessibilityLabel="Board name"
                  onChangeText={renameBoard}
                  placeholder="Board name"
                  style={styles.input}
                  value={selectedBoard.name}
                />
                <Text style={styles.settingsLabel}>Logo</Text>
                <View style={styles.logoGrid}>
                  {BOARD_ICON_ASSETS.map((asset, iconIndex) => {
                    const active = getBoardIconIndex(selectedBoard, 0) === iconIndex;
                    const color = getBoardColor(selectedBoard, 0);

                    return (
                      <Pressable
                        accessibilityLabel={`Logo ${iconIndex + 1}`}
                        key={`logo-${iconIndex}`}
                        onPress={() => setBoardIcon(iconIndex)}
                        style={[styles.logoChoice, active && { borderColor: color }]}
                      >
                        <Image source={asset} style={[styles.logoChoiceImage, { tintColor: active ? color : '#8fa0a8' }]} />
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.settingsLabel}>Color</Text>
                <View style={styles.colorGrid}>
                  {SOUND_PAD_COLORS.map((color, colorIndex) => {
                    const active = getBoardColorIndex(selectedBoard, 0) === colorIndex;

                    return (
                      <Pressable
                        accessibilityLabel={`Color ${colorIndex + 1}`}
                        key={color}
                        onPress={() => setBoardColor(colorIndex)}
                        style={[styles.colorChoice, { backgroundColor: color }, active && styles.colorChoiceActive]}
                      />
                    );
                  })}
                </View>
                <Pressable
                  disabled={busyAction !== null}
                  onPress={exportBoard}
                  style={[styles.settingsRow, busyAction !== null && styles.disabledButton]}
                >
                  <Text style={styles.settingsRowText}>{busyAction === 'export' ? 'Exporting...' : 'Export board'}</Text>
                  <Text style={styles.settingsRowArrow}>&gt;</Text>
                </Pressable>
                <Pressable
                  disabled={busyAction !== null}
                  onPress={importBoard}
                  style={[styles.settingsRow, busyAction !== null && styles.disabledButton]}
                >
                  <Text style={styles.settingsRowText}>{busyAction === 'import' ? 'Importing...' : 'Import board'}</Text>
                  <Text style={styles.settingsRowArrow}>&gt;</Text>
                </Pressable>
                <Pressable
                  disabled={busyAction !== null}
                  onPress={deleteBoard}
                  style={[styles.settingsRow, styles.dangerSettingsRow, busyAction !== null && styles.disabledButton]}
                >
                  <Text style={[styles.settingsRowText, styles.dangerSettingsRowText]}>Delete board</Text>
                  <Text style={styles.dangerSettingsRowText}>!</Text>
                </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
      {boardMode === 'play' && renderPlayerDock()}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        <ImageBackground
          imageStyle={styles.backgroundImageAsset}
          resizeMode="cover"
          source={UI_ASSETS.neonPanel}
          style={styles.backgroundImage}
        >
          <View style={styles.header}>
          {selectedBoard ? (
            <Pressable accessibilityLabel="Back" onPress={closeBoard} style={styles.headerBackButton}>
              <Image source={UI_ASSETS.back} style={styles.headerBackIcon} />
              <Text style={styles.headerBackText}>Back</Text>
            </Pressable>
          ) : (
            renderWaveMark()
          )}
            <View style={styles.appTitleBlock}>
              <Text numberOfLines={1} style={styles.appTitle}>Soundboard</Text>
            </View>
          <Pressable
            accessibilityLabel="Settings"
            onPress={() => {
              if (selectedBoard) {
                setBoardMode('edit');
                return;
              }

              setShowSettingsPanel((value) => !value);
              setShowCreatePanel(false);
            }}
            style={styles.headerSettingsButton}
          >
            <Text style={styles.headerSettingsIcon}>⚙</Text>
            <Image source={UI_ASSETS.settings} style={styles.headerSettingsIconImage} />
          </Pressable>
          </View>
          {selectedBoard ? renderBoardDetail() : renderBoardList()}
        </ImageBackground>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#050809',
  },
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
  },
  backgroundImageAsset: {
    opacity: 0.24,
  },
  header: {
    alignItems: 'center',
    backgroundColor: '#070b0d',
    borderBottomColor: '#20282c',
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 84,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  headerBackButton: {
    alignItems: 'center',
    backgroundColor: '#132126',
    borderColor: '#42f5ff',
    borderRadius: 999,
    borderWidth: 2,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 10,
    shadowColor: '#42f5ff',
    shadowOpacity: 0.45,
    shadowRadius: 10,
    width: 98,
  },
  headerBackIcon: {
    height: 21,
    tintColor: '#42f5ff',
    width: 21,
  },
  headerBackText: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '900',
  },
  waveMark: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    height: 58,
    justifyContent: 'center',
    width: 96,
  },
  waveBar: {
    backgroundColor: '#42f5ff',
    borderRadius: 999,
    shadowColor: '#42f5ff',
    shadowOpacity: 0.85,
    shadowRadius: 8,
    width: 5,
  },
  appTitleBlock: {
    flex: 1,
    alignItems: 'center',
  },
  appTitle: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0,
  },
  headerSettingsButton: {
    alignItems: 'center',
    backgroundColor: '#10181c',
    borderColor: '#2b383e',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 10,
    width: 96,
  },
  headerSettingsIcon: {
    display: 'none',
  },
  headerSettingsIconImage: {
    height: 25,
    tintColor: '#cbd5df',
    width: 25,
  },
  title: {
    color: '#f8fafc',
    fontSize: 29,
    fontWeight: '900',
    letterSpacing: 0,
  },
  listSection: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  screenTopBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  topBarActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  screenTitle: {
    color: '#aeb8c2',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  boardRail: {
    flexGrow: 0,
    height: 126,
    marginBottom: 18,
    marginTop: 12,
  },
  boardRailContent: {
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 2,
    paddingVertical: 8,
  },
  boardRailItem: {
    alignItems: 'center',
    backgroundColor: '#13191d',
    borderColor: '#293238',
    borderRadius: 18,
    borderWidth: 2,
    height: 92,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 92,
  },
  boardRailItemActive: {
    borderColor: '#42f5ff',
    shadowColor: '#42f5ff',
    shadowOpacity: 0.85,
    shadowRadius: 12,
  },
  boardRailIcon: {
    display: 'none',
  },
  boardRailIconActive: {
    display: 'none',
  },
  boardRailIconImage: {
    height: 48,
    width: 48,
  },
  miniProgressTrack: {
    backgroundColor: '#626c72',
    borderRadius: 999,
    bottom: 10,
    height: 5,
    left: 28,
    opacity: 0.7,
    position: 'absolute',
    right: 28,
  },
  miniProgressTrackActive: {
    backgroundColor: '#42f5ff',
  },
  homeSummary: {
    backgroundColor: '#121722',
    borderColor: '#263247',
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
    padding: 18,
  },
  summaryCell: {
    backgroundColor: '#171d2b',
    borderColor: '#2a354a',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: 14,
  },
  summaryTitle: {
    color: '#f8fafc',
    fontSize: 34,
    fontWeight: '900',
  },
  summaryNumber: {
    color: '#f8fafc',
    fontSize: 34,
    fontWeight: '900',
  },
  summaryText: {
    color: '#8fa0b7',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: '#00b4d8',
    borderRadius: 999,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  iconButtonActive: {
    backgroundColor: '#20283a',
  },
  iconButtonText: {
    color: '#061018',
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 36,
  },
  iconButtonTextActive: {
    color: '#f8fafc',
  },
  settingsButton: {
    alignItems: 'center',
    backgroundColor: '#171d2b',
    borderColor: '#2a354a',
    borderWidth: 1,
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 54,
    width: 54,
  },
  settingsButtonActive: {
    backgroundColor: '#ff4d6d',
    borderColor: '#ff4d6d',
  },
  settingsButtonText: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 24,
  },
  settingsButtonTextActive: {
    color: '#ffffff',
  },
  createPanel: {
    backgroundColor: '#101619',
    borderColor: '#2a363d',
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    marginBottom: 14,
    padding: 14,
  },
  settingsPanel: {
    backgroundColor: '#101619',
    borderColor: '#42f5ff',
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    marginBottom: 14,
    padding: 14,
    shadowColor: '#42f5ff',
    shadowOpacity: 0.25,
    shadowRadius: 14,
  },
  settingsHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 2,
  },
  settingsHeaderIcon: {
    height: 26,
    tintColor: '#42f5ff',
    width: 26,
  },
  settingsRow: {
    alignItems: 'center',
    backgroundColor: '#131d22',
    borderColor: '#2b383e',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 58,
    paddingHorizontal: 16,
  },
  settingsRowText: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '900',
  },
  settingsRowArrow: {
    color: '#42f5ff',
    fontSize: 24,
    fontWeight: '900',
  },
  dangerSettingsRow: {
    borderColor: '#ff4d6d',
  },
  dangerSettingsRowText: {
    color: '#ff6b85',
    fontWeight: '900',
  },
  settingsLabel: {
    color: '#8fa0b7',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  logoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  logoChoice: {
    alignItems: 'center',
    backgroundColor: '#121a1f',
    borderColor: '#2b383e',
    borderRadius: 12,
    borderWidth: 2,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  logoChoiceImage: {
    height: 30,
    width: 30,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorChoice: {
    borderColor: '#f8fafc',
    borderRadius: 999,
    borderWidth: 0,
    height: 34,
    width: 34,
  },
  colorChoiceActive: {
    borderWidth: 3,
  },
  boardList: {
    gap: 12,
    paddingBottom: 142,
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0,
  },
  input: {
    backgroundColor: '#0d1018',
    borderColor: '#2a354a',
    borderRadius: 8,
    borderWidth: 1,
    color: '#f8fafc',
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#00b4d8',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 54,
  },
  primaryButtonText: {
    color: '#061018',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 12,
    minHeight: 54,
    paddingHorizontal: 16,
  },
  deviceButton: {
    backgroundColor: '#14b8a6',
  },
  urlButton: {
    backgroundColor: '#8b5cf6',
  },
  searchButton: {
    backgroundColor: '#22dce8',
  },
  importButton: {
    backgroundColor: '#8b5cf6',
  },
  exportButton: {
    backgroundColor: '#00b4d8',
  },
  secondaryButtonText: {
    color: '#061018',
    fontSize: 16,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.6,
  },
  boardItem: {
    alignItems: 'center',
    backgroundColor: '#101619',
    borderColor: '#2a363d',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 104,
    padding: 16,
  },
  featuredBoardItem: {
    backgroundColor: '#121b1d',
    borderColor: '#42f5ff',
    shadowColor: '#42f5ff',
    shadowOpacity: 0.45,
    shadowRadius: 10,
  },
  boardInfo: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  boardIconBadge: {
    alignItems: 'center',
    backgroundColor: '#171f23',
    borderColor: '#313d44',
    borderRadius: 14,
    borderWidth: 1,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  featuredBoardIcon: {
    backgroundColor: '#42f5ff',
    borderColor: '#42f5ff',
  },
  boardIconText: {
    display: 'none',
  },
  boardIconImage: {
    height: 32,
    width: 32,
  },
  boardTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  boardName: {
    color: '#f8fafc',
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: 0,
  },
  metaText: {
    color: '#8fa0b7',
    fontSize: 14,
  },
  boardMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 7,
  },
  openPill: {
    alignItems: 'center',
    backgroundColor: '#20283a',
    borderRadius: 999,
    justifyContent: 'center',
    height: 42,
    width: 42,
  },
  openText: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '800',
  },
  detailScreen: {
    flex: 1,
  },
  detailScroll: {
    flex: 1,
  },
  detailContent: {
    paddingBottom: 26,
  },
  detailContentWithDock: {
    paddingBottom: 116,
  },
  detailHero: {
    backgroundColor: '#101619',
    borderColor: '#2a363d',
    borderRadius: 18,
    borderWidth: 1,
    marginHorizontal: 14,
    marginTop: 2,
    padding: 16,
  },
  detailActionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  playTopBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 10,
    marginTop: 2,
  },
  playTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  playBoardTitle: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0,
  },
  playBoardMeta: {
    color: '#8fa0b7',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 3,
    textTransform: 'uppercase',
  },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#1b2429',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  backButtonText: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '800',
  },
  editButton: {
    alignItems: 'center',
    backgroundColor: '#42f5ff',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 38,
    minWidth: 78,
    paddingHorizontal: 14,
  },
  editButtonText: {
    color: '#061018',
    fontSize: 14,
    fontWeight: '800',
  },
  detailMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  metaPill: {
    backgroundColor: '#1b2429',
    borderRadius: 999,
    color: '#b7c4d8',
    fontSize: 13,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  addPanel: {
    backgroundColor: '#101619',
    borderColor: '#2a363d',
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    marginHorizontal: 16,
    marginTop: 18,
    padding: 14,
  },
  homeControlDock: {
    backgroundColor: '#0d1215',
    borderColor: '#222d32',
    borderRadius: 24,
    borderWidth: 1,
    bottom: 12,
    left: 14,
    padding: 14,
    position: 'absolute',
    right: 14,
    shadowColor: '#42f5ff',
    shadowOpacity: 0.25,
    shadowRadius: 14,
  },
  playerDock: {
    backgroundColor: '#0d1215',
    borderColor: '#222d32',
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    marginHorizontal: 14,
    marginBottom: 28,
    marginTop: 6,
    padding: 14,
    shadowColor: '#42f5ff',
    shadowOpacity: 0.18,
    shadowRadius: 10,
  },
  collapsedPlayerDock: {
    alignItems: 'center',
    marginBottom: 8,
  },
  dockToggleButton: {
    alignItems: 'center',
    backgroundColor: '#10181c',
    borderColor: '#42f5ff',
    borderRadius: 999,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 84,
  },
  dockToggleText: {
    color: '#42f5ff',
    fontSize: 22,
    fontWeight: '900',
  },
  playerDockSpacer: {
    height: 0,
  },
  compactTransportRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  transportRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 30,
  },
  transportButton: {
    alignItems: 'center',
    backgroundColor: '#12181b',
    borderColor: '#303a40',
    borderRadius: 999,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  transportIcon: {
    color: '#f8fafc',
    fontSize: 29,
    fontWeight: '900',
  },
  transportIconImage: {
    height: 22,
    tintColor: '#f8fafc',
    width: 22,
  },
  stopButton: {
    alignItems: 'center',
    backgroundColor: '#11181b',
    borderColor: '#42f5ff',
    borderRadius: 999,
    borderWidth: 2,
    height: 58,
    justifyContent: 'center',
    shadowColor: '#42f5ff',
    shadowOpacity: 0.55,
    shadowRadius: 10,
    width: 58,
  },
  stopIcon: {
    color: '#f8fafc',
    fontSize: 32,
    fontWeight: '900',
  },
  stopIconImage: {
    height: 24,
    tintColor: '#f8fafc',
    width: 24,
  },
  miniDockButton: {
    alignItems: 'center',
    backgroundColor: '#12181b',
    borderColor: '#303a40',
    borderRadius: 999,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    minWidth: 44,
    paddingHorizontal: 10,
  },
  miniDockButtonText: {
    color: '#cbd5df',
    fontSize: 13,
    fontWeight: '900',
  },
  miniAddButton: {
    alignItems: 'center',
    backgroundColor: '#22dce8',
    borderColor: '#6ff8ff',
    borderRadius: 999,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  miniAddText: {
    color: '#061012',
    fontSize: 32,
    fontWeight: '600',
    lineHeight: 36,
  },
  volumeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
    minHeight: 60,
  },
  volumeIcon: {
    color: '#f8fafc',
    fontSize: 26,
    fontWeight: '900',
  },
  volumeIconImage: {
    height: 28,
    tintColor: '#f8fafc',
    width: 28,
  },
  volumeTrack: {
    backgroundColor: '#242d32',
    borderColor: '#344147',
    borderWidth: 1,
    borderRadius: 999,
    flex: 1,
    height: 44,
    justifyContent: 'center',
    overflow: 'visible',
  },
  volumeFill: {
    backgroundColor: '#22dce8',
    borderRadius: 999,
    height: 10,
  },
  volumeThumb: {
    backgroundColor: '#22dce8',
    borderColor: '#6ff8ff',
    borderRadius: 999,
    borderWidth: 2,
    height: 34,
    position: 'absolute',
    top: 5,
    transform: [{ translateX: -17 }],
    width: 34,
    shadowColor: '#42f5ff',
    shadowOpacity: 0.75,
    shadowRadius: 8,
  },
  volumeText: {
    color: '#cbd5df',
    fontSize: 15,
    fontWeight: '900',
    minWidth: 50,
    textAlign: 'right',
  },
  addDockButton: {
    alignItems: 'center',
    backgroundColor: '#22dce8',
    borderColor: '#6ff8ff',
    borderRadius: 999,
    borderWidth: 2,
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'center',
    minHeight: 70,
    shadowColor: '#42f5ff',
    shadowOpacity: 0.75,
    shadowRadius: 16,
  },
  addDockPlus: {
    color: '#061012',
    fontSize: 42,
    fontWeight: '500',
    lineHeight: 46,
  },
  addDockText: {
    color: '#061012',
    fontSize: 24,
    fontWeight: '900',
  },
  soundSection: {
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  addPanelHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  manageSoundsToggle: {
    alignItems: 'center',
    backgroundColor: '#172329',
    borderColor: '#2b383e',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 72,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  manageSoundsMeta: {
    color: '#8fa0b7',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
  },
  manageSoundsChevron: {
    color: '#42f5ff',
    fontSize: 24,
    fontWeight: '900',
  },
  infoButton: {
    alignItems: 'center',
    backgroundColor: '#172329',
    borderColor: '#42f5ff',
    borderRadius: 999,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  infoButtonText: {
    color: '#42f5ff',
    fontSize: 18,
    fontWeight: '900',
  },
  searchResults: {
    gap: 8,
  },
  searchFeedbackText: {
    color: '#8fa0b7',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  actionNoticeText: {
    alignSelf: 'flex-start',
    backgroundColor: '#123c3f',
    borderColor: '#22dce8',
    borderRadius: 999,
    borderWidth: 1,
    color: '#b7fbff',
    fontSize: 13,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  searchResultItem: {
    alignItems: 'center',
    backgroundColor: '#131d22',
    borderColor: '#2b383e',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 58,
    padding: 10,
  },
  searchResultText: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '800',
  },
  searchResultTextBlock: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  searchResultActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  previewResultButton: {
    alignItems: 'center',
    backgroundColor: '#1e2d34',
    borderColor: '#42f5ff',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 42,
    minWidth: 70,
    paddingHorizontal: 12,
  },
  previewResultButtonText: {
    color: '#42f5ff',
    fontSize: 14,
    fontWeight: '900',
  },
  searchResultButton: {
    alignItems: 'center',
    backgroundColor: '#22dce8',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 42,
    minWidth: 74,
    paddingHorizontal: 14,
  },
  searchResultButtonText: {
    color: '#061012',
    fontSize: 14,
    fontWeight: '900',
  },
  soundGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SOUND_GRID_GAP,
    justifyContent: 'center',
    marginTop: 8,
  },
  soundButton: {
    backgroundColor: '#11181c',
    borderWidth: 2,
    elevation: 5,
    justifyContent: 'space-between',
    overflow: 'hidden',
    shadowColor: '#42f5ff',
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  playingSoundButton: {
    borderColor: '#ffffff',
    borderWidth: 3,
    transform: [{ scale: 0.98 }],
  },
  finishedSoundButton: {
    borderColor: 'rgba(255,255,255,0.85)',
    borderWidth: 3,
  },
  padGlow: {
    borderRadius: 999,
    height: '84%',
    left: '-8%',
    opacity: 0.22,
    position: 'absolute',
    top: '-22%',
    width: '116%',
  },
  soundButtonIcon: {
    alignSelf: 'center',
    fontSize: 46,
    fontWeight: '900',
    lineHeight: 56,
    marginTop: 22,
    shadowColor: '#ffffff',
    shadowOpacity: 0.75,
    shadowRadius: 10,
  },
  soundButtonIconImage: {
    alignSelf: 'center',
    height: 34,
    marginTop: 14,
    shadowColor: '#ffffff',
    shadowOpacity: 0.75,
    shadowRadius: 10,
    width: 34,
  },
  soundButtonTextBlock: {
    gap: 0,
  },
  soundButtonText: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 13,
    textAlign: 'center',
  },
  progressTrack: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    bottom: 6,
    height: 5,
    left: 8,
    overflow: 'hidden',
    position: 'absolute',
    right: 8,
  },
  progressFill: {
    borderRadius: 999,
    height: '100%',
  },
  emptyPanel: {
    backgroundColor: '#121722',
    borderColor: '#263247',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    padding: 18,
  },
  emptyTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 5,
  },
  emptyText: {
    color: '#8fa0b7',
    fontSize: 15,
  },
  editList: {
    gap: 10,
    marginTop: 12,
  },
  editSoundItem: {
    alignItems: 'center',
    backgroundColor: '#121722',
    borderColor: '#263247',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 10,
  },
  editSoundInput: {
    flex: 1,
  },
  deleteButton: {
    alignItems: 'center',
    backgroundColor: '#ff4d6d',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  deleteButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
