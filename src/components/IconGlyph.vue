<script setup lang="ts">
import { computed } from 'vue';
import type { IconName } from '@/types/player';

const props = defineProps<{ name: IconName; size?: number }>();

const paths: Record<IconName, string> = {
  play: 'M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z',
  pause: 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z',
  next: 'M6 5.5v13l9-6.5zM17 5h2v14h-2z',
  previous: 'M18 5.5v13l-9-6.5zM5 5h2v14H5z',
  volume: 'M4 9.5v5h3.5L12 18.5v-13L7.5 9.5zM15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11',
  mute: 'M4 9.5v5h3.5L12 18.5v-13L7.5 9.5zM16 9.5l5 5M21 9.5l-5 5',
  repeat: 'M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3',
  'repeat-one': 'M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3M11.5 9.5v5',
  queue: 'M4 6h12M4 12h12M4 18h8M17 15v5l4-2.5z',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  library: 'M4 5h4v14H4zM10 5h4v14h-4zM16.3 6.3l3.6-.9 3 12.6-3.6.9z',
  chart: 'M5 20v-7M12 20V5M19 20v-10',
  shield: 'M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z',
  logout: 'M10 4H5v16h5M15 8l4 4-4 4M19 12H9',
  wave: 'M3 12h2M7 8v8M11 5v14M15 9v6M19 11v2',
};

const filled = computed(() => ['play', 'pause', 'next', 'previous'].includes(props.name));
</script>

<template>
  <svg
    :width="size ?? 20"
    :height="size ?? 20"
    viewBox="0 0 24 24"
    :fill="filled ? 'currentColor' : 'none'"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="paths[name]" />
  </svg>
</template>
