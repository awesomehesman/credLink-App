import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './auth.html',
  styleUrls: ['./auth.scss'],
})
export class Auth {
  private isSignInSig = signal(true);
  isSignIn = () => this.isSignInSig();

  private signInErrorSig = signal<string | null>(null);
  signInError = () => this.signInErrorSig();

  private signUpErrorSig = signal<string | null>(null);
  signUpError = () => this.signUpErrorSig();

  signInForm!: FormGroup;
  signUpForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private auth: AuthService
  ) {
    this.signInForm = this.fb.group({
      email: ['', Validators.required],
      password: ['', Validators.required],
    });

    this.signUpForm = this.fb.group({
      username: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirm: ['', Validators.required],
    });

    this.signInForm.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.signInErrorSig()) this.signInErrorSig.set(null);
    });

    const usernameCtrl = this.signUpForm.get('username');
    if (usernameCtrl) {
      usernameCtrl.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
        if (usernameCtrl.hasError('taken')) {
          usernameCtrl.setErrors(null);
          usernameCtrl.updateValueAndValidity({ emitEvent: false });
        }
      });
    }

    this.signUpForm.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.signUpErrorSig()) this.signUpErrorSig.set(null);
    });

    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const mode = (params.get('mode') ?? '').toLowerCase();
      const toSignIn = mode !== 'signup';
      this.isSignInSig.set(toSignIn);
      this.signInErrorSig.set(null);
      this.signUpErrorSig.set(null);
    });
  }

  swap(toSignIn: boolean) {
    this.isSignInSig.set(toSignIn);
    this.signInErrorSig.set(null);
    this.signUpErrorSig.set(null);
    const queryParams = toSignIn ? { mode: null } : { mode: 'signup' };
    this.router.navigate([], {
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  async submitSignIn() {
    if (this.signInForm.invalid) {
      this.signInForm.markAllAsTouched();
      return;
    }
    const result = await this.auth.signIn(this.signInForm.value);
    if (!result.ok) {
      this.signInErrorSig.set(result.message ?? 'Incorrect username or password');
      this.signInForm.markAllAsTouched();
      return;
    }
    this.signInErrorSig.set(null);
    this.signInForm.reset();
    const target = this.auth.isApproved() ? '/dashboard' : '/onboarding/personal';
    this.router.navigateByUrl(target);
  }

  async submitSignUp() {
    const { username, password, confirm } = this.signUpForm.value;
    if (this.signUpForm.invalid || password !== confirm) {
      if (password !== confirm) this.signUpForm.get('confirm')?.setErrors({ mismatch: true });
      this.signUpForm.markAllAsTouched();
      return;
    }

    const result = await this.auth.signUp({ username, password });
    if (!result.ok) {
      this.signUpErrorSig.set(result.message ?? 'Unable to create account');
      const usernameCtrl = this.signUpForm.get('username');
      const loweredMessage = (result.message ?? '').toLowerCase();
      if (usernameCtrl && (loweredMessage.includes('exist') || loweredMessage.includes('taken'))) {
        const existing = usernameCtrl.errors ?? {};
        usernameCtrl.setErrors({ ...existing, taken: true });
        usernameCtrl.markAsTouched();
      }
      this.signUpForm.markAllAsTouched();
      return;
    }
    this.signUpErrorSig.set(null);
    this.signUpForm.reset();
    this.isSignInSig.set(true);
    this.router.navigateByUrl('/onboarding/personal');
  }
}
