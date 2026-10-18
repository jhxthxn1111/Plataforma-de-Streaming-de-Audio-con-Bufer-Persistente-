import { storeToRefs } from 'pinia';
import { useAudioPlayerStore } from '../stores/audioPlayer.store';

export const useAudioPlayer = () => {
    const store = useAudioPlayerStore();
    const refs = storeToRefs(store);

    return {
        ...refs,
        fetchLocalCatalog: store.fetchLocalCatalog,
        playTrack: store.playTrack,
        togglePlay: store.togglePlay,
        seek: store.seek,
        setVolume: store.setVolume,
        toggleMute: store.toggleMute,
        nextTrack: store.nextTrack,
        prevTrack: store.prevTrack,
        toggleShuffle: store.toggleShuffle,
        toggleRepeat: store.toggleRepeat,
    };
};