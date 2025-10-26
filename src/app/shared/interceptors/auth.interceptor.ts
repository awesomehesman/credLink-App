import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token();

  const configuredBase = environment.apiBaseUrl.replace(/\/$/, '');
  const isAbsoluteApiRequest =
    !!configuredBase && req.url.startsWith(configuredBase);
  const isRelativeApiRequest =
    !configuredBase && req.url.startsWith('/api/');
  const isApiRequest = isAbsoluteApiRequest || isRelativeApiRequest;

  if (token && isApiRequest) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  return next(req);
};
