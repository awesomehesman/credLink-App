import { TestBed } from '@angular/core/testing';
import { Borrow } from './borrow';
import { LoanService } from '../../shared/services/loan.service';
import { AuthService } from '../../shared/services/auth.service';

describe('Borrow (Angular 20)', () => {
  beforeEach(async () => {
    const loanStub = {
      listEligibleOffers: jasmine.createSpy().and.returnValue(Promise.resolve([])),
    };
    const authStub = {
      userId: jasmine.createSpy().and.returnValue('user-1'),
    };
    await TestBed.configureTestingModule({
      imports: [Borrow],
      providers: [
        { provide: LoanService, useValue: loanStub },
        { provide: AuthService, useValue: authStub },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(Borrow);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
