
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormsModule } from '@angular/forms';
import { OnboardingSteps } from '../../shared/components/stepper/stepper';
import { KycService } from '../../shared/services/kyc.service';

@Component({
  standalone: true,
  selector: 'app-kyc-submit',
  imports: [FormsModule, MatCardModule, MatButtonModule, MatCheckboxModule, OnboardingSteps],
  templateUrl: './kyc-submit.html',
  styleUrl: './kyc-submit.scss'
})
export class KycSubmit {
  agree = false;
  constructor(public kyc: KycService, private router: Router) {}
  requiredDocs(){ return this.kyc.getSubmission()?.required ?? []; }
  hasUploaded(code: string){ return (this.kyc.getSubmission()?.uploaded ?? []).includes(code); }
  canSubmit(){
    const req = this.requiredDocs();
    return this.agree && req.length && req.every((r: string) => this.hasUploaded(r));
  }
  submit(){ if (this.canSubmit()) { this.kyc.submit(); this.router.navigateByUrl('/onboarding/status'); } }
}
