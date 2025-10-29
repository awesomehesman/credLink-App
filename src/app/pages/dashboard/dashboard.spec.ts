import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Dashboard } from './dashboard';
import { DashboardService } from '../../shared/services/dashboard.service';
import { WalletService } from '../../shared/services/wallet.service';
import { AuthService } from '../../shared/services/auth.service';

describe('Dashboard (Angular 20)', () => {
  const dashboardServiceStub: Partial<DashboardService> = {
    loadLenderDashboard: jasmine
      .createSpy('loadLenderDashboard')
      .and.resolveTo({ summary: { totalValue: 0, accumulatedInterest: 0 }, marketplace: [], activeLoans: [], history: [] }),
    loadBorrowerDashboard: jasmine
      .createSpy('loadBorrowerDashboard')
      .and.resolveTo({ summary: { amountOwed: 0, interestPaid: 0 }, pending: [], active: [], history: [] }),
  };

  const walletServiceStub: Partial<WalletService> = {
    summary: () => ({ accountLabel: '', available: 0, pending: 0, locked: 0, unsettled: 0 }),
    available: () => 0,
    banks: () => [],
    withdrawProfile: () => ({
      accountName: '',
      bank: '',
      branchCode: '',
      branchName: '',
      accountNumber: '',
      ficaVerified: false,
    }),
    withdraw: () => Promise.resolve(true),
    refresh: () => Promise.resolve(),
  };

  const authServiceStub: Partial<AuthService> = {
    userId: () => null,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dashboard, RouterTestingModule],
      providers: [
        { provide: DashboardService, useValue: dashboardServiceStub },
        { provide: WalletService, useValue: walletServiceStub },
        { provide: AuthService, useValue: authServiceStub },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(Dashboard);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
