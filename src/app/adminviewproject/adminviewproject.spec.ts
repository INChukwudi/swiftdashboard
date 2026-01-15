import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Adminviewproject } from './adminviewproject';

describe('Adminviewproject', () => {
  let component: Adminviewproject;
  let fixture: ComponentFixture<Adminviewproject>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Adminviewproject]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Adminviewproject);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
