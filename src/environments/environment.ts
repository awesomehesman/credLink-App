const runtimeBaseUrl = (globalThis as any).NG_APP_API_BASE_URL;

const inferredBaseUrl =
  runtimeBaseUrl ??
  (() => {
    // Allow the Angular dev server proxy (`/api`) to avoid CORS locally.
    if (typeof window !== 'undefined') {
      const { hostname, port } = window.location;
      const isLocalhost = ['localhost', '127.0.0.1'].includes(hostname);
      const isNgServePort = ['4200', '4201', '5173'].includes(port);
      if (isLocalhost && isNgServePort) {
        return '';
      }
    }
    // return 'https://credlink-api-centralus-aa.azurewebsites.net';
    return 'http://localhost:8085';
  })();

export const environment = {
  production: true,
  apiBaseUrl: inferredBaseUrl,
};
