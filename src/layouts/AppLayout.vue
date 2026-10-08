<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { RouterView, useRouter } from 'vue-router';
import AppNav from '@/components/AppNav.vue';
import PlayerBar from '@/components/PlayerBar.vue';
import { useAnalyticsStore } from '@/stores/analytics';
import { useAuthStore } from '@/stores/auth';
import { usePlayerStore } from '@/stores/player';

const auth = useAuthStore();
const player = usePlayerStore();
const analytics = useAnalyticsStore();
const router = useRouter();

function flushOnHide(): void {
  if (document.visibilityState === 'hidden') void analytics.flush();
}

onMounted(() => {
  if (auth.user) player.hydrate(auth.user.id);
  player.attach();
  analytics.startAutoFlush();
  document.addEventListener('visibilitychange', flushOnHide);
  window.addEventListener('pagehide', flushOnHide);
});

onBeforeUnmount(() => {
  analytics.stopAutoFlush();
  document.removeEventListener('visibilitychange', flushOnHide);
  window.removeEventListener('pagehide', flushOnHide);
});

async function handleLogout(): Promise<void> {
  await analytics.flush();
  await auth.logout(); // al quedar anónimo, main.ts detiene el reproductor
  await router.replace({ name: 'login' });
}
</script>

<template>
  <div class="shell">
    <a class="skip" href="#main">Saltar al contenido</a>
    <AppNav class="nav-slot" @logout="handleLogout" />
    <main id="main" class="content" tabindex="-1">
      <RouterView />
    </main>
    <!-- El reproductor está en el layout padre: no se desmonta al cambiar de vista. -->
    <PlayerBar class="player-slot" />
  </div>
</template>

<style scoped>
.shell {
  display: grid;
  grid-template-columns: var(--sidebar-w) minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr) auto;
  grid-template-areas:
    'nav content'
    'player player';
  height: 100%;
}
.nav-slot {
  grid-area: nav;
  min-height: 0;
}
.content {
  grid-area: content;
  overflow-y: auto;
  padding: 2rem clamp(1rem, 4vw, 2.5rem);
}
.content:focus {
  outline: none;
}
.player-slot {
  grid-area: player;
}
.skip {
  position: absolute;
  left: 0.5rem;
  top: -3rem;
  z-index: 10;
  padding: 0.5rem 0.75rem;
  background: var(--ink);
  color: var(--surface);
  border-radius: var(--radius-md);
}
.skip:focus {
  top: 0.5rem;
}

@media (max-width: 860px) {
  .shell {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr) auto;
    grid-template-areas:
      'nav'
      'content'
      'player';
  }
  .content {
    padding: 1.25rem 1rem;
  }
}
</style>
