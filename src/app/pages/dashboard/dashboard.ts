import { Component, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WalletService } from '../../shared/services/wallet.service';

type LenderTabId = 'marketplace' | 'active' | 'history';

type BorrowerTabId = 'pending' | 'active' | 'history';

interface BorrowerSummaryItem {
  label: string;
  value: string;
  helper?: string;
  accent?: boolean;
}

interface BorrowerLoanCard {
  name: string;
  lender: string;
  amountOwed: string;
  term: string;
  startDate: string;
  interestRate: string;
  nextPayment?: string;
  interestPaid?: string;
  totalPaid?: string;
  status?: string;
  completionDate?: string;
  statusTone?: 'pending' | 'approved' | 'rejected' | 'info';
  rejectionReason?: string;
}

interface BorrowerTab {
  id: BorrowerTabId;
  label: string;
  description: string;
  loans: BorrowerLoanCard[];
}

interface LenderOverviewItem {
  label: string;
  value: string;
  accent?: boolean;
}

interface BorrowerRequest {
  id: string;
  requester: string;
  creditScore: string;
  monthlyIncome: string;
  credibility: 'Excellent' | 'Good' | 'Moderate' | 'Low';
  submittedDate: string;
  status?: 'Pending' | 'Approved' | 'Declined';
  note?: string;
  declineReason?: string;
}

interface LenderLoan {
  id: string;
  name: string;
  amount: string;
  term: string;
  interestRate: string;
  borrower?: string;
  startDate?: string;
  createdDate?: string;
  accruedInterest?: string;
  status?: string;
  durationWindow?: string;
  minCreditScore?: string;
  minMonthlyIncome?: string;
  borrowerRequests?: BorrowerRequest[];
}

interface LenderTab {
  id: LenderTabId;
  label: string;
  description: string;
  loans: LenderLoan[];
}

@Component({
  standalone: true,
  selector: 'app-dashboard',
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss'],
})
export class Dashboard {
  private readonly wallet = inject(WalletService);
  private readonly summaryData: BorrowerSummaryItem[] = [
    {
      label: 'Amount Owed',
      value: 'R 185 400',
      helper: 'Total outstanding balance across all active loans',
    },
    { label: 'Interest Paid', value: 'R 28 750', helper: 'Cumulative interest settled to date' },
    {
      label: 'Next Payment',
      value: 'R 3 250 • 30 Oct',
      helper: 'Upcoming repayment due soon',
      accent: true,
    },
  ];

