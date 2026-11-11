<script setup lang="ts">
import { reactive, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { registerFormSchema } from '@/api/contracts';
import { useCooldown } from '@/composables/useCooldown';
import { useAuthStore } from '@/stores/auth';

type Field = 'displayName' | 'email' | 'password' | 'confirmPassword';

const auth = useAuthStore();
const route = useRoute();

const form = reactive({ displayName: '', email: '', password: '', confirmPassword: '' });
const fieldErrors = ref<Partial<Record<Field, string>>>({});

// Tras registrarse no se abre sesión: primero hay que abrir el enlace que llega al correo.
const sentTo = ref<string | null>(null);
const resendInfo = ref<string | null>(null);
const resendError = ref<string | null>(null);
const { remaining, start } = useCooldown(60);

async function submit(): Promise<void> {
  const parsed = registerFormSchema.safeParse(form);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    fieldErrors.value = {
      displayName: flat.displayName?.[0],
      email: flat.email?.[0],
      password: flat.password?.[0],
      confirmPassword: flat.confirmPassword?.[0],
    };
    return;
  }
  fieldErrors.value = {};
  const { displayName, email, password } = parsed.data;
  if (await auth.register({ displayName, email, password })) {
    form.password = '';
    form.confirmPassword = '';
    sentTo.value = email;
    start();
  }
}

async function resend(): Promise<void> {
  if (!sentTo.value) return;
  resendError.value = await auth.resendVerification(sentTo.value);
  resendInfo.value = resendError.value ? null : 'Listo: si el correo aún no está verificado, te enviamos otro.';
  if (!resendError.value) start();
}
</script>

<template>
  <section class="register">
    <h1>{{ sentTo ? 'Revisa tu correo' : 'Crear cuenta' }}</h1>

    <div v-if="sentTo" class="sent" role="status">
      <p>
        Te enviamos un enlace a <strong>{{ sentTo }}</strong>. Ábrelo para activar tu cuenta y después podrás iniciar sesión.
      </p>
      <p class="muted">Si no lo ves en unos minutos, revisa la carpeta de spam.</p>

      <p v-if="resendInfo" class="notice">{{ resendInfo }}</p>
      <p v-if="resendError" class="field-error" role="alert">{{ resendError }}</p>

      <button type="button" class="btn" :disabled="remaining > 0" @click="resend">
        {{ remaining > 0 ? `Reenviar correo (${remaining} s)` : 'Reenviar correo' }}
      </button>
      <RouterLink class="btn btn-primary" :to="{ name: 'login', query: route.query.redirect ? { redirect: String(route.query.redirect) } : {} }">
        Ir a iniciar sesión
      </RouterLink>
    </div>

    <template v-else>
    <form novalidate @submit.prevent="submit">
      <div class="field">
        <label for="displayName">Nombre</label>
        <input
          id="displayName"
          v-model="form.displayName"
          type="text"
          autocomplete="name"
          :aria-invalid="Boolean(fieldErrors.displayName)"
          :aria-describedby="fieldErrors.displayName ? 'displayName-error' : undefined"
        />
        <p v-if="fieldErrors.displayName" id="displayName-error" class="field-error">{{ fieldErrors.displayName }}</p>
      </div>

      <div class="field">
        <label for="email">Correo</label>
        <input
          id="email"
          v-model="form.email"
          type="email"
          autocomplete="email"
          :aria-invalid="Boolean(fieldErrors.email)"
          :aria-describedby="fieldErrors.email ? 'email-error' : undefined"
        />
        <p v-if="fieldErrors.email" id="email-error" class="field-error">{{ fieldErrors.email }}</p>
      </div>

      <div class="field">
        <label for="password">Contraseña</label>
        <input
          id="password"
          v-model="form.password"
          type="password"
          autocomplete="new-password"
          :aria-invalid="Boolean(fieldErrors.password)"
          :aria-describedby="fieldErrors.password ? 'password-error' : 'password-hint'"
        />
        <p id="password-hint" class="muted hint">Mínimo 8 caracteres, con al menos una letra y un número.</p>
        <p v-if="fieldErrors.password" id="password-error" class="field-error">{{ fieldErrors.password }}</p>
      </div>

      <div class="field">
        <label for="confirmPassword">Confirmar contraseña</label>
        <input
          id="confirmPassword"
          v-model="form.confirmPassword"
          type="password"
          autocomplete="new-password"
          :aria-invalid="Boolean(fieldErrors.confirmPassword)"
          :aria-describedby="fieldErrors.confirmPassword ? 'confirm-error' : undefined"
        />
        <p v-if="fieldErrors.confirmPassword" id="confirm-error" class="field-error">{{ fieldErrors.confirmPassword }}</p>
      </div>

      <p v-if="auth.error" class="field-error" role="alert">{{ auth.error }}</p>

      <button type="submit" class="btn btn-primary" :disabled="auth.loading">
        {{ auth.loading ? 'Creando cuenta…' : 'Crear cuenta' }}
      </button>
    </form>

    <p class="switch">
      ¿Ya tienes cuenta?
      <RouterLink :to="{ name: 'login', query: route.query.redirect ? { redirect: String(route.query.redirect) } : {} }">Inicia sesión</RouterLink>
    </p>
    </template>
  </section>
</template>

<style scoped>
.register {
  display: grid;
  gap: 1.25rem;
  width: min(100%, 380px);
}
form {
  display: grid;
  gap: 1rem;
}
.hint {
  font-size: 0.9rem;
}
.switch a {
  font-weight: 600;
  color: var(--signal);
}
.sent {
  display: grid;
  gap: 1rem;
}
.sent p {
  margin: 0;
}
.sent a.btn {
  text-decoration: none;
  text-align: center;
}
.notice {
  padding: 0.6rem 0.75rem;
  border-left: 4px solid var(--buffer);
  background: var(--surface);
}
</style>
