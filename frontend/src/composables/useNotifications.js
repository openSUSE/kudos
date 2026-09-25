import { reactive } from "vue";

const state = reactive({
  messages: [] // each message: { id, text, type, timeout, link }
});

let counter = 0;

export function useNotifications() {
  // `link` is an in-app path the toast opens when clicked; timeout 0 keeps it
  // on screen until clicked or closed.
  function addNotification({ title, message, type = "info", timeout = 4000, link = null }) {
    const id = ++counter;
    const text = title ? `${title}: ${message}` : message;
    state.messages.push({ id, text, type, timeout, link });

    if (timeout) {
      setTimeout(() => dismiss(id), timeout);
    }
  }

  function dismiss(id) {
    const idx = state.messages.findIndex(m => m.id === id);
    if (idx !== -1) state.messages.splice(idx, 1);
  }

  return { state, addNotification, dismiss };
}