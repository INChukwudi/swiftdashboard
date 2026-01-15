import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Alltask } from './alltask';

describe('Alltask', () => {
  let component: Alltask;
  let fixture: ComponentFixture<Alltask>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Alltask]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Alltask);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
