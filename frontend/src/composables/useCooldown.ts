import { onBeforeUnmount, ref, type Ref } from 'vue';

/** Cuenta atrás para el botón "Reenviar correo": evita pulsarlo seguido (el servidor también limita). */
export function useCooldown(seconds: number): { remaining: Ref<number>; start: () => void } {
  const remaining = ref(0);
  let timer: ReturnType<typeof setInterval> | null = null;

  function stop(): void {
    if (timer !== null) clearInterval(timer);
    timer = null;
  }

  function start(): void {
    stop();
    remaining.value = seconds;
    timer = setInterval(() => {
      remaining.value -= 1;
      if (remaining.value <= 0) stop();
    }, 1000);
  }

  onBeforeUnmount(stop);
  return { remaining, start };
}
