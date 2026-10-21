import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { getCleanBaseUrl, getStreamUrl } from '../services/audioUrl';
import { useOfflineCacheStore } from './offlineCache.store';

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

const STORAGE_KEY = 'persistent_audio_buffer_pinia_v4';
const fallbackTracks: Track[] = [
    { id: 'local-track-1', title: 'Canción 1', artist: 'Storage Local', album: 'Búfer Persistente', fileName: 'cancion.mp3', sizeBytes: 5033164, coverGradient: 'linear-gradient(135deg, #1e1b4b 0%, #7c3aed 50%, #ec4899 100%)', accentColor: '#a855f7' }
];

const audio = new Audio();
audio.preload = 'none';
audio.crossOrigin = 'anonymous';
let listenersAttached = false;

export const useAudioPlayerStore = defineStore('audioPlayer', () => {
    const offline = useOfflineCacheStore();
    
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
    
    // Variables para el control offline
    const isFromCache = ref<boolean>(false);
    let objectUrl: string | null = null;
    let loadedTrackId: string | null = null;
    let loadToken = 0;

    // Obtiene el ticket temporal con HMAC
    const fetchSignedStreamUrl = async (fileName: string): Promise<string> => {
        try {
            const res = await fetch(`${getCleanBaseUrl()}/api/audio/ticket/${encodeURIComponent(fileName)}`);
            const data = await res.json();
            if (data.success && data.ticketUrl) {
                return `${getCleanBaseUrl()}${data.ticketUrl}`;
            }
            throw new Error('Fallo al obtener firma de seguridad');
        } catch {
            return getStreamUrl(fileName);
        }
    };

    /** Elige la fuente del audio: si está en disco usa IndexedDB; si no hay internet y no está en disco, bloquea el streaming */
    const loadSource = async (track: Track, silent = false): Promise<boolean> => {
        const token = ++loadToken;
        await offline.whenReady();

        let cachedUrl: string | null = null;
        try {
            cachedUrl = await offline.getBlobUrl(track);
        } catch {
            cachedUrl = null;
        }

        if (token !== loadToken) {
            if (cachedUrl) URL.revokeObjectURL(cachedUrl);
            return false;
        }

        if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
            objectUrl = null;
        }

        if (cachedUrl) {
            objectUrl = cachedUrl;
            isFromCache.value = true;
            bufferedPercentage.value = 100;
            audio.src = cachedUrl;
            loadedTrackId = track.id;
            audio.load();
            return true;
        }

        // BLOQUEO ESTRICTO: Si NO está descargada en disco y estamos SIN CONEXIÓN, no permitir streaming
        if (!offline.isOnline) {
            isFromCache.value = false;
            bufferedPercentage.value = 0;
            loadedTrackId = null;
            audio.pause();
            audio.removeAttribute('src');
            audio.load();
            if (!silent) {
                streamError.value = `Sin conexión: "${track.title}" no está guardada en disco. Descárgala para escucharla offline.`;
            }
            return false;
        }

        isFromCache.value = false;
        // Se usa el token HMAC para la reproducción online
        audio.src = await fetchSignedStreamUrl(track.fileName);
        loadedTrackId = track.id;
        audio.load();
        return true;
    };

    const savePersistentState = () => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                trackId: currentTrack.value.id,
                currentTime: currentTime.value,
                volume: volume.value,
                isMuted: isMuted.value,
                repeatMode: repeatMode.value,
                isShuffle: isShuffle.value,
            }));
        } catch {}
    };

    const updateBufferProgress = () => {
        if (isFromCache.value) {
            bufferedPercentage.value = 100;
            return;
        }
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
                const currentMatch = catalog.value.find(t => t.fileName === currentTrack.value.fileName || t.id === currentTrack.value.id);
                if (currentMatch) currentTrack.value = currentMatch;
                else if (catalog.value[0]) currentTrack.value = catalog.value[0];
            }
        } catch {}
    };

    const initAudioEngine = () => {
        if (listenersAttached) return;
        listenersAttached = true;
        
        let resumeTime = 0;
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                const found = catalog.value.find(t => t.id === parsed.trackId);
                if (found) currentTrack.value = found;
                if (typeof parsed.volume === 'number') volume.value = parsed.volume;
                if (typeof parsed.isMuted === 'boolean') isMuted.value = parsed.isMuted;
                if (parsed.repeatMode) repeatMode.value = parsed.repeatMode;
                if (typeof parsed.isShuffle === 'boolean') isShuffle.value = parsed.isShuffle;
                if (typeof parsed.currentTime === 'number') resumeTime = parsed.currentTime;
            }
        } catch {}

        audio.volume = isMuted.value ? 0 : volume.value;

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
        audio.addEventListener('play', () => { isPlaying.value = true; streamError.value = null; });
        audio.addEventListener('pause', () => isPlaying.value = false);
        audio.addEventListener('waiting', () => isBuffering.value = true);
        audio.addEventListener('canplay', () => isBuffering.value = false);
        
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
            streamError.value = !offline.isOnline && !isFromCache.value
                ? 'Sin conexión: descarga la canción para escucharla offline.'
                : `Error 401: Token expirado o acceso denegado para ${currentTrack.value.fileName}.`;
        });

        watch(
            () => offline.isOnline,
            async (online) => {
                if (online && streamError.value?.startsWith('Sin conexión')) {
                    streamError.value = null;
                } else if (!online && !isFromCache.value) {
                    // Si se corta el internet mientras estaba cargada o sonando por streaming, verificar si está en disco
                    let cached: string | null = null;
                    try {
                        cached = await offline.getBlobUrl(currentTrack.value);
                    } catch {
                        cached = null;
                    }

                    if (cached) {
                        const prevTime = audio.currentTime;
                        const wasPlaying = !audio.paused && isPlaying.value;
                        if (objectUrl) URL.revokeObjectURL(objectUrl);
                        objectUrl = cached;
                        isFromCache.value = true;
                        bufferedPercentage.value = 100;
                        audio.src = cached;
                        loadedTrackId = currentTrack.value.id;
                        audio.load();
                        audio.currentTime = prevTime;
                        if (wasPlaying) void audio.play().catch(() => {});
                    } else {
                        // No está en disco: cortar el streaming inmediatamente
                        const wasPlaying = !audio.paused && isPlaying.value;
                        audio.pause();
                        audio.removeAttribute('src');
                        audio.load();
                        loadedTrackId = null;
                        isPlaying.value = false;
                        isBuffering.value = false;
                        bufferedPercentage.value = 0;
                        if (wasPlaying) {
                            streamError.value = `Sin conexión: "${currentTrack.value.title}" se detuvo porque no está guardada en disco.`;
                        }
                    }
                }
            }
        );

        void loadSource(currentTrack.value, true);
        fetchLocalCatalog();
    };

    const playTrack = async (trackOrFileName: Track | string) => {
        initAudioEngine();
        streamError.value = null;

        let targetTrack = typeof trackOrFileName === 'string' 
            ? (catalog.value.find(t => t.fileName === trackOrFileName) ?? catalog.value[0]!) 
            : trackOrFileName;

        const isSameTrack = currentTrack.value.id === targetTrack.id && loadedTrackId === targetTrack.id;

        if (isSameTrack && !audio.paused && isPlaying.value) {
            audio.pause();
            isPlaying.value = false;
            return;
        }

        // Recargar y validar fuente siempre que cambie de pista, estemos offline o aún no venga de caché
        if (!isSameTrack || !offline.isOnline || !isFromCache.value) {
            const previousTime = isSameTrack ? audio.currentTime : 0;
            audio.pause();
            currentTrack.value = targetTrack;
            if (!isSameTrack) {
                bufferedPercentage.value = 0;
                currentTime.value = 0;
            }
            const canPlay = await loadSource(targetTrack);
            if (!canPlay) {
                isPlaying.value = false;
                isBuffering.value = false;
                return;
            }
            if (isSameTrack && previousTime > 0) {
                audio.currentTime = previousTime;
            }
        }

        isBuffering.value = true;
        try {
            await audio.play();
            isPlaying.value = true;
            isBuffering.value = false;
            savePersistentState();
            if (offline.autoCache && offline.isOnline) void offline.download(targetTrack);
        } catch (err) {
            isPlaying.value = false;
            isBuffering.value = false;
            streamError.value = !offline.isOnline && !isFromCache.value
                ? `Sin conexión: "${targetTrack.title}" no está guardada en disco.`
                : `Error al reproducir ${targetTrack.fileName}.`;
        }
    };

    const togglePlay = async () => {
        if (isPlaying.value && !audio.paused) {
            audio.pause();
            isPlaying.value = false;
        } else {
            await playTrack(currentTrack.value);
        }
    };

    // Función que apaga por completo el motor al salir de la AppNav
    const stopAudio = () => {
        audio.pause();
        audio.currentTime = 0;
        isPlaying.value = false;
        isBuffering.value = false;
        currentTime.value = 0;
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
        if (catalog.value.length === 0) return;
        if (isShuffle.value && catalog.value.length > 1) {
            const others = catalog.value.filter(t => t.id !== currentTrack.value.id);
            playTrack(others[Math.floor(Math.random() * others.length)]!);
            return;
        }
        const currentIndex = catalog.value.findIndex(t => t.id === currentTrack.value.id);
        const nextItem = catalog.value[(currentIndex + 1) % catalog.value.length];
        if (nextItem) playTrack(nextItem);
    };

    const prevTrack = () => {
        if (audio.currentTime > 3) { seek(0); return; }
        if (catalog.value.length === 0) return;
        const currentIndex = catalog.value.findIndex(t => t.id === currentTrack.value.id);
        const prevItem = catalog.value[(currentIndex - 1 + catalog.value.length) % catalog.value.length];
        if (prevItem) playTrack(prevItem);
    };

    const toggleShuffle = () => { isShuffle.value = !isShuffle.value; savePersistentState(); };
    const toggleRepeat = () => {
        repeatMode.value = repeatMode.value === 'off' ? 'all' : (repeatMode.value === 'all' ? 'one' : 'off');
        savePersistentState();
    };

    const progressPercentage = computed(() => {
        if (!duration.value || duration.value <= 0) return 0;
        return Math.min(100, (currentTime.value / duration.value) * 100);
    });

    initAudioEngine();

    return {
        catalog, currentTrack, isPlaying, isBuffering, currentTime, duration, bufferedPercentage, progressPercentage, volume, isMuted, isShuffle, repeatMode, streamError, activeFilter, isFromCache,
        fetchLocalCatalog, playTrack, togglePlay, stopAudio, seek, setVolume, toggleMute, nextTrack, prevTrack, toggleShuffle, toggleRepeat,
    };
});