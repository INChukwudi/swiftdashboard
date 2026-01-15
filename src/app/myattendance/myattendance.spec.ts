import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Myattendance } from './myattendance';

describe('Myattendance', () => {
  let component: Myattendance;
  let fixture: ComponentFixture<Myattendance>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Myattendance]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Myattendance);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
