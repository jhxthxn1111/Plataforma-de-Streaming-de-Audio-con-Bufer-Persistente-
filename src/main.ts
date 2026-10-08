import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { watch } from 'vue';
import App from './App.vue';
import { router } from './router';
import { onSessionExpired } from './api/http';
import { useAuthStore } from './stores/auth';
import { usePlayerStore } from './stores/player';
import './styles/tokens.css';
import './styles/base.css';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.use(router);

app.config.errorHandler = (error, _instance, info) => {
  console.error(`[cauce] error en ${info}`, error);
};

const auth = useAuthStore();
const player = usePlayerStore();

// Si el refresh token falla, se limpia la sesión y se vuelve al login.
onSessionExpired(() => {
  auth.clearSession();
  void router.replace({
    name: 'login',
    query: { redirect: router.currentRoute.value.fullPath, reason: 'expired' },
  });
});

// Al quedar anónimo (logout o sesión vencida) se detiene el audio.
watch(
  () => auth.status,
  (status) => {
    if (status === 'anonymous') player.reset();
  },
);

app.mount('#app');
