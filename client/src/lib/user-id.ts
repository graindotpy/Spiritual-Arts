const USER_ID_STORAGE_KEY = "userId";

let fallbackUserId: string | undefined;

function createUserId() {
  const randomId = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  return `user_${randomId}`;
}

export function getOrCreateUserId() {
  if (typeof window === "undefined") {
    fallbackUserId ??= createUserId();
    return fallbackUserId;
  }

  try {
    const storedUserId = window.localStorage.getItem(USER_ID_STORAGE_KEY);
    if (storedUserId) {
      return storedUserId;
    }

    const userId = createUserId();
    window.localStorage.setItem(USER_ID_STORAGE_KEY, userId);
    return userId;
  } catch {
    fallbackUserId ??= createUserId();
    return fallbackUserId;
  }
}
