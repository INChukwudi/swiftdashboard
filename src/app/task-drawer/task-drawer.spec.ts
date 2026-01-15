import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TaskDrawer } from './task-drawer';

describe('TaskDrawer', () => {
  let component: TaskDrawer;
  let fixture: ComponentFixture<TaskDrawer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaskDrawer]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TaskDrawer);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
