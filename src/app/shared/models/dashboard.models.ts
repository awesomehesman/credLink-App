export interface LenderDashboardSummary {
  totalValue?: number;
  accumulatedInterest?: number;
  earningsAvailablePercent?: number;
  earningsAvailableAmount?: number;
}

export interface LenderBorrowerRequest {
  id: string;
  borrowerName: string;
  submittedAt?: string;
  creditScore?: number;
  monthlyIncome?: number;
  credibility?: string;
  status?: string;
  note?: string;
}

export interface LenderMarketplaceLoan {
  id: string;
  name: string;
  amount?: number;
  interestRate?: number;
  minDurationMonths?: number;
  maxDurationMonths?: number;
  durationLabel?: string;
  minCreditScore?: number;
  minMonthlyIncome?: number;
  status?: string;
  tags?: string[];
  createdAt?: string;
  borrowerRequests?: LenderBorrowerRequest[];
}

export interface LenderPortfolioLoan {
  id: string;
  name: string;
  borrowerName?: string;
  startDate?: string;
  termMonths?: number;
  termLabel?: string;
  interestRate?: number;
  accruedInterest?: number;
  principal?: number;
  status?: string;
  completedAt?: string;
}

export interface LenderDashboardData {
  summary: LenderDashboardSummary;
  marketplace: LenderMarketplaceLoan[];
  activeLoans: LenderPortfolioLoan[];
  history: LenderPortfolioLoan[];
}

export interface BorrowerDashboardSummary {
  amountOwed?: number;
  interestPaid?: number;
  nextPaymentAmount?: number;
  nextPaymentDate?: string;
  nextPaymentLabel?: string;
}

export type BorrowerLoanCategory = 'pending' | 'active' | 'history';

export interface BorrowerLoan {
  id: string;
  name: string;
  lenderName?: string;
  principal?: number;
  amountRemaining?: number;
  amountBorrowed?: number;
  termMonths?: number;
  startDate?: string;
  appliedDate?: string;
  completedAt?: string;
  interestRate?: number;
  nextPaymentAmount?: number;
  nextPaymentDate?: string;
  interestPaid?: number;
  totalPaid?: number;
  status?: string;
  statusTone?: string;
  statusReason?: string;
  category: BorrowerLoanCategory;
}

export interface BorrowerDashboardData {
  summary: BorrowerDashboardSummary;
  pending: BorrowerLoan[];
  active: BorrowerLoan[];
  history: BorrowerLoan[];
}
