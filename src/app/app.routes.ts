
import { Routes } from '@angular/router';
import { canActivateAuth } from './shared/guards/auth.guard';
import { canActivateApproved } from './shared/guards/approved.guard';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/landing/landing').then(m => m.Landing) },
  { path: 'auth', loadComponent: () => import('./pages/auth/auth').then(m => m.Auth) },
  { path: 'onboarding/personal', loadComponent: () => import('./pages/onboarding-personal/onboarding-personal').then(m => m.OnboardingPersonal), canActivate: [canActivateAuth] },
  { path: 'onboarding/kyc', loadComponent: () => import('./pages/kyc-upload/kyc-upload').then(m => m.KycUpload), canActivate: [canActivateAuth] },
  { path: 'onboarding/submit', loadComponent: () => import('./pages/kyc-submit/kyc-submit').then(m => m.KycSubmit), canActivate: [canActivateAuth] },
  { path: 'onboarding/status', loadComponent: () => import('./pages/kyc-status/kyc-status').then(m => m.KycStatus), canActivate: [canActivateAuth] },
  { path: 'dashboard', loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.Dashboard), canActivate: [canActivateApproved] },
  { path: 'lend', loadComponent: () => import('./pages/lend/lend').then(m => m.Lend), canActivate: [canActivateApproved] },
  { path: 'borrow', loadComponent: () => import('./pages/borrow/borrow').then(m => m.Borrow), canActivate: [canActivateApproved] },
  { path: 'settings', loadComponent: () => import('./pages/settings/settings').then(m => m.Settings), canActivate: [canActivateApproved] },
  { path: '**', redirectTo: '' }
];
