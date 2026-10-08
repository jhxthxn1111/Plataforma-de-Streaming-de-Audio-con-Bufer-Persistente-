<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ hue: number; seed: string; size?: number }>();

const bars = computed(() => {
  let hash = 0;
  for (const ch of props.seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return Array.from({ length: 5 }, (_, i) => 24 + ((hash >>> (i * 5)) & 31) * 2);
});
const px = computed(() => `${props.size ?? 44}px`);
</script>

<template>
  <svg
    class="cover"
    :style="{ width: px, height: px }"
    viewBox="0 0 100 100"
    role="img"
    aria-hidden="true"
  >
    <rect width="100" height="100" :fill="`hsl(${hue} 38% 30%)`" />
    <rect
      v-for="(h, i) in bars"
      :key="i"
      :x="14 + i * 16"
      :y="(100 - h) / 2"
      width="10"
      :height="h"
      rx="5"
      :fill="`hsl(${hue} 70% 84%)`"
    />
  </svg>
</template>

<style scoped>
.cover {
  flex: none;
  border-radius: var(--radius-sm);
  display: block;
}
</style>
