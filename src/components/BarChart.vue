<script setup lang="ts">
import { computed } from 'vue';

export interface BarDatum {
  label: string;
  value: number;
  title: string;
}

const props = defineProps<{ data: BarDatum[]; ariaLabel: string }>();

const WIDTH = 640;
const HEIGHT = 220;
const PAD = { top: 12, right: 8, bottom: 28, left: 8 };

const max = computed(() => Math.max(...props.data.map((d) => d.value), 1));
const slot = computed(() => (WIDTH - PAD.left - PAD.right) / Math.max(props.data.length, 1));
const labelEvery = computed(() => Math.ceil(props.data.length / 10));

const bars = computed(() =>
  props.data.map((d, i) => {
    const h = (d.value / max.value) * (HEIGHT - PAD.top - PAD.bottom);
    return {
      key: `${d.label}-${i}`,
      x: PAD.left + i * slot.value + slot.value * 0.15,
      y: HEIGHT - PAD.bottom - h,
      w: slot.value * 0.7,
      h,
      label: d.label,
      title: d.title,
      showLabel: i % labelEvery.value === 0,
    };
  }),
);
</script>

<template>
  <svg class="chart" :viewBox="`0 0 ${WIDTH} ${HEIGHT}`" role="img" :aria-label="ariaLabel">
    <line :x1="PAD.left" :x2="WIDTH - PAD.right" :y1="HEIGHT - PAD.bottom" :y2="HEIGHT - PAD.bottom" class="axis" />
    <g v-for="bar in bars" :key="bar.key">
      <rect :x="bar.x" :y="bar.y" :width="bar.w" :height="Math.max(bar.h, 1)" rx="2" class="bar">
        <title>{{ bar.title }}</title>
      </rect>
      <text v-if="bar.showLabel" :x="bar.x + bar.w / 2" :y="HEIGHT - 8" text-anchor="middle" class="tick">
        {{ bar.label }}
      </text>
    </g>
  </svg>
</template>

<style scoped>
.chart {
  width: 100%;
  height: auto;
  display: block;
}
.axis {
  stroke: var(--line);
  stroke-width: 1;
}
.bar {
  fill: var(--signal);
}
.bar:hover {
  fill: var(--buffer);
}
.tick {
  fill: var(--muted);
  font-size: 11px;
  font-family: var(--font-body);
}
</style>
