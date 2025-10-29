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
  rate?: number;              // some endpoints
  interestRate?: number;      // others
  negotiable?: boolean;
  minDurationMonths: number;
  maxDurationMonths: number;
  minCreditScore?: number;
  minMonthlyIncome?: number;
  status?: string;
  createdAt?: string;
}

interface ApiLenderDashboard {
  loans?: {
    marketplace?: Array<{
      id: string; // offer id
      requests?: ApiMarketRequest[];
    }>;
  };
}

/** Simplified, local shape for marketplace requests */
interface ApiMarketRequest {
  id: string;
  requester?: string;              // name (used as borrowerId fallback)
  submittedDate?: string;          // e.g. "Submitted Mar 19, 2024"
  submitted?: string;              // ISO string (optional)
  status?: string;                 // "Pending" | "Approved" | "Declined" | ...
  statusTone?: string;
  creditScore?: number | string;
  monthlyIncome?: number | string | null;
  credibility?: string;
  note?: string;
  requestedAmount?: number | string | null;
  requestedRate?: number | string | null;
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

  /* ----------------------------- mapping helpers ----------------------------- */

  private toNumber(x: unknown): number | undefined {
    if (typeof x === 'number' && Number.isFinite(x)) return x;
    if (typeof x === 'string') {
      const n = Number(x.replace(/[^0-9.+-]/g, ''));
      return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
  }

  private mapOffer(dto: ApiLoanOffer): LoanOffer {
    const interest = dto.interestRate ?? dto.rate ?? 0; // support both keys
    return {
      id: dto.id,
      lenderId: dto.lenderId,
      name: dto.name,
      amount: Number(dto.amount ?? 0),
      rate: Number(interest),
      negotiable: dto.negotiable ?? false,
      minDurationMonths: Number(dto.minDurationMonths),
      maxDurationMonths: Number(dto.maxDurationMonths),
      minCreditScore: dto.minCreditScore ?? undefined,
      minMonthlyIncome: dto.minMonthlyIncome ?? undefined,
      createdAt: dto.createdAt ?? new Date().toISOString(),
      status: dto.status === 'Withdrawn' ? 'Withdrawn' : 'Open',
    };
  }

  /** Map a dashboard marketplace request into our LoanRequest model */
  /** Map a dashboard marketplace request into our LoanRequest model */
private mapDashboardRequest(offerId: string, raw: ApiMarketRequest): LoanRequest {
  const toNumber = (x: unknown) => {
    if (typeof x === 'number' && Number.isFinite(x)) return x;
    if (typeof x === 'string') {
      const n = Number(x.replace(/[^0-9.+-]/g, ''));
      return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
  };

  const requestedAmount = toNumber(raw.requestedAmount ?? null);
  const requestedRate   = toNumber(raw.requestedRate ?? null);
  const creditScore     = toNumber(raw.creditScore ?? null);
  const monthlyIncome   = toNumber(raw.monthlyIncome ?? null);

  // Normalize submitted date -> `submitted` (your model)
  let submitted: string | undefined;
  if (raw.submitted) {
    const d = new Date(raw.submitted);
    submitted = Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  } else if (raw.submittedDate) {
    const parsed = new Date(raw.submittedDate.replace(/^Submitted\s+/i, ''));
    submitted = Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }

  // Coerce status to our tri-state
  let status: LoanRequest['status'] = 'Pending';
  const s = (raw.status ?? '').toLowerCase();
  if (s.includes('approv')) status = 'Approved';
  else if (s.includes('declin') || s.includes('reject')) status = 'Declined';

  // Build object using only known keys in your LoanRequest interface
  const base: LoanRequest = {
    id: raw.id,
    offerId,
    borrowerId: raw.requester ?? 'borrower',
    status,
  };

  const optional: Partial<LoanRequest> = {
    ...(submitted ? { submitted } : {}),
    ...(creditScore !== undefined ? { creditScore } : {}),
    ...(monthlyIncome !== undefined ? { monthlyIncome } : {}),
    ...(raw.credibility ? { credibility: raw.credibility } : {}),
    ...(raw.note ? { note: raw.note } : {}),
    ...(requestedAmount !== undefined ? { requestedAmount } : {}),
    ...(requestedRate !== undefined ? { requestedRate } : {}),
  };

  return { ...base, ...optional };
}

  /* --------------------------------- API ------------------------------------ */

  async refreshMyOffers() {
    const lenderId = this.auth.userId();
    if (!lenderId) {
      this.offers.set([]);
      this.requests.set([]);
      return;
    }

    try {
      // 1) Offers
      const offersDto = await firstValueFrom(
        this.http.get<ApiLoanOffer[]>(`${this.baseUrl}/api/lenders/${lenderId}/offers`)
      );
      const offers = offersDto.map((dto) => this.mapOffer(dto));
      offers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      this.offers.set(offers);

      // 2) Requests (hydrate from dashboard marketplace)
      const dashDto = await firstValueFrom(
        this.http.get<ApiLenderDashboard>(`${this.baseUrl}/api/lenders/${lenderId}/dashboard`)
      ).catch(() => ({}) as ApiLenderDashboard);

      const marketplace: Array<{ id: string; requests?: ApiMarketRequest[] }> =
        Array.isArray(dashDto?.loans?.marketplace) ? dashDto!.loans!.marketplace! : [];

      const reqs: LoanRequest[] = [];
      for (const offer of marketplace) {
        if (!offer?.requests?.length) continue;
        for (const r of offer.requests) {
          reqs.push(this.mapDashboardRequest(offer.id, r));
        }
      }
      this.requests.set(reqs);

      await this.wallet.syncCommitted();
    } catch (error) {
      console.error('Unable to load offers/requests', error);
      // keep existing signals on error
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
    const idx = offers.findIndex((o) => o.id === id);
    if (idx === -1) return false;
    const existing = offers[idx];

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
      offers[idx] = this.mapOffer(dto);
      offers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      this.offers.set(offers);
      if (delta < 0) await this.wallet.release(Math.abs(delta));
      return true;
    } catch (error) {
      console.error('Unable to update offer', error);
      if (delta > 0) await this.wallet.release(delta);
      return false;
    }
  }

  async removeOffer(id: string): Promise<boolean> {
    const lenderId = this.auth.userId();
    if (!lenderId) return false;

    const offer = this.offers().find((o) => o.id === id);
    try {
      await firstValueFrom(
        this.http.post(`${this.baseUrl}/api/lenders/${lenderId}/offers/${id}/withdraw`, {})
      );
      if (offer) await this.wallet.release(offer.amount);
      this.offers.set(this.offers().filter((o) => o.id !== id));
      this.requests.set(this.requests().filter((r) => r.offerId !== id));
      return true;
    } catch (error) {
      console.error('Unable to withdraw offer', error);
      return false;
    }
  }

  /* ------------------------------- helpers ---------------------------------- */

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

  private toApiUpdatePayload(baseline: LoanOffer, partial: Partial<LoanOffer>): ApiUpdateOfferPayload {
    const merged = { ...baseline, ...partial };
    const payload: ApiUpdateOfferPayload = this.toApiCreatePayload(merged);
    if (merged.status) payload.status = merged.status;
    return payload;
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