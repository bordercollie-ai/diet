export async function clearServiceWorkerCaches(): Promise<void> {
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations.map((registration) => registration.unregister()),
    );
  }
  await Promise.all(
    (await caches.keys())
      .filter((key) => key.startsWith("diet-shell-"))
      .map((key) => caches.delete(key)),
  );
}

// ponytail: only the service worker's cache + registration are cleared, the
// user's own diary data lives in IndexedDB and is left untouched.
export async function refreshApp(): Promise<void> {
  await clearServiceWorkerCaches();
  location.reload();
}
