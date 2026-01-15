import { ComponentFixture, TestBed } from '@angular/core/testing';


import { AllEmployees } from './all-employees';

describe('AllEmployees', () => {
  let component: AllEmployees;
  let fixture: ComponentFixture<AllEmployees>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AllEmployees]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AllEmployees);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
