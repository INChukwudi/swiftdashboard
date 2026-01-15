import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmployeeHeader } from './employee-header';

describe('EmployeeHeader', () => {
  let component: EmployeeHeader;
  let fixture: ComponentFixture<EmployeeHeader>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmployeeHeader]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EmployeeHeader);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
