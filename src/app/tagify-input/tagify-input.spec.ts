import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TagifyInput } from './tagify-input';

describe('TagifyInput', () => {
  let component: TagifyInput;
  let fixture: ComponentFixture<TagifyInput>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TagifyInput]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TagifyInput);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
