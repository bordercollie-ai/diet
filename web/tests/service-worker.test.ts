import { test, expect, vi, afterEach } from "vitest";
import {
  clearServiceWorkerCaches,
  refreshApp,
} from "../src/lib/service-worker";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("clears the shell caches and unregisters service workers, leaving unrelated caches alone", async () => {
  const unregister = vi.fn();
  vi.stubGlobal("navigator", {
    serviceWorker: { getRegistrations: async () => [{ unregister }] },
  });
  const deletedKeys: string[] = [];
  vi.stubGlobal("caches", {
    keys: async () => ["diet-shell-v4", "some-other-cache"],
    delete: async (key: string) => {
      deletedKeys.push(key);
      return true;
    },
  });

  await clearServiceWorkerCaches();

  expect(unregister).toHaveBeenCalledOnce();
  expect(deletedKeys).toEqual(["diet-shell-v4"]);
});

test("refreshApp clears caches then reloads the page", async () => {
  vi.stubGlobal("navigator", {
    serviceWorker: { getRegistrations: async () => [] },
  });
  vi.stubGlobal("caches", { keys: async () => [], delete: async () => true });
  const reload = vi.fn();
  vi.stubGlobal("location", { reload });

  await refreshApp();

  expect(reload).toHaveBeenCalledOnce();
});
