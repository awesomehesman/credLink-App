import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  BorrowerDashboardData,
  BorrowerDashboardSummary,
  BorrowerLoan,
  BorrowerLoanCategory,
  LenderBorrowerRequest,
  LenderDashboardData,
  LenderDashboardSummary,
  LenderMarketplaceLoan,
  LenderPortfolioLoan,
} from '../models/dashboard.models';

interface ApiLenderDashboard {
  summary?: unknown; // may be array of {label,value,...}
  loans?: {
    marketplace?: unknown;
    active?: unknown;
    history?: unknown;
  };
  [key: string]: unknown;
}

interface ApiBorrowerDashboard {
  summary?: unknown; // may be array of {label,value,...}
  loans?: {
    pending?: unknown;
    active?: unknown;
    history?: unknown;
  };
  [key: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/$/, '');

  async loadLenderDashboard(lenderId: string): Promise<LenderDashboardData> {
    let dto = await firstValueFrom(
      this.http.get<ApiLenderDashboard>(`${this.baseUrl}/api/lenders/${lenderId}/dashboard`)
    );

    // If backend returns array summary + loans object (your sample), normalize first.
    if (Array.isArray((dto as any)?.summary)) {
      dto = this.normalizeLenderApiPayload(dto as any);
    }
    return this.mapLenderDashboard(dto);
  }

  async loadBorrowerDashboard(borrowerId: string): Promise<BorrowerDashboardData> {
    let dto = await firstValueFrom(
      this.http.get<ApiBorrowerDashboard>(`${this.baseUrl}/api/borrowers/${borrowerId}/dashboard`)
    );

    if (Array.isArray((dto as any)?.summary)) {
      dto = this.normalizeBorrowerApiPayload(dto as any);
    }
    return this.mapBorrowerDashboard(dto);
  }

  /* =========================== LENDER MAPPING ============================ */

  private mapLenderDashboard(dto: ApiLenderDashboard): LenderDashboardData {
    const summary = this.mapLenderSummary(dto.summary ?? {});
    const marketplace = this.mapMarketplace((dto.loans as any)?.marketplace ?? []);
    const active = this.mapPortfolio((dto.loans as any)?.active ?? []);
    const history = this.mapPortfolio((dto.loans as any)?.history ?? []);
    return { summary, marketplace, activeLoans: active, history };
  }

  private mapLenderSummary(raw: unknown): LenderDashboardSummary {
    if (!raw || typeof raw !== 'object') {
      return { totalValue: 0, accumulatedInterest: 0, earningsAvailablePercent: 0 };
    }
    const src = raw as Record<string, any>;
    return {
      totalValue: this.toNumber(src['totalValue']) ?? 0,
      accumulatedInterest: this.toNumber(src['accumulatedInterest']) ?? 0,
      earningsAvailablePercent: this.toNumber(src['earningsAvailablePercent']),
      earningsAvailableAmount: this.toNumber(src['earningsAvailableAmount']),
    };
  }

  /* ========================== BORROWER MAPPING =========================== */

  private mapBorrowerDashboard(dto: ApiBorrowerDashboard): BorrowerDashboardData {
    const summary = this.mapBorrowerSummary(dto.summary ?? {});
    const pending = this.mapBorrowerLoans((dto.loans as any)?.pending ?? [], 'pending');
    const active = this.mapBorrowerLoans((dto.loans as any)?.active ?? [], 'active');
    const history = this.mapBorrowerLoans((dto.loans as any)?.history ?? [], 'history');
    return { summary, pending, active, history };
  }

  private mapBorrowerSummary(raw: unknown): BorrowerDashboardSummary {
    if (!raw || typeof raw !== 'object') {
      return { amountOwed: 0, interestPaid: 0 };
    }
    const src = raw as Record<string, any>;
    return {
      amountOwed: this.toNumber(src['amountOwed']) ?? 0,
      interestPaid: this.toNumber(src['interestPaid']) ?? 0,
      nextPaymentAmount: this.toNumber(src['nextPaymentAmount']),
      nextPaymentDate: this.toIsoDate(src['nextPaymentDate']),
      nextPaymentLabel: this.toString(src['nextPaymentLabel']),
    };
  }

