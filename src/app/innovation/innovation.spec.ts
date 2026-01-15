import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Innovation } from './innovation';

describe('Innovation', () => {
  let component: Innovation;
  let fixture: ComponentFixture<Innovation>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Innovation]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Innovation);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
