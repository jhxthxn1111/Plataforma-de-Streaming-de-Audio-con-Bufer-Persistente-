<script setup lang="ts">
import { reactive, ref } from "vue";

const emit = defineEmits<{ submit: [credentials: { email: string; password: string }] }>();

const form = reactive({ email: "", password: "" });
const errors = ref<{ email?: string; password?: string }>({});

function validate(): boolean {
  const next: { email?: string; password?: string } = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    next.email = "Escribe un correo válido";
  }
  if (form.password.length < 8) {
    next.password = "La contraseña tiene al menos 8 caracteres";
  }
  errors.value = next;
  return Object.keys(next).length === 0;
}

function onSubmit(): void {
  if (!validate()) return;
  emit("submit", { email: form.email.trim(), password: form.password });
}
</script>

<template>
  <main class="login">
    <h1>Iniciar sesión</h1>

    <form novalidate @submit.prevent="onSubmit">
      <div class="field">
        <label for="email">Correo</label>
        <input
          id="email"
          v-model="form.email"
          type="email"
          autocomplete="username"
          :aria-invalid="Boolean(errors.email)"
        />
        <p v-if="errors.email" class="field-error">{{ errors.email }}</p>
      </div>

      <div class="field">
        <label for="password">Contraseña</label>
        <input
          id="password"
          v-model="form.password"
          type="password"
          autocomplete="current-password"
          :aria-invalid="Boolean(errors.password)"
        />
        <p v-if="errors.password" class="field-error">{{ errors.password }}</p>
      </div>

      <button type="submit" class="btn btn-primary">Iniciar sesión</button>
    </form>
  </main>
</template>

<style scoped>
.login {
  display: grid;
  gap: 1.25rem;
  width: min(100%, 380px);
  margin: 0 auto;
  padding: 3rem 1.25rem;
}
form {
  display: grid;
  gap: 1rem;
}
</style>