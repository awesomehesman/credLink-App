import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { LoanService } from '../../shared/services/loan.service';
import { LoanOffer } from '../../shared/models/loan.models';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  standalone: true,
  selector: 'app-borrow',
  imports: [CommonModule, CurrencyPipe, DatePipe],
  templateUrl: './borrow.html',
  styleUrls: ['./borrow.scss']
})
export class Borrow {
  private readonly loanService = inject(LoanService);
  private readonly auth = inject(AuthService);

  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly offers = signal<LoanOffer[]>([]);
  private readonly activeBorrowerId = signal<string | null>(null);

  readonly hasLoans = computed(
    () => !this.loading() && !this.error() && this.offers().length > 0
  );

  readonly cards = computed(() =>
    this.offers().map((offer) => ({
      id: offer.id,
      label: offer.name,
      amount: offer.amount,
      rate: offer.rate,
      term: this.describeTerm(offer),
      requirements: this.describeRequirements(offer),
      created: offer.createdAt,
      negotiable: offer.negotiable,
      badge: this.badgeForOffer(offer),
    }))
  );

  constructor() {
    effect(
      () => {
        const id = this.auth.userId();
        if (!id) {
          this.activeBorrowerId.set(null);
          this.error.set(null);
          this.offers.set([]);
          this.loading.set(false);
          return;
        }
        if (this.activeBorrowerId() === id && this.offers().length) {
          return;
        }
        this.activeBorrowerId.set(id);
        void this.loadOffers(id);
      },
      { allowSignalWrites: true }
    );
  }

  async refresh(): Promise<void> {
    const id = this.activeBorrowerId();
    if (!id) {
      return;
    }
    await this.loadOffers(id);
  }

  private async loadOffers(borrowerId: string) {
    this.loading.set(true);
    this.error.set(null);
    try {
      const offers = await this.loanService.listEligibleOffers(borrowerId);
      this.offers.set(offers);
    } catch (error) {
      console.error(error);
      this.error.set('Unable to load loan offers right now. Please try again shortly.');
    } finally {
      this.loading.set(false);
    }
  }

  private describeTerm(offer: LoanOffer): string {
    const min = offer.minDurationMonths;
    const max = offer.maxDurationMonths;
    if (min === max) {
      return `${min} month term`;
    }
    return `${min}-${max} month term`;
  }

  private describeRequirements(offer: LoanOffer): string {
    const parts: string[] = [];
    if (offer.minCreditScore) {
      parts.push(`Credit score ≥ ${offer.minCreditScore}`);
    }
    if (offer.minMonthlyIncome) {
      parts.push(`Income ≥ R${offer.minMonthlyIncome.toLocaleString('en-ZA')}`);
    }
    if (parts.length === 0) {
      return 'Flexible qualification requirements';
    }
    return parts.join(' • ');
  }

  private badgeForOffer(offer: LoanOffer): string | null {
    if (offer.status === 'Withdrawn') return 'Unavailable';
    if (offer.rate <= 12) return 'Top Match';
    if (offer.negotiable) return 'Negotiable';
    return null;
  }
}
