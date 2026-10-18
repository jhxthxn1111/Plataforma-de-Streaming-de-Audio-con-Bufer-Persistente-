import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export interface Track {
    id: string;
    title: string;
    artist: string;
    album: string;
    fileName: string;
    sizeBytes?: number;
    coverGradient?: string;
    accentColor?: string;
}

const STORAGE_KEY = 'persistent_audio_buffer_pinia_v3';

const fallbackTracks: Track[] = [
    {
        id: 'local-track-1',
        title: 'Canción 1',
        artist: 'Archivo local (cancion.mp3)',
        album: 'Búfer Persistente • Storage Local',
        fileName: 'cancion.mp3',
        sizeBytes: 5033164,
        coverGradient: 'linear-gradient(135deg, #1e1b4b 0%, #7c3aed 50%, #ec4899 100%)',
        accentColor: '#a855f7',
    },
    {
        id: 'local-track-2',
        title: 'Canción 2',
        artist: 'Archivo local (cancion2.mp3)',
        album: 'Búfer Persistente • Storage Local',
        fileName: 'cancion2.mp3',
        sizeBytes: 5033164,
        coverGradient: 'linear-gradient(135deg, #450a0a 0%, #dc2626 55%, #f97316 100%)',
        accentColor: '#ef4444',
    },
    {
        id: 'local-track-3',
        title: 'Canción 3',
        artist: 'Archivo local (cancion3.mp3)',
        album: 'Búfer Persistente • Storage Local',
        fileName: 'cancion3.mp3',
        sizeBytes: 5033164,
        coverGradient: 'linear-gradient(135deg, #042f2e 0%, #0d9488 55%, #22d3ee 100%)',
        accentColor: '#14b8a6',
    },
    {
        id: 'local-track-4',
        title: 'Canción 4',
        artist: 'Archivo local (cancion4.mp3)',
        album: 'Búfer Persistente • Storage Local',
        fileName: 'cancion4.mp3',
        sizeBytes: 5033164,
        coverGradient: 'linear-gradient(135deg, #0f172a 0%, #2563eb 55%, #818cf8 100%)',
        accentColor: '#3b82f6',
    },
    {
        id: 'local-track-5',
        title: 'Canción 5',
        artist: 'Archivo local (cancion5.mp3)',
        album: 'Búfer Persistente • Storage Local',
        fileName: 'cancion5.mp3',
        sizeBytes: 5033164,
        coverGradient: 'linear-gradient(135deg, #14532d 0%, #16a34a 55%, #a3e635 100%)',
        accentColor: '#22c55e',
    },
];

const audio = new Audio();
audio.preload = 'metadata';
audio.crossOrigin = 'anonymous';
let listenersAttached = false;

const getCleanBaseUrl = (): string => {
    const rawBase = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:3000';
    return rawBase.replace(/\/api\/?$/, '').replace(/\/$/, '');
};

