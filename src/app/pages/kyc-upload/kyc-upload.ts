import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { OnboardingSteps } from '../../shared/components/stepper/stepper';
import { KycService } from '../../shared/services/kyc.service';

@Component({
  standalone: true,
  selector: 'app-kyc-upload',
  imports: [MatCardModule, MatChipsModule, MatButtonModule, RouterLink, OnboardingSteps],
  templateUrl: './kyc-upload.html',
  styleUrl: './kyc-upload.scss',
})
export class KycUpload {
  constructor(public kyc: KycService) {
    this.kyc.initDraft();
  }

  docs = [
    { code: 'ID_FRONT', label: 'ID Front', hint: 'JPEG/PNG, clear and readable' },
    { code: 'ID_BACK', label: 'ID Back', hint: 'JPEG/PNG' },
    { code: 'PROOF_OF_ADDRESS', label: 'Proof of Address', hint: 'Bank statement or utility bill (PDF)' },
    { code: 'PROOF_OF_INCOME', label: 'Proof of Income', hint: 'Payslip or bank statement (PDF)' },
    { code: 'SELFIE', label: 'Selfie (liveness)', hint: 'Well-lit, no hat/sunglasses' },
  ];

  uploaded(code: string) {
    return (this.kyc.getSubmission()?.uploaded ?? []).includes(code);
  }

  onSelect(file: File | null | undefined, code: string) {
    if (file) {
      this.kyc.upload(code);
    }
  }
}
