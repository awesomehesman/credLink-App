import { Injectable, signal } from '@angular/core';
import { KycSubmission } from '../models/kyc.models';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class KycService {
  private _sub = signal<KycSubmission | null>(null);

  constructor(private auth: AuthService) {}

  initDraft() {
    if (!this._sub()) {
      const draft: KycSubmission = {
        id: crypto.randomUUID(),
        status: 'Draft',
        required: ['ID_FRONT', 'ID_BACK', 'PROOF_OF_ADDRESS', 'PROOF_OF_INCOME', 'SELFIE'],
        uploaded: [],
      };
      this._sub.set(draft);
    }
    return this._sub();
  }

  getSubmission() {
    return this._sub();
  }

  upload(docType: string) {
    const s = this._sub();
    if (!s) return;
    if (!s.uploaded.includes(docType)) {
      s.uploaded.push(docType);
    }
    this._sub.set({ ...s });
  }

  submit() {
    const s = this._sub();
    if (!s) return;
    this._sub.set({ ...s, status: 'PendingReview' });

    setTimeout(() => {
      const current = this._sub();
      if (current && current.status === 'PendingReview') {
        const approved = Math.random() > 0.2;
        this._sub.set({
          ...current,
          status: approved ? 'Approved' : 'ResubmissionRequired',
          issues: approved ? [] : ['Proof of Address unclear'],
        });
        this.auth.setApproved(approved);
      }
    }, 2000);
  }
}
