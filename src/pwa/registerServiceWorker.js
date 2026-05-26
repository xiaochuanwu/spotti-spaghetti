const unregisterDevelopmentServiceWorkers = () => {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => {
      registrations.forEach((registration) => registration.unregister());
    })
    .catch((error) => {
      console.warn('Unable to unregister development service workers:', error);
    });
};

export const registerServiceWorker = () => {
  if (!('serviceWorker' in navigator)) return;

  if (!import.meta.env.PROD) {
    unregisterDevelopmentServiceWorkers();
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        registration.update();
      })
      .catch((error) => {
        console.warn('Service worker registration failed:', error);
      });
  });
};
