<script setup lang="ts">
import { computed } from 'vue';
import CatalogDashboard from '../components/CatalogDashboard.vue';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const greeting = computed(() => (auth.user?.displayName ? `Hola, ${auth.user.displayName}` : 'Hola'));
const roleLabel = computed(() => (auth.isAdmin ? 'administrador' : 'oyente'));
</script>

<template>
  <div class="menu">
    <header class="menu-header">
      <h1>{{ greeting }}</h1>
      <p class="role">Sesión iniciada como {{ roleLabel }}.</p>
    </header>

    <CatalogDashboard />
  </div>
</template>

<style scoped>
.menu {
  display: grid;
  gap: 2rem;
}
.role {
  margin-top: 0.35rem;
  color: var(--muted);
}
</style>