  /* ======================= NORMALIZE LENDER PAYLOAD ====================== */

  private normalizeLenderApiPayload(raw: any): ApiLenderDashboard {
    const summaryArr = Array.isArray(raw?.summary) ? raw.summary : [];
    const loansObj = raw?.loans ?? {};

    const byLabel = new Map<string, any>();
    for (const s of summaryArr) {
      const key = (s?.label ?? '').toLowerCase();
      byLabel.set(key, s);
    }

    const total = byLabel.get('total value');
    const interest = byLabel.get('accumulated interest');
    const earnings = byLabel.get('earnings available');

    const summary: LenderDashboardSummary = {
      totalValue: this.parseCurrency(total?.value) ?? 0,
      accumulatedInterest: this.parseCurrency(interest?.value) ?? 0,
      // prefer percent if present; otherwise earningsAmount if currency
      earningsAvailablePercent: this.parsePercent(earnings?.value) ?? undefined,
      earningsAvailableAmount: this.parseCurrency(earnings?.value) ?? undefined,
    };

    return {
      summary,
      loans: {
        marketplace: loansObj.marketplace ?? [],
        active: loansObj.active ?? [],
        history: loansObj.history ?? [],
      },
    };
  }

  /* ====================== NORMALIZE BORROWER PAYLOAD ===================== */

  private normalizeBorrowerApiPayload(raw: any): ApiBorrowerDashboard {
    const summaryArr = Array.isArray(raw?.summary) ? raw.summary : [];
    const loansObj = raw?.loans ?? {};

    const byLabel = new Map<string, any>();
    for (const s of summaryArr) {
      const key = (s?.label ?? '').toLowerCase();
      byLabel.set(key, s);
    }

    const owed = byLabel.get('amount owed');
    const interest = byLabel.get('interest paid');
    const next = byLabel.get('next payment');
    const split = this.splitAmountAndDate(next?.value);

    const summary: BorrowerDashboardSummary = {
      amountOwed: this.parseCurrency(owed?.value) ?? 0,
      interestPaid: this.parseCurrency(interest?.value) ?? 0,
      nextPaymentAmount: split.amount ?? undefined,
      nextPaymentDate: split.dateLabel ? this.parseDateLabel(split.dateLabel) : undefined,
      nextPaymentLabel: next?.helper ?? undefined,
    };

    return {
      summary,
      loans: {
        pending: loansObj.pending ?? [],
        active: loansObj.active ?? [],
        history: loansObj.history ?? [],
      },
    };
  }

  /* ===================== LENDER/BORROWER COMMON MAPS ===================== */

  private mapMarketplace(raw: any[]): LenderMarketplaceLoan[] {
    return (raw ?? []).map((x: any): LenderMarketplaceLoan => ({
      id: x['id'],
      name: x['name'],
      amount: this.undef(this.parseCurrency(x['amount'])),
      interestRate: this.undef(this.parsePercent(x['interestRate'])),
      minDurationMonths: undefined,
      maxDurationMonths: undefined,
      durationLabel: x['durationWindow'] ?? x['durationLabel'],
      minCreditScore: this.toNumber(x['minCreditScore']),
      minMonthlyIncome: this.undef(this.parseCurrency(x['minMonthlyIncome'])),
      status: x['status'],
      tags: [],
      createdAt: this.extractDateFromText(x['createdDate']),
      borrowerRequests: (x['requests'] ?? []).map((r: any): LenderBorrowerRequest => ({
        id: r['id'],
        borrowerName: r['requester'] ?? r['borrower'] ?? 'Borrower',
        submittedAt: this.extractDateFromText(r['submittedDate']),
        creditScore: this.toNumber(r['creditScore']),
        monthlyIncome: this.undef(this.parseCurrency(r['monthlyIncome'])),
        credibility: r['credibility'],
        status: r['status'],
        note: r['note'],
      })),
    }));
  }

