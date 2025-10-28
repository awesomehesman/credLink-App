
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { Header } from './shared/components/header/header';
import { Sidenav } from './shared/components/sidenav/sidenav';
import { AuthService } from './shared/services/auth.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith, tap } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, MatSidenavModule, Header, Sidenav],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class AppRoot {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly shellRoutes = ['/dashboard', '/lend', '/borrow', '/settings'] as const;
  readonly sidenavOpen = signal(false);
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      tap(() => this.sidenavOpen.set(false)),
      map(event => event.urlAfterRedirects),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  );

  showShell = computed(() => {
    if (!this.auth.isApproved()) return false;
    const url = this.currentUrl();
    return this.shellRoutes.some(route => url.startsWith(route));
  });

  toggleSidenav() {
    this.sidenavOpen.update(open => !open);
  }

  closeSidenav() {
    this.sidenavOpen.set(false);
  }
}
