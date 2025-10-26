export const environment = {
  production: true,
  /**
   * Base URL for the CredLink API used in production builds.
   * Can be overridden at runtime by defining `window.NG_APP_API_BASE_URL`
   * before the Angular bundle loads (e.g. inject a script tag ahead of main.js).
   * Falls back to the local dev API so `ng build --configuration production`
   * remains usable during development.
   */
  apiBaseUrl: (globalThis as any).NG_APP_API_BASE_URL ?? 'http://localhost:8085',
};
