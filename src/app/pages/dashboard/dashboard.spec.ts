import { TestBed } from '@angular/core/testing';
import { Dashboard } from './dashboard';

describe('Dashboard (Angular 20)', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dashboard]
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(Dashboard);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