export const useAudioPlayerStore = defineStore('audioPlayer', () => {
    const catalog = ref<Track[]>(fallbackTracks);
    const currentTrack = ref<Track>(fallbackTracks[0]!);
    const isPlaying = ref<boolean>(false);
    const isBuffering = ref<boolean>(false);
    const currentTime = ref<number>(0);
    const duration = ref<number>(0);
    const bufferedPercentage = ref<number>(0);
    const volume = ref<number>(0.8);
    const isMuted = ref<boolean>(false);
    const isShuffle = ref<boolean>(false);
    const repeatMode = ref<'off' | 'all' | 'one'>('off');
    const streamError = ref<string | null>(null);
    const activeFilter = ref<'all' | 'music' | 'buffered'>('all');

    const getStreamUrl = (fileName: string): string => {
        return `${getCleanBaseUrl()}/api/audio/stream/${encodeURIComponent(fileName)}`;
    };

    const savePersistentState = () => {
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                    trackId: currentTrack.value.id,
                    currentTime: currentTime.value,
                    volume: volume.value,
                    isMuted: isMuted.value,
                    repeatMode: repeatMode.value,
                    isShuffle: isShuffle.value,
                })
            );
        } catch {
            // Ignorar errores de cuota
        }
    };

    const updateBufferProgress = () => {
        if (!audio.duration || audio.buffered.length === 0) return;
        const bufferedEnd = audio.buffered.end(audio.buffered.length - 1);
        bufferedPercentage.value = Math.min(100, Math.round((bufferedEnd / audio.duration) * 100));
    };

    const fetchLocalCatalog = async () => {
        try {
            const response = await fetch(`${getCleanBaseUrl()}/api/audio/tracks`);
            if (!response.ok) return;
            const data = await response.json();
            if (Array.isArray(data.tracks) && data.tracks.length > 0) {
                catalog.value = data.tracks;
                const currentMatch = catalog.value.find(
                    (t) => t.fileName === currentTrack.value.fileName || t.id === currentTrack.value.id
                );
                if (currentMatch) {
                    currentTrack.value = currentMatch;
                } else if (catalog.value[0]) {
                    currentTrack.value = catalog.value[0];
                }
            }
        } catch {
            // Si el backend no ha reiniciado, usa la lista de las 5 canciones locales
        }
    };

    const initAudioEngine = () => {
        if (listenersAttached) return;
        listenersAttached = true;

        let resumeTime = 0;
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                const found = catalog.value.find((t) => t.id === parsed.trackId);
                if (found) currentTrack.value = found;
                if (typeof parsed.volume === 'number') volume.value = parsed.volume;
                if (typeof parsed.isMuted === 'boolean') isMuted.value = parsed.isMuted;
                if (parsed.repeatMode) repeatMode.value = parsed.repeatMode;
                if (typeof parsed.isShuffle === 'boolean') isShuffle.value = parsed.isShuffle;
                if (typeof parsed.currentTime === 'number') resumeTime = parsed.currentTime;
            }
        } catch {
            // Ignorar JSON corrupto
        }

        audio.volume = isMuted.value ? 0 : volume.value;
        audio.src = getStreamUrl(currentTrack.value.fileName);

        audio.addEventListener('loadedmetadata', () => {
            duration.value = Number.isFinite(audio.duration) ? audio.duration : 0;
            if (resumeTime > 0 && resumeTime < audio.duration) {
                audio.currentTime = resumeTime;
                currentTime.value = resumeTime;
                resumeTime = 0;
            }
            streamError.value = null;
            updateBufferProgress();
        });

        audio.addEventListener('timeupdate', () => {
            currentTime.value = audio.currentTime;
            updateBufferProgress();
            savePersistentState();
        });

        audio.addEventListener('progress', updateBufferProgress);

        audio.addEventListener('play', () => {
            isPlaying.value = true;
            streamError.value = null;
        });

        audio.addEventListener('pause', () => {
            isPlaying.value = false;
        });

        audio.addEventListener('waiting', () => {
            isBuffering.value = true;
        });

        audio.addEventListener('canplay', () => {
            isBuffering.value = false;
        });

        audio.addEventListener('ended', () => {
            if (repeatMode.value === 'one') {
                audio.currentTime = 0;
                audio.play().catch(() => {});
            } else {
                nextTrack();
            }
        });

        audio.addEventListener('error', () => {
            isPlaying.value = false;
            isBuffering.value = false;
            streamError.value = `No se pudo cargar ${currentTrack.value.fileName} desde backend/storage.`;
        });

        fetchLocalCatalog();
    };

    const playTrack = async (trackOrFileName: Track | string) => {
        initAudioEngine();
        streamError.value = null;

        let targetTrack: Track;
        if (typeof trackOrFileName === 'string') {
            targetTrack =
                catalog.value.find((t) => t.fileName === trackOrFileName) ?? catalog.value[0]!;
        } else {
            targetTrack = trackOrFileName;
        }

        const targetUrl = getStreamUrl(targetTrack.fileName);
        const isSameTrack = currentTrack.value.id === targetTrack.id;

        if (!isSameTrack || audio.src !== targetUrl) {
            currentTrack.value = targetTrack;
            bufferedPercentage.value = 0;
            currentTime.value = 0;
            audio.src = targetUrl;
            audio.load();
        } else if (!audio.paused) {
            audio.pause();
            isPlaying.value = false;
            return;
        }

        try {
            isBuffering.value = true;
            await audio.play();
            isPlaying.value = true;
            isBuffering.value = false;
            savePersistentState();
        } catch (err) {
            isPlaying.value = false;
            isBuffering.value = false;
            streamError.value = `Error al reproducir ${targetTrack.fileName}.`;
            console.error(err);
        }
    };

    const togglePlay = async () => {
        initAudioEngine();
        streamError.value = null;

        if (!audio.src) {
            audio.src = getStreamUrl(currentTrack.value.fileName);
        }

        if (isPlaying.value && !audio.paused) {
            audio.pause();
            isPlaying.value = false;
        } else {
            try {
                isBuffering.value = true;
                await audio.play();
                isPlaying.value = true;
                isBuffering.value = false;
            } catch (err) {
                isPlaying.value = false;
                isBuffering.value = false;
                streamError.value = 'Error al reanudar el búfer de audio.';
                console.error(err);
            }
        }
    };

    const seek = (seconds: number) => {
        if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
        const clamped = Math.max(0, Math.min(seconds, audio.duration));
        audio.currentTime = clamped;
        currentTime.value = clamped;
        savePersistentState();
    };

    const setVolume = (newVolume: number) => {
        const clamped = Math.max(0, Math.min(1, newVolume));
        volume.value = clamped;
        isMuted.value = clamped === 0;
        audio.volume = clamped;
        savePersistentState();
    };

    const toggleMute = () => {
        isMuted.value = !isMuted.value;
        audio.volume = isMuted.value ? 0 : volume.value || 0.8;
        savePersistentState();
    };

    const nextTrack = () => {
        const list = catalog.value;
        if (list.length === 0) return;

        if (isShuffle.value && list.length > 1) {
            const others = list.filter((t) => t.id !== currentTrack.value.id);
            const randomTrack = others[Math.floor(Math.random() * others.length)];
            if (randomTrack) {
                playTrack(randomTrack);
                return;
            }
        }

        const currentIndex = list.findIndex((t) => t.id === currentTrack.value.id);
        const nextIndex = (currentIndex + 1) % list.length;
        const nextItem = list[nextIndex];
        if (nextItem) {
            playTrack(nextItem);
        }
    };

    const prevTrack = () => {
        if (audio.currentTime > 3) {
            seek(0);
            return;
        }
        const list = catalog.value;
        if (list.length === 0) return;
        const currentIndex = list.findIndex((t) => t.id === currentTrack.value.id);
        const prevIndex = (currentIndex - 1 + list.length) % list.length;
        const prevItem = list[prevIndex];
        if (prevItem) {
            playTrack(prevItem);
        }
    };

    const toggleShuffle = () => {
        isShuffle.value = !isShuffle.value;
        savePersistentState();
    };

    const toggleRepeat = () => {
        if (repeatMode.value === 'off') repeatMode.value = 'all';
        else if (repeatMode.value === 'all') repeatMode.value = 'one';
        else repeatMode.value = 'off';
        savePersistentState();
    };

    const progressPercentage = computed(() => {
        if (!duration.value || duration.value <= 0) return 0;
        return Math.min(100, (currentTime.value / duration.value) * 100);
    });

    initAudioEngine();

    return {
        catalog,
        currentTrack,
        isPlaying,
        isBuffering,
        currentTime,
        duration,
        bufferedPercentage,
        progressPercentage,
        volume,
        isMuted,
        isShuffle,
        repeatMode,
        streamError,
        activeFilter,
        fetchLocalCatalog,
        playTrack,
        togglePlay,
        seek,
        setVolume,
        toggleMute,
        nextTrack,
        prevTrack,
        toggleShuffle,
        toggleRepeat,
    };
});