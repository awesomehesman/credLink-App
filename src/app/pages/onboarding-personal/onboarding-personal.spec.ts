import { TestBed } from '@angular/core/testing';
import { OnboardingPersonal } from './onboarding-personal';
import { ProfileService } from '../../shared/services/profile.service';

describe('Onboarding personal (Angular 20)', () => {
  beforeEach(async () => {
    const profileStub = {
      fetchPersonalInfo: jasmine.createSpy().and.returnValue(Promise.resolve(null)),
      savePersonalInfo: jasmine.createSpy().and.returnValue(Promise.resolve(true)),
    };
    await TestBed.configureTestingModule({
      imports: [OnboardingPersonal],
      providers: [{ provide: ProfileService, useValue: profileStub }],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(OnboardingPersonal);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
