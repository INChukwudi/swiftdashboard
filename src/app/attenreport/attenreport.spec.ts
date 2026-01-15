import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Attenreport } from './attenreport';

describe('Attenreport', () => {
  let component: Attenreport;
  let fixture: ComponentFixture<Attenreport>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Attenreport]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Attenreport);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
