<script setup lang="ts">
import { computed, ref } from 'vue';
import type { BufferedRange } from '@/types/player';
import { toSegments } from '@/utils/buffer';
import { formatTime } from '@/utils/format';

const props = defineProps<{
  position: number;
  duration: number;
  ranges: BufferedRange[];
  disabled?: boolean;
  tall?: boolean;
}>();
const emit = defineEmits<{ seek: [seconds: number] }>();

const root = ref<HTMLElement | null>(null);
const dragRatio = ref<number | null>(null);

const ratio = computed(() => {
  if (dragRatio.value !== null) return dragRatio.value;
  return props.duration > 0 ? Math.min(props.position / props.duration, 1) : 0;
});
const segments = computed(() => toSegments(props.ranges, props.duration));
const valueText = computed(
  () => `${formatTime(ratio.value * props.duration)} de ${formatTime(props.duration)}`,
);

function ratioFromEvent(event: PointerEvent): number {
  const rect = root.value?.getBoundingClientRect();
  if (!rect || rect.width === 0) return 0;
  return Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
}

function onPointerDown(event: PointerEvent): void {
  if (props.disabled || props.duration <= 0) return;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  dragRatio.value = ratioFromEvent(event);
}
function onPointerMove(event: PointerEvent): void {
  if (dragRatio.value === null) return;
  dragRatio.value = ratioFromEvent(event);
}
function onPointerUp(event: PointerEvent): void {
  if (dragRatio.value === null) return;
  const target = ratioFromEvent(event) * props.duration;
  dragRatio.value = null;
  emit('seek', target);
}

function onKeydown(event: KeyboardEvent): void {
  if (props.disabled || props.duration <= 0) return;
  const step = event.shiftKey ? 15 : 5;
  if (event.key === 'ArrowRight' || event.key === 'ArrowUp') emit('seek', props.position + step);
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') emit('seek', props.position - step);
  else if (event.key === 'Home') emit('seek', 0);
  else if (event.key === 'End') emit('seek', props.duration);
  else return;
  event.preventDefault();
}
</script>

<template>
  <div
    ref="root"
    class="timeline"
    :class="{ tall, disabled }"
    role="slider"
    :tabindex="disabled ? -1 : 0"
    aria-label="Posición de reproducción"
    aria-valuemin="0"
    :aria-valuemax="Math.round(duration)"
    :aria-valuenow="Math.round(ratio * duration)"
    :aria-valuetext="valueText"
    :aria-disabled="disabled"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="dragRatio = null"
    @keydown="onKeydown"
  >
    <div class="rail">
      <span
        v-for="(segment, i) in segments"
        :key="i"
        class="buffered"
        :style="{ left: `${segment.left}%`, width: `${segment.width}%` }"
      />
      <span class="played" :style="{ width: `${ratio * 100}%` }" />
    </div>
    <span class="thumb" :style="{ left: `${ratio * 100}%` }" />
  </div>
</template>

<style scoped>
.timeline {
  position: relative;
  flex: 1;
  min-width: 0;
  height: 28px;
  display: flex;
  align-items: center;
  cursor: pointer;
  touch-action: none;
}
.timeline.tall {
  height: 44px;
}
.timeline.disabled {
  cursor: default;
  opacity: 0.6;
}
.rail {
  position: relative;
  width: 100%;
  height: 8px;
  border-radius: 4px;
  background: var(--line);
  overflow: hidden;
}
.tall .rail {
  height: 18px;
  border-radius: 6px;
}
.buffered {
  position: absolute;
  top: 0;
  bottom: 0;
  background: var(--buffer);
  opacity: 0.85;
}
.played {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  background: var(--signal);
}
.thumb {
  position: absolute;
  top: 50%;
  width: 14px;
  height: 14px;
  margin: -7px 0 0 -7px;
  border-radius: 50%;
  background: var(--ink);
  border: 2px solid var(--surface);
  pointer-events: none;
}
.timeline.disabled .thumb {
  display: none;
}
</style>
