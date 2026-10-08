<script setup lang="ts">
import { RouterLink } from 'vue-router';
import StatePanel from '@/components/StatePanel.vue';
</script>

<template>
  <div class="page">
    <StatePanel kind="error" title="No tienes acceso a esta sección" message="Tu cuenta no tiene el rol necesario para verla.">
      <RouterLink :to="{ name: 'library' }" class="btn btn-primary">Volver a Explorar</RouterLink>
    </StatePanel>
  </div>
</template>
