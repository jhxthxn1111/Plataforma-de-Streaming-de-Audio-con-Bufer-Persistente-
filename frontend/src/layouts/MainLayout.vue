<script setup lang="ts">
import { RouterView, useRouter } from 'vue-router';
import AppNav from '@/components/AppNav.vue';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();

async function handleLogout(): Promise<void> {
  await auth.logout();
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
  </div>
</template>

<style scoped>
.shell {
  display: grid;
  grid-template-columns: var(--sidebar-w) minmax(0, 1fr);
  height: 100%;
}
.nav-slot {
  min-height: 0;
}
.content {
  overflow-y: auto;
  padding: 2rem clamp(1rem, 4vw, 2.5rem);
}
.content:focus {
  outline: none;
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
    grid-template-rows: auto minmax(0, 1fr);
  }
  .content {
    padding: 1.25rem 1rem;
  }
}
</style>
