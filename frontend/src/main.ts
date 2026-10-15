import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router';
import { onSessionExpired } from './api/http';
import { useAuthStore } from './stores/auth';
import './styles/tokens.css';
import './styles/base.css';

const app = createApp(App);
app.use(createPinia());
app.use(router);

app.config.errorHandler = (error, _instance, info) => {
  console.error(`[musica] error en ${info}`, error);
};

const auth = useAuthStore();
onSessionExpired(() => {
  auth.clearSession();
  void router.replace({
    name: 'login',
    query: { redirect: router.currentRoute.value.fullPath, reason: 'expired' },
  });
});

app.mount('#app');