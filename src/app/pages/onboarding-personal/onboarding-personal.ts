import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { OnboardingSteps } from '../../shared/components/stepper/stepper';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { ProfileService } from '../../shared/services/profile.service';

@Component({
  standalone: true,
  selector: 'app-onboarding-personal',
  imports: [CommonModule, ReactiveFormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, OnboardingSteps, MatDatepickerModule, MatNativeDateModule, MatIconModule, MatSelectModule],
  templateUrl: './onboarding-personal.html',
  styleUrls: ['./onboarding-personal.scss']
})
export class OnboardingPersonal implements OnInit {
  constructor(
    private fb: FormBuilder,
    private router: Router,
    private profile: ProfileService
  ){}
  form!: FormGroup;
  saving = false;
  loadError: string | null = null;
  submitError: string | null = null;

  // provinces for South Africa
  provinces = [
    'Eastern Cape',
    'Free State',
    'Gauteng',
    'KwaZulu-Natal',
    'Limpopo',
    'Mpumalanga',
    'North West',
    'Northern Cape',
    'Western Cape'
  ];

  ngOnInit(): void {
    this.form = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      middleName: [''],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required]],
      dateOfBirth: [null, [Validators.required]],
      nationalIdOrPassport: ['', [Validators.required, Validators.minLength(6)]],
      idExpiry: [null, []],
      street: ['', [Validators.required]],
      city: ['', [Validators.required]],
      province: ['', [Validators.required]],
      postalCode: ['', [Validators.required]],
      country: ['South Africa', [Validators.required]]
    });
    void this.prefill();
  }

  async submit(){
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving = true;
    this.submitError = null;
    try {
      await this.profile.savePersonalInfo(this.form.value);
      this.router.navigateByUrl('/onboarding/kyc');
    } catch {
      this.submitError = 'Unable to save your details. Please try again.';
    } finally {
      this.saving = false;
    }
  }

  private async prefill() {
    this.loadError = null;
    try {
      const profile = await this.profile.fetchPersonalInfo();
      if (!profile) return;
      this.form.patchValue({
        firstName: profile.firstName ?? '',
        middleName: profile.middleName ?? '',
        lastName: profile.lastName ?? '',
        email: profile.email ?? '',
        phone: profile.phoneNumber ?? '',
        dateOfBirth: profile.dateOfBirth ? new Date(profile.dateOfBirth) : null,
        nationalIdOrPassport: profile.governmentId ?? '',
        idExpiry: profile.idExpiry ? new Date(profile.idExpiry) : null,
        street: profile.address?.street ?? '',
        city: profile.address?.city ?? '',
        province: profile.address?.province ?? '',
        postalCode: profile.address?.postalCode ?? '',
        country: profile.address?.country ?? this.form.get('country')?.value ?? 'South Africa'
      });
    } catch {
      this.loadError = 'We could not load your existing profile. You can still continue.';
    }
  }
}
