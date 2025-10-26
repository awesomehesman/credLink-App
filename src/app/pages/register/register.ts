import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  standalone: true,
  selector: 'app-register',
  imports: [ReactiveFormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatCheckboxModule, MatButtonModule],
  templateUrl: './register.html',
  styleUrl: './register.scss'
})
export class Register {
  form: any;

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {
    this.form = this.fb.group({
      role: ['Borrower', [Validators.required]],
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      middleName: [''],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required]],
      dateOfBirth: ['', [Validators.required]],
      nationalIdOrPassport: ['', [Validators.required, Validators.minLength(6)]],
      idExpiry: [''],
      address: this.fb.group({
        street: ['', [Validators.required]],
        city: ['', [Validators.required]],
        province: ['', [Validators.required]],
        postalCode: ['', [Validators.required]],
        country: ['South Africa', [Validators.required]]
      }),
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
      consents: this.fb.group({
        termsAccepted: [false, [Validators.requiredTrue]],
        privacyAccepted: [false, [Validators.requiredTrue]],
        creditBureauConsent: [true as any] // default value; TS strict complain workaround in plain file gen
      })
    });
  }

  async submit(){
    if (this.form.invalid || this.form.value.password !== this.form.value.confirmPassword) {
      this.form.markAllAsTouched(); return;
    }
    const success = await this.auth.registerLocally(this.form.value);
    if (!success) {
      const emailCtrl = this.form.get('email');
      if (emailCtrl) {
        const existing = emailCtrl.errors ?? {};
        emailCtrl.setErrors({ ...existing, taken: true });
      }
      this.form.markAllAsTouched();
      return;
    }
    this.router.navigateByUrl('/onboarding/personal');
  }
}