  private readonly tabsData: BorrowerTab[] = [
    {
      id: 'pending',
      label: 'Pending Loans',
      description: 'Loans you have requested that are in review process.',
      loans: [
        {
          name: 'EduFlex Study Loan',
          lender: 'Issued by EduFlex Finance',
          amountOwed: 'Borrowed • R 45 000',
          term: '12 month term',
          startDate: 'Application date • 14/10/2024',
          interestRate: 'Proposed rate • 11.2%',
          status: 'Pending review',
          statusTone: 'pending'
        },
        {
          name: 'CityBuild Home Upgrade',
          lender: 'Issued by CityBuild Capital',
          amountOwed: 'Borrowed • R 95 000',
          term: '24 month term',
          startDate: 'Application date • 05/10/2024',
          interestRate: 'Proposed rate • 12.7%',
          status: 'Under review',
          statusTone: 'pending'
        }
      ]
    },
    {
      id: 'active',
      label: 'Active Loans',
      description: 'Your loans currently in progress with remaining balances and upcoming repayments.',
      loans: [
        {
          name: 'MicroFinance Personal Loan',
          lender: 'Issued by MicroFinance Inc.',
          amountOwed: 'R 68 200 remaining',
          term: '12 month term',
          startDate: 'Start date • 01/12/2023',
          interestRate: 'Interest rate • 12.0%',
          nextPayment: 'Next payment • R 3 250 due 30 Oct',
          interestPaid: 'Interest paid • R 6 400',
          status: 'Approved • On track',
          statusTone: 'approved'
        },
        {
          name: 'Loan Investments Pty',
          lender: 'Issued by Loan Investments Pty',
          amountOwed: 'R 117 200 remaining',
          term: '48 month term',
          startDate: 'Start date • 01/02/2023',
          interestRate: 'Interest rate • 13.5%',
          nextPayment: 'Next payment • R 5 100 due 12 Nov',
          interestPaid: 'Interest paid • R 22 350',
          status: 'Approved • On track',
          statusTone: 'approved'
        },
      ],
    },
    {
      id: 'history',
      label: 'Loan History',
      description: 'Your completed loans with repayment performance and totals paid off.',
      loans: [
        {
          name: 'BizStart SME Working Capital',
          lender: 'Issued by BizStart SME',
          amountOwed: 'Settled • 04/12/2023',
          term: '18 month term',
          startDate: 'Start date • 01/06/2022',
          interestRate: 'Interest rate • 11.5%',
          totalPaid: 'Total paid • R 168 400',
          status: 'Closed in good standing',
          statusTone: 'info'
        },
        {
          name: 'Harvest Co-op Seasonal Loan',
          lender: 'Issued by Harvest Co-op',
          amountOwed: 'Settled • 01/05/2023',
          term: '24 month term',
          startDate: 'Start date • 01/04/2021',
          interestRate: 'Interest rate • 10.2%',
          totalPaid: 'Total paid • R 106 200',
          status: 'Closed in good standing',
          statusTone: 'info'
        },
        {
          name: 'SwiftRide Mobility Loan',
          lender: 'Issued by SwiftRide Finance',
          amountOwed: 'Application closed • 20/09/2024',
          term: '18 month term',
          startDate: 'Application date • 28/08/2024',
          interestRate: 'Offered rate • 13.9%',
          status: 'Rejected',
          statusTone: 'rejected',
          rejectionReason: 'Insufficient disposable income for requested amount'
        },
      ],
    },
  ];

  readonly borrowerSummary = signal<BorrowerSummaryItem[]>(this.summaryData);
  readonly borrowerTabs = signal<BorrowerTab[]>(this.tabsData);
  readonly activeBorrowerTab = signal<BorrowerTabId>('active');

  readonly currentTab = computed(() =>
    this.borrowerTabs().find((tab) => tab.id === this.activeBorrowerTab())
  );

  setBorrowerTab(tab: BorrowerTabId) {
    this.activeBorrowerTab.set(tab);
  }

  private readonly lenderOverviewData: LenderOverviewItem[] = [
    { label: 'Total Value', value: 'R 1 540 000' },
    { label: 'Accumulated Interest', value: '+ 210 750' },
    { label: 'Earnings Available', value: '+ 15.8%', accent: true },
  ];

  private readonly lenderTabMeta: Record<LenderTabId, { label: string; description: string }> = {
    marketplace: {
      label: 'Loan Marketplace',
      description: 'Your newly listed loans seeking borrowers right now.',
    },
    active: {
      label: 'Active Loans',
      description: 'Your capital currently earning returns.',
    },
    history: {
      label: 'Loan History',
      description: 'Completed investments and their performance.',
    },
  };

