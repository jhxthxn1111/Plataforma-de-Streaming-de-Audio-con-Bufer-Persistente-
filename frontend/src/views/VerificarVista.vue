<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

type State = 'loading' | 'ok' | 'error';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const state = ref<State>('loading');
const message = ref('');

onMounted(async () => {
  const token = typeof route.query.token === 'string' ? route.query.token : '';
  // El token es de un solo uso, pero tampoco hace falta dejarlo en la barra de direcciones ni en el historial.
  await router.replace({ query: {} });

  if (!token) {
    state.value = 'error';
    message.value = 'El enlace está incompleto. Abre el que te enviamos por correo.';
    return;
  }
  const error = await auth.verifyEmail(token);
  if (error) {
    state.value = 'error';
    message.value = error;
  } else {
    state.value = 'ok';
  }
});
</script>

<template>
  <section class="verify">
    <template v-if="state === 'loading'">
      <h1>Verificando tu correo…</h1>
      <p class="muted" role="status">Un momento, por favor.</p>
    </template>

    <template v-else-if="state === 'ok'">
      <h1>¡Correo verificado!</h1>
      <p role="status">Tu cuenta está activa. Ya puedes iniciar sesión.</p>
      <RouterLink class="btn btn-primary" :to="{ name: 'login' }">Iniciar sesión</RouterLink>
    </template>

    <template v-else>
      <h1>No pudimos verificar el correo</h1>
      <p class="field-error" role="alert">{{ message }}</p>
      <p class="muted">
        Si ya habías verificado tu correo, simplemente inicia sesión. Si no, intenta iniciar sesión y te ofreceremos enviar un
        enlace nuevo.
      </p>
      <RouterLink class="btn btn-primary" :to="{ name: 'login' }">Ir a iniciar sesión</RouterLink>
    </template>
  </section>
</template>

<style scoped>
.verify {
  display: grid;
  gap: 1.25rem;
  width: min(100%, 380px);
}
.verify p {
  margin: 0;
}
.verify a.btn {
  text-decoration: none;
  text-align: center;
}
</style>
