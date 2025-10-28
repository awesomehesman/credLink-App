
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
import { WalletService } from '../../services/wallet.service';

interface WalletBank {
  id: string;
  name: string;
  accountName: string;
  branchCode: string;
  branchName: string;
  accountNumber: string;
  reference: string;
}

const WALLET_BANKS: WalletBank[] = [
  {
    id: 'absa',
    name: 'ABSA',
    accountName: 'CredLink Nominees (RF) (PTY) LTD',
    branchCode: '632005',
    branchName: 'Melrose Arch',
    accountNumber: '4096150463',
    reference: 'CL-ABSA-784563'
  },
  {
    id: 'fnb',
    name: 'FNB',
    accountName: 'CredLink Nominees (RF) (PTY) LTD',
    branchCode: '255005',
    branchName: 'Sandton City',
    accountNumber: '62145698712',
    reference: 'CL-FNB-784563'
  },
  {
    id: 'standard',
    name: 'Standard Bank',
    accountName: 'CredLink Nominees (RF) (PTY) LTD',
    branchCode: '051001',
    branchName: 'Rosebank',
    accountNumber: '000245879',
    reference: 'CL-SB-784563'
  }
];

const WITHDRAW_DETAILS = {
  accountName: 'K Hesman',
  bank: 'Capitec',
  branchCode: '470010',
  branchName: '470010',
  accountNumber: '154899XXXX',
  ficaVerified: true
};

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
        profile: WITHDRAW_DETAILS
      }
    }).afterClosed().subscribe(result => {
      if (!result || typeof result.amount !== 'number') return;
      const ok = this.wallet.withdraw(result.amount);
      if (!ok) console.warn('Unable to withdraw funds: insufficient available balance.');
    });
  }
}
