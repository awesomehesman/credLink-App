import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { DashboardService } from '../../shared/services/dashboard.service';
import {
  BorrowerDashboardData,
  BorrowerLoan,
  LenderBorrowerRequest,
  LenderDashboardData,
  LenderMarketplaceLoan,
  LenderPortfolioLoan,
} from '../../shared/models/dashboard.models';
import { AuthService } from '../../shared/services/auth.service';
import { WalletService } from '../../shared/services/wallet.service';
import { WalletAddFundsDialog } from '../../shared/components/header/wallet-add-dialog';
import { WalletWithdrawDialog } from '../../shared/components/header/wallet-withdraw-dialog';

type DashboardMode = 'lender' | 'borrower';
type LenderTabId = 'marketplace' | 'active' | 'history';

interface SummaryCard {
  label: string;
  value: string;
  helper?: string;
  accent?: boolean;
}

interface MarketplaceCard {
  id: string;
  title: string;
  amount?: string;
  rate?: string;
  duration?: string;
  minCreditScore?: string;
  minMonthlyIncome?: string;
  status?: string;
  created?: string;
  badge?: string;
  requests: MarketplaceRequestCard[];
}

interface MarketplaceRequestCard {
  id: string;
  borrower: string;
  submitted?: string;
  creditScore?: string;
  monthlyIncome?: string;
  credibility?: string;
  status?: string;
  note?: string;
}

interface PortfolioCard {
  id: string;
  title: string;
  borrower?: string;
  principal?: string;
  interestRate?: string;
  term?: string;
  startDate?: string;
  accruedInterest?: string;
  status?: string;
  completed?: string;
}

type BorrowerTabId = 'pending' | 'active' | 'history';

interface BorrowerLoanCard {
  id: string;
  name: string;
  lender?: string;
  amountBadge?: string;
  meta: Array<{ label: string; value: string }>;
  status?: string;
  tone?: 'pending' | 'approved' | 'rejected' | 'info';
  note?: string;
}

interface BorrowerTab {
  id: BorrowerTabId;
  label: string;
  description: string;
  emptyTitle: string;
  emptyCopy: string;
  loans: BorrowerLoanCard[];
}

