import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import "./styles/tokens.css";
import "./styles/base.css";
import router from "./router";

const app = createApp(App);

app.use(createPinia());
app.use(router);

app.config.errorHandler = (error, _instance, info) => {
  console.error(`[musica] error en ${info}`, error);
};

app.mount("#app");
