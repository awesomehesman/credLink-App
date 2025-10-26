
import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { LoanService } from '../../shared/services/loan.service';
import { AuthService } from '../../shared/services/auth.service';
import { WalletService } from '../../shared/services/wallet.service';
import { CurrencyPipe, DatePipe, NgIf } from '@angular/common';
import { LoanOffer } from '../../shared/models/loan.models';
import { WalletAddFundsDialog } from '../../shared/components/header/wallet-add-dialog';

@Component({
  standalone: true,
  selector: 'app-lend',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    NgIf,
    CurrencyPipe,
    DatePipe
  ],
  templateUrl: './lend.html',
  styleUrl: './lend.scss'
})
export class Lend implements OnInit {
  form!: FormGroup;
  readonly pageSize = 10;

  private readonly wallet = inject(WalletService);
  private readonly dialog = inject(MatDialog);
  private readonly fb = inject(FormBuilder);
  readonly loans = inject(LoanService);
  readonly auth = inject(AuthService);

  readonly submitError = signal<string | null>(null);
  readonly editingOffer = signal<LoanOffer | null>(null);
  readonly currentPage = signal(0);

  readonly walletAvailable = computed(() => this.wallet.available());
  readonly hasAvailableFunds = computed(() => this.walletAvailable() > 0);
  readonly remainingBalance = computed(() => {
    const amount = Number(this.form?.get('amount')?.value ?? 0);
    const available = this.walletAvailable();
    if (this.editingOffer()) {
      const original = this.editingOffer()!.amount;
      const delta = (isNaN(amount) ? 0 : amount) - original;
      return +(available - delta).toFixed(2);
    }
    return +(available - (isNaN(amount) ? 0 : amount)).toFixed(2);
  });

  readonly offers = computed(() =>
    this.loans.myOffers(this.auth.userId() || 'anon')
  );
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.offers().length / this.pageSize)));
  readonly pagedOffers = computed(() => {
    const start = this.currentPage() * this.pageSize;
    return this.offers().slice(start, start + this.pageSize);
  });

  constructor() {
    effect(() => {
      const _available = this.walletAvailable();
      this.form?.get('amount')?.updateValueAndValidity({ onlySelf: true, emitEvent: false });
    });
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(4)]],
      amount: [100, [Validators.required, Validators.min(100), Validators.max(1_000_000), this.maxAvailableValidator.bind(this)]],
      rate: [9, [Validators.required, Validators.min(9), Validators.max(30)]],
      minDurationMonths: [1, [Validators.required, Validators.min(1), Validators.max(72)]],
      maxDurationMonths: [12, [Validators.required, Validators.min(1), Validators.max(72)]],
      minCreditScore: [null, [this.optionalMinValidator(400)]],
      minMonthlyIncome: [null, [Validators.min(0)]]
    });

    this.loans.refreshMyOffers();
  }

  private maxAvailableValidator(control: AbstractControl): ValidationErrors | null {
    const available = this.walletAvailable() + (this.editingOffer()?.amount ?? 0);
    const value = Number(control.value);
    if (isNaN(value)) return { invalidAmount: true };
    if (value > available) {
      return { exceedsWallet: { available } };
    }
    return null;
  }

  private optionalMinValidator(min: number): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;
      if (value === null || value === undefined || value === '') {
        return null;
      }
      const numeric = Number(value);
      if (Number.isNaN(numeric)) {
        return { minValue: { min } };
      }
      return numeric < min ? { minValue: { min } } : null;
    };
  }

  resetForm() {
    this.form.reset({
      name: '',
      amount: 100,
      rate: 9,
      minDurationMonths: 1,
      maxDurationMonths: 12,
      minCreditScore: null,
      minMonthlyIncome: null
    });
    this.editingOffer.set(null);
    this.submitError.set(null);
  }

  editOffer(offer: LoanOffer) {
    this.editingOffer.set(offer);
    this.form.reset({
      name: offer.name,
      amount: offer.amount,
      rate: offer.rate,
      minDurationMonths: offer.minDurationMonths,
      maxDurationMonths: offer.maxDurationMonths,
      minCreditScore: offer.minCreditScore ?? null,
      minMonthlyIncome: offer.minMonthlyIncome ?? null
    });
    this.submitError.set(null);
  }

  async submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const payload = this.form.value;
    const parseOptionalNumber = (value: unknown) => {
      if (value === null || value === undefined || value === '') {
        return undefined;
      }
      const numeric = Number(value);
      return Number.isNaN(numeric) ? undefined : numeric;
    };

    const request = {
      name: payload.name,
      amount: Number(payload.amount),
      rate: Number(payload.rate),
      minDurationMonths: Number(payload.minDurationMonths),
      maxDurationMonths: Number(payload.maxDurationMonths),
      minCreditScore: parseOptionalNumber(payload.minCreditScore),
      minMonthlyIncome: parseOptionalNumber(payload.minMonthlyIncome),
      negotiable: false
    };

    if (request.maxDurationMonths < request.minDurationMonths) {
      this.submitError.set('Max duration must be greater than or equal to min duration.');
      return;
    }

    const editing = this.editingOffer();
    let ok = false;
    if (editing) {
      ok = await this.loans.updateOffer(editing.id, request as any);
      if (!ok) {
        this.submitError.set('Unable to update offer. Ensure there are no borrower conflicts and sufficient wallet funds.');
        return;
      }
    } else {
      ok = await this.loans.createOffer(request as any);
      if (!ok) {
        this.submitError.set('Unable to create loan offer. Check wallet balance or try again.');
        return;
      }
    }

    this.resetForm();
    this.currentPage.set(0);
  }

  async withdraw(id: string) {
    const success = await this.loans.removeOffer(id);
    if (!success) {
      this.submitError.set('Unable to withdraw this loan. Ensure it has no pending borrower requests.');
    }
  }

  openAddFunds() {
    this.dialog.open(WalletAddFundsDialog, {
      width: '520px',
      panelClass: 'wallet-dialog-panel',
      disableClose: true,
      data: {
        balance: this.walletAvailable(),
        banks: this.wallet.banks(),
        summary: this.wallet.summary()
      }
    });
  }

  requestsFor(offerId: string) {
    return this.loans.offerRequests(offerId);
  }

  canModify(offerId: string) {
    return this.loans.canModifyOffer(offerId);
  }

  prevPage() {
    if (this.currentPage() > 0) {
      this.currentPage.set(this.currentPage() - 1);
    }
  }

  nextPage() {
    if (this.currentPage() < this.totalPages() - 1) {
      this.currentPage.set(this.currentPage() + 1);
    }
  }

  decide(offerId: string, reqId: string, approve: boolean) {
    this.loans.decide(offerId, reqId, approve);
  }
}
