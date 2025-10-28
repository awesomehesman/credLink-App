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
      identificationType: ['sa-id', [Validators.required]],
      nationalIdOrPassport: ['', [Validators.required]],
      idExpiry: [null, []],
      companyName: ['', []],
      employmentStatus: ['Full-time', [Validators.required]],
      employmentStatusOther: ['Other'],
      monthlyIncome: [null, [Validators.required, Validators.min(0)]],
      street: ['', [Validators.required]],
      city: ['', [Validators.required]],
      province: ['', [Validators.required]],
      postalCode: ['', [Validators.required]],
      country: ['South Africa', [Validators.required]]
    });
    this.setupIdentificationValidation();
    this.setupEmploymentValidation();
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
      const rawIncome = this.form.value.monthlyIncome;
      const parsedIncome =
        rawIncome !== null && rawIncome !== '' ? Number(rawIncome) : null;
      const payload = {
        ...this.form.value,
        monthlyIncome:
          parsedIncome !== null && Number.isFinite(parsedIncome) ? parsedIncome : null,
      };
      await this.profile.savePersonalInfo(payload);
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
      const identificationControlValue =
        this.mapIdentificationTypeForControl(profile.identificationType) ??
        this.mapIdentificationTypeForControl(profile.idKind) ??
        'sa-id';
      this.form.patchValue({
        firstName: profile.firstName ?? '',
        middleName: profile.middleName ?? '',
        lastName: profile.lastName ?? '',
        email: profile.email ?? '',
        phone: profile.phoneNumber ?? '',
        dateOfBirth: profile.dateOfBirth ? new Date(profile.dateOfBirth) : null,
        identificationType: identificationControlValue,
        nationalIdOrPassport: profile.governmentId ?? '',
        idExpiry: profile.idExpiry ? new Date(profile.idExpiry) : null,
        companyName: profile.businessName ?? '',
        employmentStatus: profile.employmentStatus ?? this.form.get('employmentStatus')?.value ?? 'Full-time',
        employmentStatusOther: profile.employmentStatusOther ?? '',
        monthlyIncome:
          profile.monthlyIncome !== undefined && profile.monthlyIncome !== null
            ? Number(profile.monthlyIncome)
            : null,
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

  isSouthAfricanId() {
    return this.form?.get('identificationType')?.value === 'sa-id';
  }

  showOtherEmployment() {
    return this.form?.get('employmentStatus')?.value === 'Other';
  }

  onEmploymentChange(value: string) {
    const otherControl = this.form.get('employmentStatusOther');
    if (!otherControl) return;
    if (value === 'Other') {
      otherControl.setValidators([Validators.required, Validators.minLength(3)]);
    } else {
      otherControl.clearValidators();
      otherControl.setValue('', { emitEvent: false });
    }
    otherControl.updateValueAndValidity({ emitEvent: false });
  }

  private setupIdentificationValidation() {
    const idTypeControl = this.form.get('identificationType');
    const docControl = this.form.get('nationalIdOrPassport');
    if (!idTypeControl || !docControl) return;

    idTypeControl.valueChanges.subscribe(type => {
      this.applyIdentificationValidators(type);
    });
    this.applyIdentificationValidators(idTypeControl.value);
  }

  private setupEmploymentValidation() {
    const employmentControl = this.form.get('employmentStatus');
    if (!employmentControl) return;
    employmentControl.valueChanges.subscribe(value => this.onEmploymentChange(value));
    this.onEmploymentChange(employmentControl.value);
  }

  private applyIdentificationValidators(type: string) {
    const docControl = this.form.get('nationalIdOrPassport');
    if (!docControl) return;
    if (type === 'sa-id') {
      docControl.setValidators([
        Validators.required,
        Validators.pattern(/^\d{13}$/),
      ]);
    } else {
      docControl.setValidators([
        Validators.required,
        Validators.pattern(/^[A-Za-z0-9]{6,30}$/),
      ]);
    }
    docControl.updateValueAndValidity({ emitEvent: false });
  }

  private mapIdentificationTypeForControl(value: string | undefined | null): 'sa-id' | 'passport' | null {
    if (!value) return null;
    const normalized = value.toString().trim().toLowerCase();
    if (!normalized) return null;
    if (normalized.includes('passport')) return 'passport';
    if (normalized === 'sa-id' || normalized.includes('south african') || normalized.includes('national')) {
      return 'sa-id';
    }
    return null;
  }
}
