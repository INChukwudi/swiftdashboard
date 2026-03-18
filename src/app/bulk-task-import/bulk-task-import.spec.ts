import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BulkTaskImport } from './bulk-task-import';

describe('BulkTaskImport', () => {
  let component: BulkTaskImport;
  let fixture: ComponentFixture<BulkTaskImport>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BulkTaskImport]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BulkTaskImport);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
