<script setup lang="ts">
defineProps<{ kind: 'loading' | 'empty' | 'error'; title: string; message?: string }>();
</script>

<template>
  <div class="state" :role="kind === 'error' ? 'alert' : 'status'" :data-kind="kind">
    <span v-if="kind === 'loading'" class="spinner" aria-hidden="true" />
    <h2>{{ title }}</h2>
    <p v-if="message" class="muted">{{ message }}</p>
    <div class="actions"><slot /></div>
  </div>
</template>

<style scoped>
.state {
  display: grid;
  justify-items: start;
  gap: 0.5rem;
  padding: 1.5rem;
  border: 1px dashed var(--line);
  border-radius: var(--radius-md);
}
.state[data-kind='error'] {
  border-color: var(--danger);
}
.state[data-kind='error'] h2 {
  color: var(--danger);
}
.actions:empty {
  display: none;
}
.actions {
  margin-top: 0.5rem;
  display: flex;
  gap: 0.5rem;
}
.spinner {
  width: 20px;
  height: 20px;
  border: 3px solid var(--line);
  border-top-color: var(--signal);
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
