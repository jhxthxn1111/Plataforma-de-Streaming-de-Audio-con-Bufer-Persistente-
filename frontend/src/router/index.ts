import { createRouter, createWebHistory } from 'vue-router'
import LoginVista from '../views/LoginVista.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/login' },
    { path: '/login', name: 'login', component: LoginVista },
  ],
})

export default router