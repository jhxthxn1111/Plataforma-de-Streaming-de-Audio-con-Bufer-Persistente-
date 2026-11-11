<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { loginRequestSchema } from '@/api/contracts';
import { env } from '@/config/env';
import { useCooldown } from '@/composables/useCooldown';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const form = reactive({ email: '', password: '' });
const fieldErrors = ref<{ email?: string; password?: string }>({});

const expired = computed(() => route.query.reason === 'expired');
const passwordReset = computed(() => route.query.reset === '1');

const resendInfo = ref<string | null>(null);
const resendError = ref<string | null>(null);
const { remaining, start } = useCooldown(60);

function safeRedirect(value: unknown): string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

async function submit(): Promise<void> {
  const parsed = loginRequestSchema.safeParse(form);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    fieldErrors.value = { email: flat.email?.[0], password: flat.password?.[0] };
    return;
  }
  fieldErrors.value = {};
  resendInfo.value = null;
  resendError.value = null;
  if (await auth.login(parsed.data)) {
    await router.replace(safeRedirect(route.query.redirect));
  }
}

/** Cuenta creada pero sin verificar: se puede pedir otro enlace desde aquí. */
async function resendVerification(): Promise<void> {
  resendError.value = await auth.resendVerification(form.email.trim());
  resendInfo.value = resendError.value ? null : 'Si la cuenta existe, te enviamos otro correo de verificación.';
  if (!resendError.value) start();
}
</script>

<template>
  <section class="login">
    <h1>Inicia sesión</h1>
    <p v-if="expired" class="notice" role="status">Tu sesión expiró. Inicia sesión de nuevo.</p>
    <p v-if="passwordReset" class="notice" role="status">Contraseña actualizada. Inicia sesión con la nueva.</p>

    <form novalidate @submit.prevent="submit">
      <div class="field">
        <label for="email">Correo</label>
        <input
          id="email"
          v-model="form.email"
          type="email"
          autocomplete="username"
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
          autocomplete="current-password"
          :aria-invalid="Boolean(fieldErrors.password)"
          :aria-describedby="fieldErrors.password ? 'password-error' : undefined"
        />
        <p v-if="fieldErrors.password" id="password-error" class="field-error">{{ fieldErrors.password }}</p>
      </div>

      <p class="forgot"><RouterLink :to="{ name: 'forgot-password' }">¿Olvidaste tu contraseña?</RouterLink></p>

      <p v-if="auth.error" class="field-error" role="alert">{{ auth.error }}</p>

      <div v-if="auth.needsVerification" class="verify-box">
        <p v-if="resendInfo" class="notice" role="status">{{ resendInfo }}</p>
        <p v-if="resendError" class="field-error" role="alert">{{ resendError }}</p>
        <button type="button" class="btn" :disabled="remaining > 0" @click="resendVerification">
          {{ remaining > 0 ? `Reenviar correo (${remaining} s)` : 'Reenviar correo de verificación' }}
        </button>
      </div>

      <button type="submit" class="btn btn-primary" :disabled="auth.loading">
        {{ auth.loading ? 'Entrando…' : 'Iniciar sesión' }}
      </button>
    </form>

    <p class="switch">
      ¿No tienes cuenta?
      <RouterLink :to="{ name: 'register', query: route.query.redirect ? { redirect: String(route.query.redirect) } : {} }">Crear cuenta</RouterLink>
    </p>

    <p v-if="env.useMock" class="demo muted">
      Modo demo: <code>demo@musica.app</code> / <code>Demo1234!</code> o administración con
      <code>admin@musica.app</code> / <code>Admin1234!</code>. Los correos no se envían: el enlace de verificación o de
      recuperación aparece en la consola del navegador (F12).
    </p>
  </section>
</template>

<style scoped>
.login {
  display: grid;
  gap: 1.25rem;
  width: min(100%, 380px);
}
form {
  display: grid;
  gap: 1rem;
}
.notice {
  padding: 0.6rem 0.75rem;
  border-left: 4px solid var(--buffer);
  background: var(--surface);
}
.switch a {
  font-weight: 600;
  color: var(--signal);
}
.forgot {
  margin: -0.25rem 0 0;
  font-size: 0.9rem;
}
.forgot a {
  color: var(--signal);
}
.verify-box {
  display: grid;
  gap: 0.75rem;
}
.verify-box p {
  margin: 0;
}
.demo {
  font-size: 0.9rem;
}
code {
  font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
  font-size: 0.85em;
}
</style>