  private readonly lenderMarketplaceLoans = signal<LenderLoan[]>([
    {
      id: 'marketplace-1',
      name: 'Forest Views',
      amount: 'ZAR10,000.00',
      term: 'Listing',
      createdDate: 'Oct 24, 2025',
      interestRate: '12%',
      status: 'New listing',
      durationWindow: '6 - 12 months',
      minCreditScore: '620',
      minMonthlyIncome: 'ZAR15,000.00',
      borrowerRequests: [
        {
          id: 'request-1',
          requester: 'Akani Mathebula',
          creditScore: '642',
          monthlyIncome: 'ZAR14,200.00',
          credibility: 'Good',
          submittedDate: 'Submitted Oct 26, 2025',
          status: 'Pending',
          note: 'Requesting funds to expand an eco-tourism cabin offering.',
        },
      ],
    },
    {
      id: 'marketplace-2',
      name: 'StayTRU Loans',
      amount: 'ZAR1,000.00',
      term: 'Listing',
      createdDate: 'Oct 24, 2025',
      interestRate: '18%',
      status: 'New listing',
      durationWindow: '6 - 12 months',
      minCreditScore: '620',
      minMonthlyIncome: 'ZAR15,000.00',
      borrowerRequests: [],
    },
    {
      id: 'marketplace-3',
      name: 'Loan Offer',
      amount: 'ZAR1,000.00',
      term: 'Listing',
      createdDate: 'Oct 24, 2025',
      interestRate: '18%',
      status: 'New listing',
      durationWindow: '6 - 12 months',
      minCreditScore: 'Not specified',
      minMonthlyIncome: 'Not specified',
      borrowerRequests: [],
    },
  ]);

  private readonly lenderActiveLoans = signal<LenderLoan[]>([
    {
      id: 'active-1',
      name: 'Loan Investments Pty',
      borrower: 'To Nthabiseng Malepe',
      amount: 'R 500 000',
      term: '48 month repayments',
      startDate: '01/02/2023',
      interestRate: '13.5%',
      accruedInterest: 'R 45 500',
    },
    {
      id: 'active-2',
      name: 'MicroFinance Inc.',
      borrower: 'To Regina Mahlangu',
      amount: 'R 60 000',
      term: '12 month repayments',
      startDate: '01/12/2023',
      interestRate: '12%',
      accruedInterest: 'R 7 200',
    },
  ]);

  private readonly lenderHistoryLoans = signal<LenderLoan[]>([
    {
      id: 'history-1',
      name: 'BizStart SME',
      borrower: 'To Vusi Dlamini',
      amount: 'R 150 000',
      term: '18 months',
      startDate: '01/06/2022',
      interestRate: '11.5%',
      accruedInterest: 'R 18 400',
      status: 'Settled 04/12/2023',
    },
    {
      id: 'history-2',
      name: 'Harvest Co-op',
      borrower: 'To Naledi Radebe',
      amount: 'R 95 000',
      term: '24 months',
      startDate: '01/04/2021',
      interestRate: '10.2%',
      accruedInterest: 'R 11 200',
      status: 'Settled 01/05/2023',
    },
  ]);

  readonly activeMode = signal<'lender' | 'borrower'>('lender');
  readonly activeLenderTab = signal<LenderTabId>('active');

  readonly lenderOverview = signal<LenderOverviewItem[]>(this.lenderOverviewData);
  readonly lenderTabs = computed<LenderTab[]>(() => [
    {
      id: 'marketplace',
      label: this.lenderTabMeta.marketplace.label,
      description: this.lenderTabMeta.marketplace.description,
      loans: this.lenderMarketplaceLoans(),
    },
    {
      id: 'active',
      label: this.lenderTabMeta.active.label,
      description: this.lenderTabMeta.active.description,
      loans: this.lenderActiveLoans(),
    },
    {
      id: 'history',
      label: this.lenderTabMeta.history.label,
      description: this.lenderTabMeta.history.description,
      loans: this.lenderHistoryLoans(),
    },
  ]);

  readonly currentLenderTab = computed<LenderTab | undefined>(() =>
    this.lenderTabs().find((tab) => tab.id === this.activeLenderTab())
  );

  readonly declineReasons: string[] = [
    'Credit score is below requirement',
    'Monthly income is below requirement',
    'Unable to verify supporting documents',
    'Requested amount exceeds risk threshold',
    'Other',
  ];

  readonly pendingWithdrawLoanId = signal<string | null>(null);
  readonly pendingDeclineRequest = signal<{ loanId: string; requestId: string } | null>(null);
  readonly selectedDeclineReason = signal<string | null>(null);

