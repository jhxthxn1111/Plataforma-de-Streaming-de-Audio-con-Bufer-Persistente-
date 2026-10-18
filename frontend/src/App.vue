<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import PlayerBar from './components/PlayerBar.vue'

const route = useRoute()

const showPlayer = computed(() => {
  const hiddenRoutes = ['/login', '/register', '/registro']
  return !hiddenRoutes.includes(route.path)
})
</script>

<template>
  <RouterView />
  <PlayerBar v-if="showPlayer" />
</template>

<style>

html, body, #app {
  min-height: 100vh;
  margin: 0;
}

/* Da espacio en la parte inferior del menú lateral para que la barra tipo Spotify no tape 'Cerrar sesión' */
aside, nav {
  padding-bottom: 105px !important;
  box-sizing: border-box;
}
</style>