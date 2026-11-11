<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import { emailRequestSchema } from '@/api/contracts';
import { useCooldown } from '@/composables/useCooldown';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();

const email = ref('');
const fieldError = ref<string | null>(null);
const error = ref<string | null>(null);
const loading = ref(false);
const sent = ref(false);
const { remaining, start } = useCooldown(60);

async function submit(): Promise<void> {
  const parsed = emailRequestSchema.safeParse({ email: email.value });
  if (!parsed.success) {
    fieldError.value = parsed.error.flatten().fieldErrors.email?.[0] ?? 'Escribe un correo válido';
    return;
  }
  fieldError.value = null;
  error.value = null;
  loading.value = true;
  const failure = await auth.forgotPassword(parsed.data.email);
  loading.value = false;
  if (failure) {
    error.value = failure;
    return;
  }
  sent.value = true;
  start();
}
</script>

<template>
  <section class="forgot">
    <h1>Recuperar contraseña</h1>

    <template v-if="sent">
      <p role="status">
        Si <strong>{{ email.trim() }}</strong> está registrado, te enviamos un correo. Ábrelo y acepta el cambio para elegir una
        contraseña nueva. El enlace sirve una sola vez y vence en 1 hora.
      </p>
      <p class="muted">Si no lo ves en unos minutos, revisa la carpeta de spam.</p>
      <p v-if="error" class="field-error" role="alert">{{ error }}</p>
      <button type="button" class="btn" :disabled="remaining > 0 || loading" @click="submit">
        {{ remaining > 0 ? `Reenviar correo (${remaining} s)` : 'Reenviar correo' }}
      </button>
    </template>

    <form v-else novalidate @submit.prevent="submit">
      <p class="muted">Escribe tu correo y te enviaremos un enlace para cambiar tu contraseña.</p>
      <div class="field">
        <label for="email">Correo</label>
        <input
          id="email"
          v-model="email"
          type="email"
          autocomplete="email"
          :aria-invalid="Boolean(fieldError)"
          :aria-describedby="fieldError ? 'email-error' : undefined"
        />
        <p v-if="fieldError" id="email-error" class="field-error">{{ fieldError }}</p>
      </div>

      <p v-if="error" class="field-error" role="alert">{{ error }}</p>

      <button type="submit" class="btn btn-primary" :disabled="loading">
        {{ loading ? 'Enviando…' : 'Enviar enlace' }}
      </button>
    </form>

    <p class="switch"><RouterLink :to="{ name: 'login' }">Volver a iniciar sesión</RouterLink></p>
  </section>
</template>

<style scoped>
.forgot {
  display: grid;
  gap: 1.25rem;
  width: min(100%, 380px);
}
.forgot p {
  margin: 0;
}
form {
  display: grid;
  gap: 1rem;
}
.switch a {
  font-weight: 600;
  color: var(--signal);
}
</style>