@Component({
  standalone: true,
  selector: 'app-dashboard',
  imports: [CommonModule, DatePipe, MatDialogModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly auth = inject(AuthService);
  private readonly walletService = inject(WalletService);
  private readonly dashboardService = inject(DashboardService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);

  readonly activeMode = signal<DashboardMode>('lender');
  readonly activeLenderTab = signal<LenderTabId>('marketplace');
  readonly activeBorrowerTab = signal<BorrowerTabId>('active');

  private readonly lenderDashboard = signal<LenderDashboardData | null>(null);
  private readonly lenderLoadedFor = signal<string | null>(null);
  private readonly lenderLoading = signal(false);
  private readonly lenderError = signal<string | null>(null);
  private readonly lenderLastSynced = signal<Date | null>(null);

  private readonly borrowerDashboard = signal<BorrowerDashboardData | null>(null);
  private readonly borrowerLoadedFor = signal<string | null>(null);
  private readonly borrowerLoading = signal(false);
  private readonly borrowerError = signal<string | null>(null);
  private readonly borrowerLastSynced = signal<Date | null>(null);

  constructor() {
    effect(
      () => {
        const userId = this.auth.userId();
        if (!userId) {
          this.resetBorrowerState();
          return;
        }
        if (this.borrowerLoadedFor() === userId) {
          return;
        }
        this.borrowerLoadedFor.set(userId);
        void this.loadBorrowerData(userId);
      },
      { allowSignalWrites: true }
    );

    effect(
      () => {
        const userId = this.auth.userId();
        if (!userId) {
          this.resetLenderState();
          return;
        }
        if (this.lenderLoadedFor() === userId) {
          return;
        }
        this.lenderLoadedFor.set(userId);
        void this.loadLenderData(userId);
      },
      { allowSignalWrites: true }
    );
  }

  readonly lenderSummaryCards = computed<SummaryCard[]>(() => {
    const snapshot = this.lenderDashboard();
    const walletSummary = this.walletService.summary();

    if (!snapshot) {
      return [
        { label: 'Total value', value: this.formatCurrency(walletSummary.available ?? 0) },
        { label: 'Accumulated interest', value: this.formatCurrency(0) },
        { label: 'Earnings available', value: this.formatPercent(0), accent: true },
      ];
    }

    const summary = snapshot.summary;
    const lastSynced = this.lenderLastSynced();
    const helper = lastSynced ? `Updated ${lastSynced.toLocaleString()}` : undefined;

    return [
      {
        label: 'Total value',
        value: this.formatCurrency(summary.totalValue ?? walletSummary.available ?? 0),
        helper,
      },
      {
        label: 'Accumulated interest',
        value: this.formatCurrency(summary.accumulatedInterest ?? 0, { showPlus: true }),
      },
      {
        label: 'Earnings available',
        value: summary.earningsAvailablePercent !== undefined
          ? this.formatPercent(summary.earningsAvailablePercent, { showPlus: true })
          : this.formatCurrency(summary.earningsAvailableAmount ?? 0, { showPlus: true }),
        accent: true,
      },
    ];
  });

  readonly borrowerSummaryCards = computed<SummaryCard[]>(() => {
    const snapshot = this.borrowerDashboard();
    const summary = snapshot?.summary;
    const nextPaymentValue =
      summary?.nextPaymentAmount !== undefined
        ? `${this.formatCurrency(summary.nextPaymentAmount)}${
            summary?.nextPaymentDate ? ` • ${this.formatDate(summary.nextPaymentDate, 'short')}` : ''
          }`
        : summary?.nextPaymentLabel ?? 'No upcoming payment';
    const nextPaymentHelper =
      summary?.nextPaymentLabel ??
      (summary?.nextPaymentDate ? 'Upcoming repayment due soon' : 'No upcoming repayments scheduled');

    return [
      {
        label: 'Amount owed',
        value: this.formatCurrency(summary?.amountOwed ?? 0),
        helper: 'Total outstanding balance across all active loans',
      },
      {
        label: 'Interest paid',
        value: this.formatCurrency(summary?.interestPaid ?? 0),
        helper: 'Cumulative interest settled to date',
      },
      {
        label: 'Next payment',
        value: nextPaymentValue,
        helper: nextPaymentHelper,
        accent: true,
      },
    ];
  });

  readonly lenderTabs = computed(() => [
    {
      id: 'marketplace' as const,
      label: 'Loan Marketplace',
      description: 'Your newly listed loans seeking borrowers right now.',
    },
    {
      id: 'active' as const,
      label: 'Active Loans',
      description: 'Your capital currently earning returns.',
    },
    {
      id: 'history' as const,
      label: 'Loan History',
      description: 'Completed investments and their performance.',
    },
  ]);

  readonly currentLenderTab = computed(() =>
    this.lenderTabs().find(tab => tab.id === this.activeLenderTab()) ?? this.lenderTabs()[0]
  );

  readonly borrowerTabs = computed<BorrowerTab[]>(() => {
    const snapshot = this.borrowerDashboard();
    const build = (
      id: BorrowerTabId,
      label: string,
      description: string,
      emptyTitle: string,
      emptyCopy: string,
      source?: BorrowerLoan[],
    ): BorrowerTab => ({
      id,
      label,
      description,
      emptyTitle,
      emptyCopy,
      loans: (source ?? []).map(loan => this.toBorrowerCard(loan, id)),
    });

    return [
      build(
        'pending',
        'Pending Loans',
        'Loans you have requested that are in review process.',
        'No loans to show',
        'Once loans appear in this category they will be listed here.',
        snapshot?.pending
      ),
      build(
        'active',
        'Active Loans',
        'Your loans currently in progress with remaining balances and upcoming repayments.',
        'No active loans',
        'We will notify you as soon as new borrowing activity resumes.',
        snapshot?.active
      ),
      build(
        'history',
        'Loan History',
        'Your completed loans with repayment performance and totals paid off.',
        'No loan history yet',
        'Completed or closed loans will appear here for reference.',
        snapshot?.history
      ),
    ];
  });

  readonly currentBorrowerTab = computed(() => {
    const tabs = this.borrowerTabs();
    return tabs.find(tab => tab.id === this.activeBorrowerTab()) ?? tabs[0];
  });

  readonly borrowerCurrentLoans = computed(() => this.currentBorrowerTab().loans);

  readonly lenderMarketplaceCards = computed<MarketplaceCard[]>(() => {
    const data = this.lenderDashboard()?.marketplace ?? [];
    return data.map(loan => this.toMarketplaceCard(loan));
  });

  readonly lenderActiveCards = computed<PortfolioCard[]>(() => {
    const data = this.lenderDashboard()?.activeLoans ?? [];
    return data.map(loan => this.toPortfolioCard(loan));
  });

  readonly lenderHistoryCards = computed<PortfolioCard[]>(() => {
    const data = this.lenderDashboard()?.history ?? [];
    return data.map(loan => this.toPortfolioCard(loan));
  });

  readonly lenderCurrentCards = computed(() => {
    switch (this.activeLenderTab()) {
      case 'active':
        return this.lenderActiveCards();
      case 'history':
        return this.lenderHistoryCards();
      case 'marketplace':
      default:
        return this.lenderMarketplaceCards();
    }
  });

  switchMode(mode: DashboardMode) {
    this.activeMode.set(mode);
    if (mode === 'borrower') {
      this.activeBorrowerTab.set('active');
    }
  }

  setLenderTab(tab: LenderTabId) {
    this.activeLenderTab.set(tab);
  }

  setBorrowerTab(tab: BorrowerTabId) {
    this.activeBorrowerTab.set(tab);
  }

  isLenderLoading() {
    return this.lenderLoading();
  }

  lenderErrorMessage() {
    return this.lenderError();
  }

  async refreshLender() {
    const userId = this.auth.userId();
    if (!userId) return;
    await this.loadLenderData(userId, { force: true });
  }

  isBorrowerLoading() {
    return this.borrowerLoading();
  }

  borrowerErrorMessage() {
    return this.borrowerError();
  }

  async refreshBorrower() {
    const userId = this.auth.userId();
    if (!userId) return;
    await this.loadBorrowerData(userId, { force: true });
  }

  goToBorrow() {
    this.router.navigate(['/borrow']);
  }

  goToLend() {
    this.router.navigate(['/lend']);
  }

  openAddFunds() {
    this.dialog.open(WalletAddFundsDialog, {
      width: '520px',
      panelClass: 'wallet-dialog-panel',
      disableClose: true,
      data: {
        balance: this.walletService.available(),
        banks: this.walletService.banks(),
        summary: this.walletService.summary(),
      },
    });
  }

  openWithdrawFunds() {
    this.dialog
      .open(WalletWithdrawDialog, {
        width: '560px',
        panelClass: 'wallet-dialog-panel',
        disableClose: true,
        data: {
          balance: this.walletService.summary(),
          profile: this.walletService.withdrawProfile(),
        },
      })
      .afterClosed()
      .subscribe(result => {
        if (!result || typeof result.amount !== 'number') return;
        this.walletService.withdraw(result.amount, result.reference).then(ok => {
          if (!ok) {
            console.warn('Unable to withdraw funds: insufficient available balance.');
          }
        });
      });
  }

  private async loadBorrowerData(userId: string, options?: { force?: boolean }) {
    if (this.borrowerLoading()) {
      return;
    }
    if (!options?.force && this.borrowerDashboard()) {
      return;
    }
    this.borrowerLoading.set(true);
    this.borrowerError.set(null);
    try {
      const data = await this.dashboardService.loadBorrowerDashboard(userId);
      this.borrowerDashboard.set(data);
      this.borrowerLastSynced.set(new Date());
    } catch (error) {
      console.error('Unable to refresh borrower data', error);
      this.borrowerError.set('Unable to load borrower dashboard. Please try again shortly.');
    } finally {
      this.borrowerLoading.set(false);
    }
  }

  private async loadLenderData(userId: string, options?: { force?: boolean }) {
    if (this.lenderLoading()) {
      return;
    }
    if (!options?.force && this.lenderDashboard()) {
      return;
    }
    this.lenderLoading.set(true);
    this.lenderError.set(null);
    try {
      const [data] = await Promise.all([
        this.dashboardService.loadLenderDashboard(userId),
        this.walletService.refresh(),
      ]);
      this.lenderDashboard.set(data);
      this.lenderLastSynced.set(new Date());
    } catch (error) {
      console.error('Unable to refresh lender data', error);
      this.lenderError.set('Unable to load lender dashboard. Please try again shortly.');
    } finally {
      this.lenderLoading.set(false);
    }
  }

  private resetBorrowerState() {
    this.borrowerDashboard.set(null);
    this.borrowerLoadedFor.set(null);
    this.borrowerError.set(null);
  }

  private resetLenderState() {
    this.lenderDashboard.set(null);
    this.lenderLoadedFor.set(null);
    this.lenderError.set(null);
  }

  private toMarketplaceCard(loan: LenderMarketplaceLoan): MarketplaceCard {
    const badge =
      loan.tags?.[0] ??
      (loan.status && loan.status.toLowerCase().includes('new') ? 'New listing' : undefined);
    return {
      id: loan.id,
      title: loan.name,
      amount: loan.amount !== undefined ? this.formatCurrency(loan.amount) : undefined,
      rate: loan.interestRate !== undefined ? `${loan.interestRate.toFixed(1)}%` : undefined,
      duration: loan.durationLabel ?? this.describeDuration(loan.minDurationMonths, loan.maxDurationMonths),
      minCreditScore: loan.minCreditScore !== undefined ? `${loan.minCreditScore}` : undefined,
      minMonthlyIncome:
        loan.minMonthlyIncome !== undefined ? this.formatCurrency(loan.minMonthlyIncome) : undefined,
      status: loan.status,
      created: loan.createdAt,
      badge,
      requests: (loan.borrowerRequests ?? []).map(request => this.toMarketplaceRequestCard(request)),
    };
  }

  private toMarketplaceRequestCard(request: LenderBorrowerRequest): MarketplaceRequestCard {
    return {
      id: request.id,
      borrower: request.borrowerName,
      submitted: request.submittedAt,
      creditScore: request.creditScore !== undefined ? `${request.creditScore}` : undefined,
      monthlyIncome:
        request.monthlyIncome !== undefined ? this.formatCurrency(request.monthlyIncome) : undefined,
      credibility: request.credibility,
      status: request.status,
      note: request.note,
    };
  }

  private toPortfolioCard(loan: LenderPortfolioLoan): PortfolioCard {
    return {
      id: loan.id,
      title: loan.name,
      borrower: loan.borrowerName,
      principal: loan.principal !== undefined ? this.formatCurrency(loan.principal) : undefined,
      interestRate: loan.interestRate !== undefined ? `${loan.interestRate.toFixed(1)}%` : undefined,
      term: loan.termLabel ?? (loan.termMonths ? `${loan.termMonths} month term` : undefined),
      startDate: loan.startDate,
      accruedInterest:
        loan.accruedInterest !== undefined ? this.formatCurrency(loan.accruedInterest) : undefined,
      status: loan.status,
      completed: loan.completedAt,
    };
  }

  private toBorrowerCard(loan: BorrowerLoan, tab: BorrowerTabId): BorrowerLoanCard {
    const meta: Array<{ label: string; value: string }> = [];

    if (loan.termMonths) {
      meta.push({ label: 'Term', value: `${loan.termMonths} month term` });
    }

    const startDate =
      tab === 'pending'
        ? loan.appliedDate ?? loan.startDate
        : loan.startDate ?? loan.appliedDate;
    if (startDate) {
      const formattedStart = this.formatDate(startDate, 'full');
      if (formattedStart) {
        const prefix =
          tab === 'pending' || loan.statusTone === 'rejected' ? 'Application date' : 'Start date';
        meta.push({ label: 'Start date', value: `${prefix} • ${formattedStart}` });
      }
    }

    if (loan.interestRate !== undefined) {
      const prefix =
        tab === 'pending'
          ? 'Proposed rate'
          : tab === 'history' && loan.statusTone === 'rejected'
            ? 'Offered rate'
            : 'Interest rate';
      meta.push({
        label: 'Interest rate',
        value: `${prefix} • ${loan.interestRate.toFixed(1)}%`,
      });
    }

    if (tab === 'active' && loan.nextPaymentAmount !== undefined) {
      const dueDate = loan.nextPaymentDate ? this.formatDate(loan.nextPaymentDate, 'short') : '';
      const due = dueDate ? ` due ${dueDate}` : '';
      meta.push({
        label: 'Next payment',
        value: `${this.formatCurrency(loan.nextPaymentAmount)}${due}`,
      });
    }

    if (tab === 'active' && loan.interestPaid !== undefined) {
      meta.push({
        label: 'Interest paid',
        value: `Interest paid • ${this.formatCurrency(loan.interestPaid)}`,
      });
    }

    if (tab === 'history') {
      const totalPaid = loan.totalPaid ?? loan.interestPaid;
      if (totalPaid !== undefined) {
        const prefix = loan.statusTone === 'rejected' ? 'Total requested' : 'Total paid';
        meta.push({
          label: 'Total paid',
          value: `${prefix} • ${this.formatCurrency(totalPaid)}`,
        });
      }
    }

    return {
      id: loan.id,
      name: loan.name,
      lender: loan.lenderName,
      amountBadge: this.borrowerAmountBadge(loan, tab),
      meta,
      status: loan.status ?? undefined,
      tone: (loan.statusTone as BorrowerLoanCard['tone']) ?? undefined,
      note: loan.statusReason ? `Reason: ${loan.statusReason}` : undefined,
    };
  }

  private describeDuration(min?: number, max?: number) {
    if (min && max && min !== max) {
      return `${min}-${max} month term`;
    }
    if (min) {
      return `${min} month term`;
    }
    if (max) {
      return `${max} month term`;
    }
    return undefined;
  }

  private borrowerAmountBadge(loan: BorrowerLoan, tab: BorrowerTabId): string | undefined {
    if (tab === 'pending') {
      const borrowed = loan.amountBorrowed ?? loan.principal;
      return borrowed !== undefined ? `Borrowed • ${this.formatCurrency(borrowed)}` : undefined;
    }
    if (tab === 'active') {
      if (loan.amountRemaining !== undefined) {
        return `${this.formatCurrency(loan.amountRemaining)} remaining`;
      }
      if (loan.principal !== undefined) {
        return `${this.formatCurrency(loan.principal)} principal`;
      }
      return undefined;
    }
    // history
    if (loan.completedAt) {
      const settled = this.formatDate(loan.completedAt, 'short');
      return settled ? `Settled • ${settled}` : 'Settled';
    }
    if (loan.status && loan.status.toLowerCase().includes('application')) {
      return loan.status;
    }
    if (loan.status && loan.status.toLowerCase().includes('closed')) {
      return loan.status;
    }
    return loan.status ?? undefined;
  }

  private formatDate(value?: string, mode: 'short' | 'full' = 'full'): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const options: Intl.DateTimeFormatOptions =
      mode === 'short'
        ? { day: '2-digit', month: 'short' }
        : { day: '2-digit', month: '2-digit', year: 'numeric' };
    return new Intl.DateTimeFormat('en-GB', options).format(date);
  }

  private formatCurrency(value: number, options?: { showPlus?: boolean }) {
    const prefix = options?.showPlus && value > 0 ? '+ ' : '';
    const formatted = new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    }).format(value);
    return `${prefix}${formatted}`;
  }

  private formatPercent(value: number, options?: { showPlus?: boolean }) {
    if (!Number.isFinite(value)) {
      return options?.showPlus ? '+ 0%' : '0%';
    }
    const prefix = options?.showPlus && value > 0 ? '+ ' : '';
    const percentValue = value > 1 ? value : value * 100;
    return `${prefix}${percentValue.toFixed(1)}%`;
  }
}
