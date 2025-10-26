import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { LoanOffer, LoanRequest } from '../models/loan.models';
import { AuthService } from './auth.service';
import { WalletService } from './wallet.service';
import { environment } from '../../../environments/environment';

interface ApiLoanOffer {
  id: string;
  lenderId: string;
  name: string;
  amount: number;
  interestRate: number;
  negotiable?: boolean;
  minDurationMonths: number;
  maxDurationMonths: number;
  minCreditScore?: number;
  minMonthlyIncome?: number;
  status?: string;
  createdAt?: string;
}

interface ApiCreateOfferPayload {
  name: string;
  amount: number;
  interestRate: number;
  negotiable: boolean;
  minDurationMonths: number;
  maxDurationMonths: number;
  minCreditScore?: number;
  minMonthlyIncome?: number;
}

interface ApiUpdateOfferPayload extends ApiCreateOfferPayload {
  status?: string;
}

type CreateOfferPayload = Omit<LoanOffer, 'id' | 'lenderId' | 'createdAt' | 'status'>;

@Injectable({ providedIn: 'root' })
export class LoanService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly wallet = inject(WalletService);
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/$/, '');

  offers = signal<LoanOffer[]>([]);
  requests = signal<LoanRequest[]>([]);

  private mapOffer(dto: ApiLoanOffer): LoanOffer {
    return {
      id: dto.id,
      lenderId: dto.lenderId,
      name: dto.name,
      amount: dto.amount,
      rate: dto.interestRate,
      negotiable: dto.negotiable ?? false,
      minDurationMonths: dto.minDurationMonths,
      maxDurationMonths: dto.maxDurationMonths,
      minCreditScore: dto.minCreditScore,
      minMonthlyIncome: dto.minMonthlyIncome,
      createdAt: dto.createdAt ?? new Date().toISOString(),
      status: dto.status === 'Withdrawn' ? 'Withdrawn' : 'Open',
    };
  }

  private toApiCreatePayload(source: CreateOfferPayload): ApiCreateOfferPayload {
    return {
      name: source.name,
      amount: Number(source.amount),
      interestRate: Number(source.rate),
      negotiable: source.negotiable ?? false,
      minDurationMonths: Number(source.minDurationMonths),
      maxDurationMonths: Number(source.maxDurationMonths),
      minCreditScore:
        source.minCreditScore !== undefined ? Number(source.minCreditScore) : undefined,
      minMonthlyIncome:
        source.minMonthlyIncome !== undefined ? Number(source.minMonthlyIncome) : undefined,
    };
  }

  private toApiUpdatePayload(
    baseline: LoanOffer,
    partial: Partial<LoanOffer>
  ): ApiUpdateOfferPayload {
    const merged = { ...baseline, ...partial };
    const payload: ApiUpdateOfferPayload = {
      ...this.toApiCreatePayload(merged),
    };
    const nextStatus = merged.status;
    if (nextStatus) {
      payload.status = nextStatus;
    }
    return payload;
  }

  async refreshMyOffers() {
    const lenderId = this.auth.userId();
    if (!lenderId) {
      this.offers.set([]);
      return;
    }
    try {
      const dtos = await firstValueFrom(
        this.http.get<ApiLoanOffer[]>(`${this.baseUrl}/api/lenders/${lenderId}/offers`)
      );
      const mapped = dtos.map((dto) => this.mapOffer(dto));
      this.offers.set(mapped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      await this.wallet.syncCommitted();
    } catch (error) {
      console.error('Unable to load offers', error);
    }
  }

  async createOffer(partial: CreateOfferPayload): Promise<boolean> {
    const lenderId = this.auth.userId();
    if (!lenderId) return false;
    if (!(await this.wallet.hold(partial.amount, `offer-create-${Date.now()}`))) return false;
    try {
      const dto = await firstValueFrom(
        this.http.post<ApiLoanOffer>(
          `${this.baseUrl}/api/lenders/${lenderId}/offers`,
          this.toApiCreatePayload(partial)
        )
      );
      const offer = this.mapOffer(dto);
      this.offers.set([offer, ...this.offers()]);
      return true;
    } catch (error) {
      console.error('Unable to create offer', error);
      await this.wallet.release(partial.amount);
      return false;
    }
  }

  async updateOffer(id: string, partial: Partial<LoanOffer>): Promise<boolean> {
    const lenderId = this.auth.userId();
    if (!lenderId) return false;

    const offers = [...this.offers()];
    const existingIndex = offers.findIndex((o) => o.id === id);
    if (existingIndex === -1) return false;
    const existing = offers[existingIndex];

    const delta = partial.amount !== undefined ? partial.amount - existing.amount : 0;
    if (delta > 0 && !(await this.wallet.hold(delta, `offer-update-${id}-${Date.now()}`))) {
      return false;
    }

    try {
      const dto = await firstValueFrom(
        this.http.put<ApiLoanOffer>(
          `${this.baseUrl}/api/lenders/${lenderId}/offers/${id}`,
          this.toApiUpdatePayload(existing, partial)
        )
      );
      const updated = this.mapOffer(dto);
      offers[existingIndex] = updated;
      this.offers.set(
        offers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      );
      if (delta < 0) {
        await this.wallet.release(Math.abs(delta));
      }
      return true;
    } catch (error) {
      console.error('Unable to update offer', error);
      if (delta > 0) {
        await this.wallet.release(delta);
      }
      return false;
    }
  }

  async removeOffer(id: string): Promise<boolean> {
    const lenderId = this.auth.userId();
    if (!lenderId) return false;
    const offer = this.offers().find((o) => o.id === id);
    try {
      await firstValueFrom(
        this.http.post(
          `${this.baseUrl}/api/lenders/${lenderId}/offers/${id}/withdraw`,
          {}
        )
      );
      if (offer) {
        await this.wallet.release(offer.amount);
      }
      this.offers.set(this.offers().filter((o) => o.id !== id));
      return true;
    } catch (error) {
      console.error('Unable to withdraw offer', error);
      return false;
    }
  }

  myOffers(lenderId: string) {
    return this.offers()
      .filter((o) => o.lenderId === lenderId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  offerRequests(offerId: string) {
    return this.requests().filter((r) => r.offerId === offerId);
  }

  canModifyOffer(offerId: string) {
    return this.offerRequests(offerId).every((req) => req.status !== 'Pending');
  }

  decide(offerId: string, requestId: string, approve: boolean) {
    this.requests.update((arr) =>
      arr.map((r) => {
        if (r.id === requestId) {
          return { ...r, status: approve ? 'Approved' : 'Declined' };
        }
        if (approve && r.offerId === offerId && r.status === 'Pending') {
          return { ...r, status: 'Declined' };
        }
        return r;
      })
    );
  }

  async listEligibleOffers(borrowerId: string) {
    try {
      const dtos = await firstValueFrom(
        this.http.get<ApiLoanOffer[]>(
          `${this.baseUrl}/api/borrowers/${borrowerId}/eligible-offers`
        )
      );
      return dtos.map((dto) => this.mapOffer(dto));
    } catch (error) {
      console.error('Unable to load eligible offers', error);
      return [];
    }
  }
}
