<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import IconGlyph from './IconGlyph.vue';

const auth = useAuthStore();
const emit = defineEmits<{ logout: [] }>();
</script>

<template>
  <nav class="nav" aria-label="Principal">
    <RouterLink :to="{ name: 'library' }" class="brand">
      <IconGlyph name="wave" :size="26" />
      <span>Cauce</span>
    </RouterLink>

    <ul class="links">
      <li>
        <RouterLink :to="{ name: 'library' }"><IconGlyph name="library" /> Explorar</RouterLink>
      </li>
      <li>
        <RouterLink :to="{ name: 'now-playing' }"><IconGlyph name="queue" /> Reproduciendo</RouterLink>
      </li>
      <li>
        <RouterLink :to="{ name: 'analytics' }"><IconGlyph name="chart" /> Mi consumo</RouterLink>
      </li>
      <li v-if="auth.isAdmin">
        <RouterLink :to="{ name: 'admin' }"><IconGlyph name="shield" /> Administración</RouterLink>
      </li>
    </ul>

    <div class="account">
      <p class="who">
        <strong>{{ auth.user?.displayName }}</strong>
        <span class="muted">{{ auth.user?.email }}</span>
      </p>
      <button type="button" class="btn" @click="emit('logout')">
        <IconGlyph name="logout" /> Cerrar sesión
      </button>
    </div>
  </nav>
</template>

<style scoped>
.nav {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  height: 100%;
  padding: 1.25rem 1rem;
  background: var(--surface);
  border-right: 1px solid var(--line);
}
.brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 700;
  text-decoration: none;
  color: var(--signal);
}
.links {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.15rem;
}
.links a {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-height: 42px;
  padding: 0 0.75rem;
  border-radius: var(--radius-md);
  text-decoration: none;
  font-weight: 600;
  color: var(--muted);
}
.links a:hover {
  background: var(--surface-2);
  color: var(--ink);
}
.links a.router-link-active {
  background: var(--ink);
  color: var(--surface);
}
.account {
  margin-top: auto;
  display: grid;
  gap: 0.75rem;
}
.who {
  display: grid;
  min-width: 0;
}
.who span {
  font-size: 0.85rem;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 860px) {
  .nav {
    flex-direction: row;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    height: auto;
    padding: 0.6rem 0.9rem;
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }
  .links {
    display: flex;
    flex: 1;
    overflow-x: auto;
  }
  .links a {
    white-space: nowrap;
    padding: 0 0.6rem;
  }
  .who {
    display: none;
  }
  .account {
    margin: 0;
  }
}
</style>
