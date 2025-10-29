import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

type AuthMode = 'signin' | 'signup';

@Component({
  standalone: true,
  selector: 'app-landing',
  imports: [CommonModule],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class Landing {
  private readonly router = inject(Router);
  readonly currentYear = new Date().getFullYear();

  openAuth(mode: AuthMode) {
    const queryParams = mode === 'signin' ? {} : { mode };
    this.router.navigate(['/auth'], { queryParams });
  }
}
