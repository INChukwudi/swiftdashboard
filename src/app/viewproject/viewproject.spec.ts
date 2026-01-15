import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Viewproject } from './viewproject';

describe('Viewproject', () => {
  let component: Viewproject;
  let fixture: ComponentFixture<Viewproject>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Viewproject]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Viewproject);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
