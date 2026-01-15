import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Staffprofile } from './staffprofile';

describe('Staffprofile', () => {
  let component: Staffprofile;
  let fixture: ComponentFixture<Staffprofile>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Staffprofile]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Staffprofile);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
