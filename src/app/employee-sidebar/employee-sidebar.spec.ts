import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmployeeSidebar } from './employee-sidebar';

describe('EmployeeSidebar', () => {
  let component: EmployeeSidebar;
  let fixture: ComponentFixture<EmployeeSidebar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmployeeSidebar]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EmployeeSidebar);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
