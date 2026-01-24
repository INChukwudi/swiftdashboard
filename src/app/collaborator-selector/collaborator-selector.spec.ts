import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CollaboratorSelector } from './collaborator-selector';

describe('CollaboratorSelector', () => {
  let component: CollaboratorSelector;
  let fixture: ComponentFixture<CollaboratorSelector>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CollaboratorSelector]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CollaboratorSelector);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