  private mapPortfolio(raw: any[]): LenderPortfolioLoan[] {
    return (raw ?? []).map((x: any): LenderPortfolioLoan => ({
      id: x['id'],
      name: x['name'],
      borrowerName: x['borrower'],
      startDate: this.extractDateFromText(x['startDate']),
      termMonths: this.extractTermMonths(x['term']),
      termLabel: x['term'],
      interestRate: this.undef(this.parsePercent(x['interestRate'])),
      accruedInterest: this.undef(this.parseCurrency(x['accruedInterest'])),
      principal: this.undef(this.parseCurrency(x['amount'])),
      status: x['status'],
      completedAt: undefined,
    }));
  }

  private mapBorrowerLoans(raw: any[], category: BorrowerLoanCategory): BorrowerLoan[] {
    return (raw ?? []).map((x: any): BorrowerLoan => ({
      id: x['id'],
      name: x['name'],
      lenderName: x['lender'] ?? x['lenderName'],
      principal: this.undef(this.parseCurrency(x['amountOwed'] ?? x['amount'] ?? x['principal'])),
      amountBorrowed: this.undef(this.parseCurrency(x['amountOwed'] ?? x['amount'])),
      amountRemaining: this.undef(this.parseCurrency(x['amountOwed'])),
      termMonths: this.extractTermMonths(x['term']),
      interestRate: this.undef(this.parsePercent(x['interestRate'])),
      startDate: this.extractDateFromText(x['startDate']),
      appliedDate: this.extractDateFromText(x['startDate']),
      nextPaymentAmount: this.undef(this.parseCurrency(x['nextPayment'])),
      nextPaymentDate: this.extractDateFromText(x['nextPayment']),
      status: x['status'],
      statusTone: x['statusTone'],
      category,
    }));
  }

  /* ================================ HELPERS ============================== */

  // convert null to undefined for compatibility with model types
  private undef<T>(v: T | null | undefined): T | undefined {
    return v == null ? undefined : v;
  }

  private parseCurrency(input: any): number | undefined {
    if (typeof input !== 'string') return undefined;
    const m = input.match(/R\s*([\d\s,\.]+)/i);
    if (!m) return undefined;
    const num = Number(m[1].replace(/[,\s]/g, ''));
    return Number.isFinite(num) ? num : undefined;
  }

  private parsePercent(input: any): number | undefined {
    if (typeof input !== 'string') return undefined;
    const m = input.match(/([+-]?\s*\d+(?:\.\d+)?)\s*%/);
    if (!m) return undefined;
    const val = Number(m[1].replace(/\s+/g, ''));
    return Number.isFinite(val) ? val : undefined;
  }

  private splitAmountAndDate(input: any): { amount: number | undefined; dateLabel: string | undefined } {
    if (typeof input !== 'string') return { amount: undefined, dateLabel: undefined };
    const amount = this.parseCurrency(input);
    const m = input.match(/(?:•|due)\s*([0-9]{1,2}\s+[A-Za-z]{3,})/);
    return { amount, dateLabel: m ? m[1] : undefined };
  }

  private parseDateLabel(label: string): string | undefined {
    if (!label) return undefined;
    const now = new Date();
    const parsed = Date.parse(`${label} ${now.getFullYear()}`);
    return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString();
  }

  private extractDateFromText(text: any): string | undefined {
    if (typeof text !== 'string') return undefined;
    // Supports "Created Mar 06, 2024", "Submitted Mar 19, 2024", or "05/04/2024"
    const dateMatch = text.match(
      /(\d{1,2}\/\d{1,2}\/\d{4})|([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/
    );
    if (!dateMatch) return undefined;
    const dateStr = dateMatch[0];
    const parsed = new Date(dateStr);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }

  private extractTermMonths(term: any): number | undefined {
    if (typeof term !== 'string') return undefined;
    const m = term.match(/(\d+)\s*month/);
    return m ? Number(m[1]) : undefined;
  }

  private toNumber(value: any): number | undefined {
    if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
    if (typeof value === 'string') {
      const cleaned = value.replace(/[^0-9.\-]/g, '');
      if (!cleaned) return undefined;
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
  }

  private toString(value: any): string | undefined {
    if (typeof value === 'string') return value.trim() || undefined;
    if (typeof value === 'number') return String(value);
    return undefined;
  }

  private toIsoDate(value: any): string | undefined {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }
}