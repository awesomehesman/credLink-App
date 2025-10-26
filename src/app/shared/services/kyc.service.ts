
import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { KycSubmission, KycStatus } from '../models/kyc.models';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

interface KycApiSubmission {
  id?: string;
  submissionId?: string;
  userId?: string;
  status?: string;
  requiredDocuments?: string[];
  uploadedDocuments?: string[];
  issues?: string[];
}

@Injectable({ providedIn: 'root' })
export class KycService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/$/, '');

  private _sub = signal<KycSubmission | null>(null);
  private _loading = signal<boolean>(false);
  private _error = signal<string | null>(null);

  readonly loading = computed(() => this._loading());
  readonly error = computed(() => this._error());

  async initDraft(): Promise<KycSubmission | null> {
    const submission = this._sub();
    if (submission) return submission;
    const userId = this.auth.userId();
    if (!userId) return null;
    this._loading.set(true);
    this._error.set(null);
    try {
      let existing = await this.fetchSubmissionForUser(userId);
      if (!existing) {
        existing = await this.createSubmission(userId);
      }
      this.applySubmission(existing);
      return existing;
    } catch (error) {
      console.error('Unable to initialize KYC submission', error);
      this._error.set('Unable to load your KYC submission. Please try again.');
      return null;
    } finally {
      this._loading.set(false);
    }
  }

  getSubmission() {
    return this._sub();
  }

  async refresh(): Promise<KycSubmission | null> {
    const id = this._sub()?.id;
    if (!id) return this.initDraft();
    this._loading.set(true);
    this._error.set(null);
    try {
      const dto = await this.fetchSubmissionById(id);
      this.applySubmission(dto);
      return dto;
    } catch (error) {
      console.error('Unable to refresh KYC submission', error);
      this._error.set('Unable to refresh submission status.');
      return this._sub();
    } finally {
      this._loading.set(false);
    }
  }

  async upload(docType: string, file: File): Promise<boolean> {
    const submission = await this.ensureSubmission();
    if (!submission) return false;

    const form = new FormData();
    form.append('SubmissionId', submission.id);
    form.append('DocType', docType);
    form.append('File', file, file.name);

    this._loading.set(true);
    this._error.set(null);
    try {
      await firstValueFrom(
        this.http.post(`${this.baseUrl}/api/kyc/documents`, form, {
          responseType: 'json',
        })
      );
      await this.refresh();
      return true;
    } catch (error) {
      console.error('Document upload failed', error);
      this._error.set('Unable to upload document. Please retry.');
      return false;
    } finally {
      this._loading.set(false);
    }
  }

  async submit(): Promise<boolean> {
    const submission = await this.ensureSubmission();
    if (!submission) return false;
    this._loading.set(true);
    this._error.set(null);
    try {
      await firstValueFrom(
        this.http.post(
          `${this.baseUrl}/api/kyc/submissions/${submission.id}/submit`,
          {}
        )
      );
      await this.refresh();
      return true;
    } catch (error) {
      console.error('KYC submission failed', error);
      this._error.set('Unable to submit KYC. Please try again.');
      return false;
    } finally {
      this._loading.set(false);
    }
  }

  async triggerAutoReview(): Promise<boolean> {
    const submission = await this.ensureSubmission();
    if (!submission) return false;
    try {
      await firstValueFrom(
        this.http.post(
          `${this.baseUrl}/api/kyc/submissions/${submission.id}/auto-review`,
          {}
        )
      );
      await this.refresh();
      return true;
    } catch (error) {
      console.error('Auto-review trigger failed', error);
      this._error.set('Auto-review could not be triggered.');
      return false;
    }
  }

  async triggerRetryReview(): Promise<boolean> {
    const submission = await this.ensureSubmission();
    if (!submission) return false;
    try {
      await firstValueFrom(
        this.http.post(
          `${this.baseUrl}/api/kyc/submissions/${submission.id}/retry-review`,
          {}
        )
      );
      await this.refresh();
      return true;
    } catch (error) {
      console.error('Retry-review trigger failed', error);
      this._error.set('Retry review could not be triggered.');
      return false;
    }
  }

  private applySubmission(submission: KycSubmission) {
    this._sub.set(submission);
    this.auth.setApproved(submission.status === 'Approved');
  }

  private async ensureSubmission(): Promise<KycSubmission | null> {
    const current = this._sub();
    if (current) return current;
    return this.initDraft();
  }

  private async fetchSubmissionForUser(userId: string): Promise<KycSubmission | null> {
    try {
      const dto = await firstValueFrom(
        this.http.get<KycApiSubmission>(`${this.baseUrl}/api/kyc/user/${userId}`)
      );
      return this.mapSubmission(dto);
    } catch (error: any) {
      if (error?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  private async fetchSubmissionById(id: string): Promise<KycSubmission> {
    const dto = await firstValueFrom(
      this.http.get<KycApiSubmission>(`${this.baseUrl}/api/kyc/submissions/${id}`)
    );
    return this.mapSubmission(dto);
  }

  private async createSubmission(userId: string): Promise<KycSubmission> {
    const payload = {
      userId,
      status: 'Draft',
    };
    const dto = await firstValueFrom(
      this.http.post<KycApiSubmission>(`${this.baseUrl}/api/kyc/create`, payload)
    );
    return this.mapSubmission(dto);
  }

  private mapSubmission(dto: KycApiSubmission): KycSubmission {
    const id = dto.submissionId ?? dto.id ?? crypto.randomUUID();
    const status = (dto.status ?? 'Draft') as KycStatus;
    return {
      id,
      status,
      required: dto.requiredDocuments ?? [
        'ID_FRONT',
        'ID_BACK',
        'PROOF_OF_ADDRESS',
        'PROOF_OF_INCOME',
        'SELFIE',
      ],
      uploaded: dto.uploadedDocuments ?? [],
      issues: dto.issues ?? [],
    };
  }
}
