import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Myleave } from './myleave';

describe('Myleave', () => {
  let component: Myleave;
  let fixture: ComponentFixture<Myleave>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Myleave]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Myleave);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
