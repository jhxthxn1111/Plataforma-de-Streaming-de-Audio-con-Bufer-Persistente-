<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import PlayerBar from './components/PlayerBar.vue'
import { useAuthStore } from './stores/auth'

const route = useRoute()
const auth = useAuthStore()

const showPlayer = computed(() => {
  const hiddenRoutes = ['/login', '/register', '/registro', '/verificar', '/olvide-contrasena', '/restablecer']
  // Solo con sesión iniciada: sin ella el reproductor pediría /audio/tracks y recibiría un 401.
  return auth.isAuthenticated && !hiddenRoutes.includes(route.path)
})
</script>

<template>
  <RouterView />
  <PlayerBar v-if="showPlayer" />
</template>

<style>

html, body, #app {
  min-height: 100vh;
  min-height: 100dvh;
  margin: 0;
}
</style>