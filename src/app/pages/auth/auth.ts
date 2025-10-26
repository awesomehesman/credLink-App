import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
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

  signInForm!: FormGroup;
  signUpForm!: FormGroup;

  constructor(private fb: FormBuilder, private router: Router, private auth: AuthService) {
    this.signInForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });

    this.signUpForm = this.fb.group({
      username: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirm: ['', Validators.required],
    });

    this.signInForm.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.signInForm.hasError('invalid')) this.signInForm.setErrors(null);
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
  }

  swap(toSignIn: boolean) {
    this.isSignInSig.set(toSignIn);
  }

  async submitSignIn() {
    if (this.signInForm.invalid) {
      this.signInForm.markAllAsTouched();
      return;
    }
    const success = await this.auth.signIn(this.signInForm.value);
    if (!success) {
      this.signInForm.setErrors({ invalid: true });
      return;
    }
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

    const success = await this.auth.signUp({ username, password });
    if (!success) {
      const usernameCtrl = this.signUpForm.get('username');
      if (usernameCtrl) {
        const existing = usernameCtrl.errors ?? {};
        usernameCtrl.setErrors({ ...existing, taken: true });
      }
      this.signUpForm.markAllAsTouched();
      return;
    }
    this.signUpForm.reset();
    this.isSignInSig.set(true);
    this.router.navigateByUrl('/onboarding/personal');
  }
}
