<script setup lang="ts">
import { RouterView } from 'vue-router';
import IconGlyph from '@/components/IconGlyph.vue';
</script>

<template>
  <div class="auth">
    <aside class="story" aria-hidden="true">
      <p class="brand"><IconGlyph name="wave" :size="30" /> Cauce</p>
      <div class="demo">
        <p class="headline">La música sigue sonando mientras navegas.</p>
        <div class="rail">
          <span class="played" />
          <span class="gap" />
          <span class="buffered" />
        </div>
        <p class="legend">Reproducido · descargado por rangos · pendiente</p>
      </div>
    </aside>
    <main class="panel"><RouterView /></main>
  </div>
</template>

<style scoped>
.auth {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  min-height: 100%;
}
.story {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 2.5rem;
  background: var(--ink);
  color: var(--paper);
}
.brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: var(--font-display);
  font-size: 1.6rem;
  font-weight: 700;
}
.headline {
  max-width: 14ch;
  font-family: var(--font-display);
  font-size: clamp(2rem, 4vw, 3.2rem);
  font-weight: 700;
  line-height: 1.05;
  margin-bottom: 2rem;
}
.rail {
  display: flex;
  height: 14px;
  max-width: 460px;
  border-radius: 7px;
  overflow: hidden;
  background: rgb(255 255 255 / 0.18);
}
.played {
  width: 34%;
  background: #7f8fff;
}
.gap {
  width: 6%;
}
.buffered {
  width: 22%;
  background: #f3b73a;
}
.legend {
  margin-top: 0.6rem;
  font-size: 0.9rem;
  opacity: 0.75;
}
.panel {
  display: grid;
  place-items: center;
  padding: 2rem 1.25rem;
}

@media (max-width: 860px) {
  .auth {
    grid-template-columns: minmax(0, 1fr);
  }
  .story {
    padding: 1.25rem;
    gap: 1.5rem;
  }
  .headline {
    font-size: 1.6rem;
    margin-bottom: 1rem;
  }
}
</style>
