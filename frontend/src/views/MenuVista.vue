<template>
  <main class="menu-main-container">
   
    <header class="menu-header">
      <h1 class="greeting">Hola, Jhonathan</h1>
      <p class="role-subtitle">Sesión iniciada como Oyente.</p>
    </header>

    <!-- El catálogo de canciones estilo Spotify que creamos -->
    <CatalogDashboard />
  </main>
</template>

<script setup lang="ts">
import CatalogDashboard from '../components/CatalogDashboard.vue';
</script>

<style scoped>
.menu-main-container {
  width: 100%;
  min-height: 100vh;
  /* El color de fondo oscuro que hace contraste con la barra */
  background-color: #0f111a; 
  color: white;
  display: flex;
  flex-direction: column;
}

.menu-header {
  padding: 40px 32px 10px 32px;
}

.greeting {
  font-size: 32px;
  font-weight: 800;
  margin: 0 0 8px 0;
  color: #ffffff;
  letter-spacing: -0.02em;
}

.role-subtitle {
  color: #9ca3af;
  margin: 0;
  font-size: 14px;
}
</style>