export const environment = {
  production: false,
  /**
   * Local API base URL for development. Override via NG_APP_API_BASE_URL env if needed.
   * Default keeps the API relative so the Angular dev-server proxy can handle CORS.
   */
  apiBaseUrl:
    (globalThis as any).NG_APP_API_BASE_URL ?? 'https://credlink-api-centralus-aa.azurewebsites.net'
    // 'http://localhost:8085',
    // 'https://credlink-api-centralus-aa.azurewebsites.net',
};
