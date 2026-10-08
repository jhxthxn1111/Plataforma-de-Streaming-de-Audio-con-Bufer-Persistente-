<script setup lang="ts">
import { RouterLink } from 'vue-router';
import StatePanel from '@/components/StatePanel.vue';
</script>

<template>
  <main class="nf">
    <StatePanel kind="empty" title="Página no encontrada" message="La dirección no existe o fue movida.">
      <RouterLink :to="{ name: 'library' }" class="btn btn-primary">Ir al inicio</RouterLink>
    </StatePanel>
  </main>
</template>

<style scoped>
.nf {
  display: grid;
  place-items: center;
  min-height: 100%;
  padding: 2rem;
}
</style>
