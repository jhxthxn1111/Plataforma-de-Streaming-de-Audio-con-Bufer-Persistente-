<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { resetPasswordFormSchema } from '@/api/contracts';
import { useAuthStore } from '@/stores/auth';

type Field = 'newPassword' | 'confirmPassword';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

// El token se lee una vez y se quita de la dirección (queda solo en memoria).
const token = typeof route.query.token === 'string' ? route.query.token : '';
onMounted(() => {
  void router.replace({ query: {} });
});

const form = reactive({ newPassword: '', confirmPassword: '' });
const fieldErrors = ref<Partial<Record<Field, string>>>({});
const error = ref<string | null>(null);
const loading = ref(false);

async function submit(): Promise<void> {
  const parsed = resetPasswordFormSchema.safeParse(form);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    fieldErrors.value = { newPassword: flat.newPassword?.[0], confirmPassword: flat.confirmPassword?.[0] };
    return;
  }
  fieldErrors.value = {};
  error.value = null;
  loading.value = true;
  const failure = await auth.resetPassword(token, parsed.data.newPassword);
  loading.value = false;
  if (failure) {
    error.value = failure;
    return;
  }
  await router.replace({ name: 'login', query: { reset: '1' } });
}
</script>

<template>
  <section class="reset">
    <h1>Nueva contraseña</h1>

    <template v-if="!token">
      <p class="field-error" role="alert">El enlace está incompleto. Abre el que te enviamos por correo o pide uno nuevo.</p>
      <RouterLink class="btn btn-primary" :to="{ name: 'forgot-password' }">Pedir un enlace nuevo</RouterLink>
    </template>

    <form v-else novalidate @submit.prevent="submit">
      <p class="muted">Elige la contraseña nueva. Al guardarla cerraremos tus sesiones abiertas y te avisaremos por correo.</p>

      <div class="field">
        <label for="newPassword">Contraseña nueva</label>
        <input
          id="newPassword"
          v-model="form.newPassword"
          type="password"
          autocomplete="new-password"
          :aria-invalid="Boolean(fieldErrors.newPassword)"
          :aria-describedby="fieldErrors.newPassword ? 'newPassword-error' : 'newPassword-hint'"
        />
        <p id="newPassword-hint" class="muted hint">Mínimo 8 caracteres, con al menos una letra y un número.</p>
        <p v-if="fieldErrors.newPassword" id="newPassword-error" class="field-error">{{ fieldErrors.newPassword }}</p>
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

      <p v-if="error" class="field-error" role="alert">{{ error }}</p>
      <p v-if="error" class="again"><RouterLink :to="{ name: 'forgot-password' }">Pedir un enlace nuevo</RouterLink></p>

      <button type="submit" class="btn btn-primary" :disabled="loading">
        {{ loading ? 'Guardando…' : 'Cambiar contraseña' }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.reset {
  display: grid;
  gap: 1.25rem;
  width: min(100%, 380px);
}
.reset p {
  margin: 0;
}
form {
  display: grid;
  gap: 1rem;
}
.reset a.btn {
  text-decoration: none;
  text-align: center;
}
.again a {
  font-weight: 600;
  color: var(--signal);
}
</style>
