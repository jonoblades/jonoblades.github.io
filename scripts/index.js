import Main from './Main.js';

new Main();

export default Main;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(
        '/service-worker.js',
        {
          updateViaCache: 'none'
        }
      );

      await registration.update();

      console.info(
        'Service worker registered:',
        registration.scope
      );
    } catch (error) {
      console.error(
        'Service worker registration failed:',
        error
      );
    }
  });
}