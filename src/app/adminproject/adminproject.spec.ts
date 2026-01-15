import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Adminproject } from './adminproject';

describe('Adminproject', () => {
  let component: Adminproject;
  let fixture: ComponentFixture<Adminproject>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Adminproject]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Adminproject);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
