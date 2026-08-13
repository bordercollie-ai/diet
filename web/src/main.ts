import { mount } from 'svelte'
import './app.css'
import './custom.css'
import App from './App.svelte'

const target = document.getElementById('app')
if (!target) throw new Error('App mount target not found')

const app = mount(App, { target })

export default app

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
} else if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  const resetDevelopmentServiceWorker = async () => {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((registration) => registration.unregister()))
    await Promise.all(
      (await caches.keys())
        .filter((key) => key.startsWith('diet-shell-'))
        .map((key) => caches.delete(key))
    )
    if (navigator.serviceWorker.controller && !sessionStorage.getItem('diet-dev-sw-reset')) {
      sessionStorage.setItem('diet-dev-sw-reset', 'true')
      location.reload()
    }
  }

  void resetDevelopmentServiceWorker()
}
