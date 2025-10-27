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
  summary?: unknown;
  totals?: unknown;
  stats?: unknown;
  marketplace?: unknown;
  loanMarketplace?: unknown;
  marketplaceLoans?: unknown;
  activeLoans?: unknown;
  loansActive?: unknown;
  portfolio?: unknown;
  history?: unknown;
  loanHistory?: unknown;
}

interface ApiBorrowerDashboard {
  summary?: unknown;
  totals?: unknown;
  stats?: unknown;
  pending?: unknown;
  pendingLoans?: unknown;
  requests?: unknown;
  active?: unknown;
  activeLoans?: unknown;
  currentLoans?: unknown;
  history?: unknown;
  loanHistory?: unknown;
  completedLoans?: unknown;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/$/, '');

  async loadLenderDashboard(lenderId: string): Promise<LenderDashboardData> {
    const dto = await firstValueFrom(
      this.http.get<ApiLenderDashboard>(`${this.baseUrl}/api/lenders/${lenderId}/dashboard`)
    );
    return this.mapLenderDashboard(dto);
  }

  async loadBorrowerDashboard(borrowerId: string): Promise<BorrowerDashboardData> {
    const dto = await firstValueFrom(
      this.http.get<ApiBorrowerDashboard>(`${this.baseUrl}/api/borrowers/${borrowerId}/dashboard`)
    );
    return this.mapBorrowerDashboard(dto);
  }

  private mapLenderDashboard(dto: ApiLenderDashboard): LenderDashboardData {
    const summary = this.mapSummary(dto.summary ?? dto.totals ?? dto.stats ?? {});
    const marketplace = this.mapMarketplace(dto.marketplace ?? dto.loanMarketplace ?? dto.marketplaceLoans ?? []);
    const active = this.mapPortfolio(dto.activeLoans ?? dto.loansActive ?? dto.portfolio ?? []);
    const history = this.mapPortfolio(dto.history ?? dto.loanHistory ?? []);
    return {
      summary,
      marketplace,
      activeLoans: active,
      history,
    };
  }

  private mapSummary(raw: unknown): LenderDashboardSummary {
    if (!raw || typeof raw !== 'object') {
      return { totalValue: 0, accumulatedInterest: 0, earningsAvailablePercent: 0 };
    }

    const source = raw as Record<string, unknown>;
    const totalValue =
      this.toNumber(this.pick(source, 'totalValue')) ??
      this.toNumber(this.pick(source, 'totalBalance')) ??
      this.toNumber(this.pick(source, 'totalAssets'));
    const accumulatedInterest =
      this.toNumber(this.pick(source, 'accumulatedInterest')) ??
      this.toNumber(this.pick(source, 'totalInterest')) ??
      this.toNumber(this.pick(source, 'interestEarned'));
    const earningsAvailablePercent =
      this.toNumber(this.pick(source, 'earningsAvailablePercent')) ??
      this.toNumber(this.pick(source, 'earningsAvailable')) ??
      this.toNumber(this.pick(source, 'yieldPercent'));
    const earningsAvailableAmount =
      this.toNumber(this.pick(source, 'earningsAvailableAmount')) ??
      this.toNumber(this.pick(source, 'availableInterest'));

    return {
      totalValue: totalValue ?? 0,
      accumulatedInterest: accumulatedInterest ?? 0,
      earningsAvailablePercent: earningsAvailablePercent ?? undefined,
      earningsAvailableAmount: earningsAvailableAmount ?? undefined,
    };
  }

  private mapBorrowerDashboard(dto: ApiBorrowerDashboard): BorrowerDashboardData {
    const summary = this.mapBorrowerSummary(dto.summary ?? dto.totals ?? dto.stats ?? {});
    const pending = this.mapBorrowerLoans(
      dto.pending ?? dto.pendingLoans ?? dto.requests ?? [],
      'pending'
    );
    const active = this.mapBorrowerLoans(
      dto.active ?? dto.activeLoans ?? dto.currentLoans ?? [],
      'active'
    );
    const history = this.mapBorrowerLoans(
      dto.history ?? dto.loanHistory ?? dto.completedLoans ?? [],
      'history'
    );
    return {
      summary,
      pending,
      active,
      history,
    };
  }

  private mapBorrowerSummary(raw: unknown): BorrowerDashboardSummary {
    if (!raw || typeof raw !== 'object') {
      return {
        amountOwed: 0,
        interestPaid: 0,
      };
    }

    const source = raw as Record<string, unknown>;
    const amountOwed =
      this.toNumber(this.pick(source, 'amountOwed')) ??
      this.toNumber(this.pick(source, 'totalOutstanding')) ??
      this.toNumber(this.pick(source, 'outstandingBalance'));
    const interestPaid =
      this.toNumber(this.pick(source, 'interestPaid')) ??
      this.toNumber(this.pick(source, 'totalInterestPaid')) ??
      this.toNumber(this.pick(source, 'interestSettled'));
    const nextPaymentAmount =
      this.toNumber(this.pick(source, 'nextPaymentAmount')) ??
      this.toNumber(this.pick(source, 'upcomingPaymentAmount')) ??
      this.toNumber(this.pick(source, 'nextInstallmentAmount'));
    const nextPaymentDate =
      this.toIsoDate(this.pick(source, 'nextPaymentDate')) ??
      this.toIsoDate(this.pick(source, 'upcomingPaymentDate')) ??
      this.toIsoDate(this.pick(source, 'nextInstallmentDate'));
    const nextPaymentLabel =
      this.toString(this.pick(source, 'nextPaymentLabel')) ??
      this.toString(this.pick(source, 'upcomingPaymentLabel')) ??
      this.toString(this.pick(source, 'nextInstallmentLabel'));

    return {
      amountOwed: amountOwed ?? 0,
      interestPaid: interestPaid ?? 0,
      nextPaymentAmount: nextPaymentAmount ?? undefined,
      nextPaymentDate: nextPaymentDate ?? undefined,
      nextPaymentLabel: nextPaymentLabel ?? undefined,
    };
  }

  private mapBorrowerLoans(raw: unknown, category: BorrowerLoanCategory): BorrowerLoan[] {
    const list = this.toArray(raw);
    return list.map(item => {
      const source = item as Record<string, unknown>;
      const id =
        this.toId(this.pick(source, 'id')) ??
        globalThis.crypto?.randomUUID?.() ??
        Math.random().toString(36).slice(2, 11);
      const status =
        this.toString(this.pick(source, 'status')) ?? this.toString(this.pick(source, 'state'));
      const tone =
        this.normalizeTone(this.toString(this.pick(source, 'statusTone'))) ??
        this.normalizeTone(status);

      return {
        id,
        name: this.toString(this.pick(source, 'name')) ?? 'Loan',
        lenderName:
          this.toString(this.pick(source, 'lenderName')) ??
          this.toString(this.pick(source, 'lender')) ??
          this.toString(this.pick(source, 'issuer')),
        principal:
          this.toNumber(this.pick(source, 'principal')) ??
          this.toNumber(this.pick(source, 'amount')) ??
          this.toNumber(this.pick(source, 'borrowedAmount')),
        amountRemaining:
          this.toNumber(this.pick(source, 'amountRemaining')) ??
          this.toNumber(this.pick(source, 'outstandingBalance')) ??
          this.toNumber(this.pick(source, 'balanceRemaining')),
        amountBorrowed:
          this.toNumber(this.pick(source, 'amountBorrowed')) ??
          this.toNumber(this.pick(source, 'borrowedAmount')) ??
          this.toNumber(this.pick(source, 'principal')),
        termMonths:
          this.toNumber(this.pick(source, 'termMonths')) ??
          this.toNumber(this.pick(source, 'term')) ??
          undefined,
        startDate:
          this.toIsoDate(this.pick(source, 'startDate')) ??
          this.toIsoDate(this.pick(source, 'issuedAt')) ??
          this.toIsoDate(this.pick(source, 'activatedAt')),
        appliedDate:
          this.toIsoDate(this.pick(source, 'appliedDate')) ??
          this.toIsoDate(this.pick(source, 'applicationDate')),
        interestRate:
          this.toNumber(this.pick(source, 'interestRate')) ??
          this.toNumber(this.pick(source, 'rate')),
        nextPaymentAmount:
          this.toNumber(this.pick(source, 'nextPaymentAmount')) ??
          this.toNumber(this.pick(source, 'upcomingPaymentAmount')),
        nextPaymentDate:
          this.toIsoDate(this.pick(source, 'nextPaymentDate')) ??
          this.toIsoDate(this.pick(source, 'upcomingPaymentDate')),
        interestPaid:
          this.toNumber(this.pick(source, 'interestPaid')) ??
          this.toNumber(this.pick(source, 'interestSettled')),
        totalPaid:
          this.toNumber(this.pick(source, 'totalPaid')) ??
          this.toNumber(this.pick(source, 'amountPaid')) ??
          this.toNumber(this.pick(source, 'principalSettled')),
        completedAt:
          this.toIsoDate(this.pick(source, 'completedAt')) ??
          this.toIsoDate(this.pick(source, 'settledAt')) ??
          this.toIsoDate(this.pick(source, 'closedAt')),
        status,
        statusTone: tone,
        statusReason:
          this.toString(this.pick(source, 'statusReason')) ??
          this.toString(this.pick(source, 'note')) ??
          this.toString(this.pick(source, 'reason')),
        category,
      };
    });
  }

  private mapMarketplace(raw: unknown): LenderMarketplaceLoan[] {
    const list = this.toArray(raw);
    return list.map(item => {
      const source = item as Record<string, unknown>;
      const duration = this.resolveDuration(source);
      const id =
        this.toId(this.pick(source, 'id')) ??
        globalThis.crypto?.randomUUID?.() ??
        Math.random().toString(36).slice(2, 11);
      return {
        id,
        name: this.toString(this.pick(source, 'name')) ?? 'Untitled loan',
        amount:
          this.toNumber(this.pick(source, 'amount')) ??
          this.toNumber(this.pick(source, 'targetAmount')) ??
          this.toNumber(this.pick(source, 'principal')),
        interestRate:
          this.toNumber(this.pick(source, 'interestRate')) ??
          this.toNumber(this.pick(source, 'rate')),
        minDurationMonths: duration?.min,
        maxDurationMonths: duration?.max,
        durationLabel: duration?.label,
        minCreditScore:
          this.toNumber(this.pick(source, 'minCreditScore')) ??
          this.toNumber(this.pick(source, 'minimumCreditScore')) ??
          this.toNumber(this.pick(source, 'creditScoreMin')),
        minMonthlyIncome:
          this.toNumber(this.pick(source, 'minMonthlyIncome')) ??
          this.toNumber(this.pick(source, 'minimumMonthlyIncome')) ??
          this.toNumber(this.pick(source, 'monthlyIncomeMin')),
        status: this.toString(this.pick(source, 'status')) ?? undefined,
        tags: this.toArray(this.pick(source, 'tags'))
          .map(value => this.toString(value))
          .filter(Boolean) as string[],
        createdAt:
          this.toIsoDate(this.pick(source, 'createdAt')) ??
          this.toIsoDate(this.pick(source, 'listedAt')) ??
          this.toIsoDate(this.pick(source, 'created')),
        borrowerRequests: this.mapBorrowerRequests(
          this.pick(source, 'borrowerRequests') ??
            this.pick(source, 'requests') ??
            this.pick(source, 'applications') ??
            []
        ),
      };
    });
  }

  private mapPortfolio(raw: unknown): LenderPortfolioLoan[] {
    const list = this.toArray(raw);
    return list.map(item => {
      const source = item as Record<string, unknown>;
      const duration = this.resolveDuration(source);
      const id =
        this.toId(this.pick(source, 'id')) ??
        globalThis.crypto?.randomUUID?.() ??
        Math.random().toString(36).slice(2, 11);
      return {
        id,
        name: this.toString(this.pick(source, 'name')) ?? 'Loan',
        borrowerName:
          this.toString(this.pick(source, 'borrowerName')) ??
          this.toString(this.pick(source, 'borrower')) ??
          this.toString(this.pick(source, 'to')),
        startDate:
          this.toIsoDate(this.pick(source, 'startDate')) ??
          this.toIsoDate(this.pick(source, 'issuedAt')) ??
          this.toIsoDate(this.pick(source, 'openedAt')),
        termMonths:
          this.toNumber(this.pick(source, 'termMonths')) ??
          this.toNumber(this.pick(source, 'term')) ??
          duration?.min ??
          undefined,
        termLabel:
          this.toString(this.pick(source, 'termLabel')) ??
          duration?.label ??
          (this.toNumber(this.pick(source, 'termMonths'))
            ? `${this.toNumber(this.pick(source, 'termMonths'))} month term`
            : undefined),
        interestRate:
          this.toNumber(this.pick(source, 'interestRate')) ??
          this.toNumber(this.pick(source, 'rate')),
        accruedInterest:
          this.toNumber(this.pick(source, 'accruedInterest')) ??
          this.toNumber(this.pick(source, 'interestAccrued')),
        principal:
          this.toNumber(this.pick(source, 'amount')) ??
          this.toNumber(this.pick(source, 'principal')) ??
          this.toNumber(this.pick(source, 'originalAmount')),
        status: this.toString(this.pick(source, 'status')) ?? undefined,
        completedAt:
          this.toIsoDate(this.pick(source, 'completedAt')) ??
          this.toIsoDate(this.pick(source, 'settledAt')) ??
          this.toIsoDate(this.pick(source, 'closedAt')),
      };
    });
  }

  private mapBorrowerRequests(raw: unknown): LenderBorrowerRequest[] {
    return this.toArray(raw).map(item => {
      const source = item as Record<string, unknown>;
      const id =
        this.toId(this.pick(source, 'id')) ??
        globalThis.crypto?.randomUUID?.() ??
        Math.random().toString(36).slice(2, 11);
      return {
        id,
        borrowerName:
          this.toString(this.pick(source, 'borrowerName')) ??
          this.toString(this.pick(source, 'requester')) ??
          this.toString(this.pick(source, 'name')) ??
          'Borrower',
        submittedAt:
          this.toIsoDate(this.pick(source, 'submittedAt')) ??
          this.toIsoDate(this.pick(source, 'requestedAt')) ??
          this.toIsoDate(this.pick(source, 'createdAt')),
        creditScore:
          this.toNumber(this.pick(source, 'creditScore')) ??
          this.toNumber(this.pick(source, 'score')) ??
          undefined,
        monthlyIncome:
          this.toNumber(this.pick(source, 'monthlyIncome')) ??
          this.toNumber(this.pick(source, 'income')) ??
          this.toNumber(this.pick(source, 'monthlyEarnings')),
        credibility:
          this.toString(this.pick(source, 'credibility')) ??
          this.toString(this.pick(source, 'riskProfile')) ??
          this.toString(this.pick(source, 'statusLabel')),
        status: this.toString(this.pick(source, 'status')) ?? undefined,
        note:
          this.toString(this.pick(source, 'note')) ??
          this.toString(this.pick(source, 'summary')) ??
          undefined,
      };
    });
  }

  private resolveDuration(source: Record<string, unknown>) {
    const durationSource = this.pick(source, 'duration');
    const durationField =
      typeof durationSource === 'object' && durationSource !== null
        ? (durationSource as Record<string, unknown>)
        : undefined;
    const min =
      this.toNumber(this.pick(source, 'minDurationMonths')) ??
      this.toNumber(this.pick(source, 'minimumDurationMonths')) ??
      this.toNumber(this.pick(source, 'durationMin')) ??
      (durationField ? this.toNumber(this.pick(durationField, 'min')) : undefined);
    const max =
      this.toNumber(this.pick(source, 'maxDurationMonths')) ??
      this.toNumber(this.pick(source, 'maximumDurationMonths')) ??
      this.toNumber(this.pick(source, 'durationMax')) ??
      (durationField ? this.toNumber(this.pick(durationField, 'max')) : undefined);
    const label =
      this.toString(this.pick(source, 'durationLabel')) ??
      this.toString(this.pick(source, 'durationWindow')) ??
      this.toString(this.pick(source, 'duration')) ??
      (min && max ? `${min} - ${max} months` : min ? `${min} month term` : undefined);
    return { min, max, label };
  }

  private toArray(value: unknown): unknown[] {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    return [value];
  }

  private toNumber(value: unknown): number | undefined {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : undefined;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      const cleaned = trimmed.replace(/[^0-9.+-]/g, '');
      if (!cleaned) return undefined;
      const parsed = Number(cleaned);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    if (typeof value === 'object' && value !== null) {
      if ('amount' in value) {
        return this.toNumber(this.pick(value as Record<string, unknown>, 'amount'));
      }
      if ('value' in value) {
        return this.toNumber(this.pick(value as Record<string, unknown>, 'value'));
      }
    }
    return undefined;
  }

  private toString(value: unknown): string | undefined {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed ? trimmed : undefined;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
    return undefined;
  }

  private toIsoDate(value: unknown): string | undefined {
    if (!value) return undefined;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString();
    }
    if (typeof value === 'string') {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
    return undefined;
  }

  private toId(value: unknown): string | undefined {
    const id = this.toString(value);
    return id ?? undefined;
  }

  private pick(source: Record<string, unknown>, key: string): unknown {
    return source?.[key as keyof typeof source];
  }

  private normalizeTone(value?: string | null): string | undefined {
    if (!value) return undefined;
    const normalized = value.toLowerCase();
    if (normalized.includes('pending') || normalized.includes('review')) {
      return 'pending';
    }
    if (
      normalized.includes('approved') ||
      normalized.includes('active') ||
      normalized.includes('settled') ||
      normalized.includes('current')
    ) {
      return 'approved';
    }
    if (normalized.includes('reject') || normalized.includes('declin')) {
      return 'rejected';
    }
    return 'info';
  }
}