  switchMode(mode: 'borrower' | 'lender') {
    this.activeMode.set(mode);
  }

  setLenderTab(tab: LenderTabId) {
    this.activeLenderTab.set(tab);
  }

  openWithdrawModal(id: string) {
    this.pendingWithdrawLoanId.set(id);
  }

  closeWithdrawModal() {
    this.pendingWithdrawLoanId.set(null);
  }

  confirmWithdrawListing() {
    const loanId = this.pendingWithdrawLoanId();
    if (!loanId) return;
    this.withdrawListing(loanId);
    this.pendingWithdrawLoanId.set(null);
  }

  openDeclineModal(loanId: string, requestId: string) {
    this.pendingDeclineRequest.set({ loanId, requestId });
    this.selectedDeclineReason.set(null);
  }

  closeDeclineModal() {
    this.pendingDeclineRequest.set(null);
    this.selectedDeclineReason.set(null);
  }

  selectDeclineReason(reason: string) {
    this.selectedDeclineReason.set(reason);
  }

  confirmDeclineRequest() {
    const context = this.pendingDeclineRequest();
    const reason = this.selectedDeclineReason();

    if (!context || !reason) {
      return;
    }

    this.lenderMarketplaceLoans.update(loans =>
      loans.map(loan => {
        if (loan.id !== context.loanId) {
          return loan;
        }

        const borrowerRequests = loan.borrowerRequests?.map((request): BorrowerRequest => {
          if (request.id !== context.requestId) {
            return request;
          }
          return {
            ...request,
            status: 'Declined',
            declineReason: reason,
          };
        });

        return {
          ...loan,
          borrowerRequests,
        };
      })
    );

    this.closeDeclineModal();
  }

  approveRequest(loanId: string, requestId: string) {
    this.lenderMarketplaceLoans.update(loans =>
      loans.map(loan => {
        if (loan.id !== loanId) {
          return loan;
        }
        const borrowerRequests = loan.borrowerRequests?.map((request): BorrowerRequest => {
          if (request.id !== requestId) {
            return request;
          }
          return {
            ...request,
            status: 'Approved',
            declineReason: undefined,
          };
        });
        return {
          ...loan,
          borrowerRequests,
        };
      })
    );
  }

  viewBorrowerProfile(loanId: string, requestId: string) {
    console.info(`Viewing profile for request ${requestId} on loan ${loanId}`);
  }

  pendingRequestsCount(loan: LenderLoan) {
    return loan.borrowerRequests?.reduce((count, request) => {
      return request.status === 'Pending' ? count + 1 : count;
    }, 0) ?? 0;
  }

  async withdrawListing(id: string) {
    let withdrawn: LenderLoan | undefined;
    this.lenderMarketplaceLoans.update(loans => {
      const remaining: LenderLoan[] = [];
      for (const loan of loans) {
        if (loan.id === id) {
          withdrawn = loan;
        } else {
          remaining.push(loan);
        }
      }
      return remaining;
    });

    if (!withdrawn) return;

    const historyLoan: LenderLoan = {
      ...withdrawn,
      id:
        `history-${
          globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 10)
        }`,
      borrower: withdrawn.borrower,
      startDate:
        withdrawn.startDate ??
        (withdrawn.createdDate ? `Listed • ${withdrawn.createdDate}` : 'Listing date • —'),
      accruedInterest: undefined,
      status: 'Withdrawn from listing',
    };

    this.lenderHistoryLoans.update(loans => [historyLoan, ...loans]);
    const numericAmount = typeof withdrawn.amount === 'number'
      ? withdrawn.amount
      : Number(String(withdrawn.amount).replace(/[^0-9.]/g, ''));
    if (!Number.isNaN(numericAmount)) {
      await this.wallet.release(numericAmount);
    }
    if (this.activeLenderTab() === 'marketplace' && this.lenderMarketplaceLoans().length === 0) {
      this.activeLenderTab.set('history');
    }
  }
}
