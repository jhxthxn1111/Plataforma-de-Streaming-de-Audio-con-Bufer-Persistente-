<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { loginRequestSchema } from '@/api/contracts';
import { env } from '@/config/env';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const form = reactive({ email: '', password: '' });
const fieldErrors = ref<{ email?: string; password?: string }>({});

const expired = computed(() => route.query.reason === 'expired');

/** Solo se aceptan rutas internas, para evitar redirecciones abiertas. */
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
  if (await auth.login(parsed.data)) {
    await router.replace(safeRedirect(route.query.redirect));
  }
}
</script>

<template>
  <section class="login">
    <h1>Inicia sesión</h1>
    <p v-if="expired" class="notice" role="status">Tu sesión expiró. Inicia sesión de nuevo.</p>

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

      <p v-if="auth.error" class="field-error" role="alert">{{ auth.error }}</p>

      <button type="submit" class="btn btn-primary" :disabled="auth.loading">
        {{ auth.loading ? 'Entrando…' : 'Iniciar sesión' }}
      </button>
    </form>

    <p v-if="env.useMock" class="demo muted">
      Modo demo: <code>demo@cauce.app</code> / <code>Demo1234!</code> o administración con
      <code>admin@cauce.app</code> / <code>Admin1234!</code>
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
.demo {
  font-size: 0.9rem;
}
code {
  font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
  font-size: 0.85em;
}
</style>
