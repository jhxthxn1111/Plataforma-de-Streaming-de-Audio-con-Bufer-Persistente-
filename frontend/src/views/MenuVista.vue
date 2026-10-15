<script setup lang="ts">
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const roleLabel = { listener: 'Oyente', admin: 'Administración' } as const;
</script>

<template>
  <div class="page">
    <header class="page-head">
      <h1>Hola, {{ auth.user?.displayName }}</h1>
      <p>Sesión iniciada como {{ auth.user ? roleLabel[auth.user.role] : '' }}.</p>
    </header>
  </div>
</template>

<style scoped>
.soon {
  display: grid;
  gap: 0.75rem;
  padding: 1.25rem;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
}
.soon ul {
  margin: 0;
  padding-left: 1.2rem;
  color: var(--muted);
}
</style>
