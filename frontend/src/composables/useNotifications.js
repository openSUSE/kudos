import { reactive } from "vue";

const state = reactive({
  messages: [] // each message: { id, text, type, timeout }
});

let counter = 0;

export function useNotifications() {
  function notify(text, type = "info", timeout = 4000) {
    const id = ++counter;
    state.messages.push({ id, text, type, timeout });

    if (timeout) {
      setTimeout(() => dismiss(id), timeout);
    }
  }

  function dismiss(id) {
    const idx = state.messages.findIndex(m => m.id === id);
    if (idx !== -1) state.messages.splice(idx, 1);
  }

  return { state, notify, dismiss };
}
