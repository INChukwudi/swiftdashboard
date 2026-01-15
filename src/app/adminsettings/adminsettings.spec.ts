import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Adminsettings } from './adminsettings';

describe('Adminsettings', () => {
  let component: Adminsettings;
  let fixture: ComponentFixture<Adminsettings>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Adminsettings]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Adminsettings);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
