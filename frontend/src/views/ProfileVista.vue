<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { changePasswordFormSchema, updateProfileRequestSchema } from '@/api/contracts';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();

function firstErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) out[String(issue.path[0])] ??= issue.message;
  return out;
}

/* ---- Datos de la cuenta ---- */
const profile = reactive({ displayName: auth.user?.displayName ?? '' });
const profileErrors = ref<Record<string, string>>({});
const profileMessage = ref('');
const profileFailure = ref('');
const profileSaving = ref(false);
const profileChanged = computed(() => profile.displayName.trim() !== (auth.user?.displayName ?? ''));

async function saveProfile(): Promise<void> {
  profileMessage.value = '';
  profileFailure.value = '';
  const parsed = updateProfileRequestSchema.safeParse(profile);
  if (!parsed.success) {
    profileErrors.value = firstErrors(parsed.error.issues);
    return;
  }
  profileErrors.value = {};
  profileSaving.value = true;
  const failure = await auth.updateProfile(parsed.data);
  profileSaving.value = false;
  if (failure) {
    profileFailure.value = failure;
    return;
  }
  profile.displayName = parsed.data.displayName;
  profileMessage.value = 'Nombre actualizado.';
}

/* ---- Contraseña ---- */
const password = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' });
const passwordErrors = ref<Record<string, string>>({});
const passwordMessage = ref('');
const passwordFailure = ref('');
const passwordSaving = ref(false);

async function savePassword(): Promise<void> {
  passwordMessage.value = '';
  passwordFailure.value = '';
  const parsed = changePasswordFormSchema.safeParse(password);
  if (!parsed.success) {
    passwordErrors.value = firstErrors(parsed.error.issues);
    return;
  }
  passwordErrors.value = {};
  passwordSaving.value = true;
  const failure = await auth.changePassword({
    currentPassword: parsed.data.currentPassword,
    newPassword: parsed.data.newPassword,
  });
  passwordSaving.value = false;
  if (failure) {
    passwordFailure.value = failure;
    return;
  }
  password.currentPassword = '';
  password.newPassword = '';
  password.confirmPassword = '';
  passwordMessage.value = 'Contraseña actualizada. Cerramos tu sesión en los demás dispositivos.';
}
</script>

<template>
  <div class="profile">
    <header>
      <h1>Mi perfil</h1>
      <p class="lead">Cambia tu nombre o tu contraseña.</p>
    </header>

    <form class="panel" novalidate @submit.prevent="saveProfile">
      <h2>Tus datos</h2>

      <div class="field">
        <label for="displayName">Nombre</label>
        <input id="displayName" v-model="profile.displayName" type="text" autocomplete="name" :aria-invalid="Boolean(profileErrors.displayName)" />
        <p v-if="profileErrors.displayName" class="field-error">{{ profileErrors.displayName }}</p>
      </div>

      <p class="static">
        <span class="static-label">Correo</span>
        {{ auth.user?.email }}
        <span class="hint">No se puede cambiar.</span>
      </p>

      <p v-if="profileFailure" class="field-error" role="alert">{{ profileFailure }}</p>
      <p v-if="profileMessage" class="ok" role="status">{{ profileMessage }}</p>

      <button type="submit" class="btn btn-primary" :disabled="profileSaving || !profileChanged">
        {{ profileSaving ? 'Guardando…' : 'Guardar nombre' }}
      </button>
    </form>

    <form class="panel" novalidate @submit.prevent="savePassword">
      <h2>Cambiar contraseña</h2>

      <div class="field">
        <label for="currentPassword">Contraseña actual</label>
        <input id="currentPassword" v-model="password.currentPassword" type="password" autocomplete="current-password" :aria-invalid="Boolean(passwordErrors.currentPassword)" />
        <p v-if="passwordErrors.currentPassword" class="field-error">{{ passwordErrors.currentPassword }}</p>
      </div>

      <div class="field">
        <label for="newPassword">Contraseña nueva</label>
        <input id="newPassword" v-model="password.newPassword" type="password" autocomplete="new-password" :aria-invalid="Boolean(passwordErrors.newPassword)" />
        <p v-if="passwordErrors.newPassword" class="field-error">{{ passwordErrors.newPassword }}</p>
        <p v-else class="hint">Mínimo 8 caracteres, con una letra y un número.</p>
      </div>

      <div class="field">
        <label for="confirmPassword">Repite la contraseña nueva</label>
        <input id="confirmPassword" v-model="password.confirmPassword" type="password" autocomplete="new-password" :aria-invalid="Boolean(passwordErrors.confirmPassword)" />
        <p v-if="passwordErrors.confirmPassword" class="field-error">{{ passwordErrors.confirmPassword }}</p>
      </div>

      <p v-if="passwordFailure" class="field-error" role="alert">{{ passwordFailure }}</p>
      <p v-if="passwordMessage" class="ok" role="status">{{ passwordMessage }}</p>

      <button type="submit" class="btn btn-primary" :disabled="passwordSaving">
        {{ passwordSaving ? 'Guardando…' : 'Cambiar contraseña' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.profile {
  display: grid;
  gap: 1.5rem;
  max-width: 34rem;
}
.lead {
  margin-top: 0.35rem;
  color: var(--muted);
}
.panel {
  display: grid;
  gap: 1rem;
  padding: 1.25rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--surface);
}
.static {
  display: grid;
  gap: 0.15rem;
}
.static-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--muted);
}
.hint {
  font-size: 0.8125rem;
  color: var(--muted);
}
.ok {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--ok);
}
.panel .btn {
  justify-self: start;
}
</style>
