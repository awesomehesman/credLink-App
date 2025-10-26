
import { Component, computed, EventEmitter, inject, Output, signal } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { WalletAddFundsDialog } from './wallet-add-dialog';
import { WalletWithdrawDialog } from './wallet-withdraw-dialog';
import { WalletService, WALLET_BANKS } from '../../services/wallet.service';


@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatDialogModule,
    RouterLink,
    CurrencyPipe
  ],
  templateUrl: './header.html',
  styleUrls: ['./header.scss']
})
export class Header {
  private readonly dialog = inject(MatDialog);
  private readonly wallet = inject(WalletService);
  @Output() menuToggle = new EventEmitter<void>();

  readonly walletBalance = computed(() => this.wallet.available());
  readonly walletSummary = computed(() => this.wallet.summary());
  readonly walletBanks = signal(WALLET_BANKS);

  toggleMenu() {
    this.menuToggle.emit();
  }

  openAddFunds() {
    this.dialog.open(WalletAddFundsDialog, {
      width: '520px',
      panelClass: 'wallet-dialog-panel',
      disableClose: true,
      data: {
        balance: this.walletBalance(),
        banks: this.walletBanks(),
        summary: this.walletSummary()
      }
    });
  }

  openWithdraw() {
    this.dialog.open(WalletWithdrawDialog, {
      width: '560px',
      panelClass: 'wallet-dialog-panel',
      disableClose: true,
      data: {
        balance: this.walletSummary(),
        profile: this.wallet.withdrawProfile()
      }
    }).afterClosed().subscribe(result => {
      if (!result || typeof result.amount !== 'number') return;
      this.wallet.withdraw(result.amount, result.reference).then((ok) => {
        if (!ok) {
          console.warn('Unable to withdraw funds: insufficient available balance.');
        }
      });
    });
  }
}
