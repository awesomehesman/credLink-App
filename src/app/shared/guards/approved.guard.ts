
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const canActivateApproved: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) { router.navigateByUrl('/'); return false; }
  if (!auth.isApproved()) { router.navigateByUrl('/onboarding/status'); return false; }
  return true;
};
