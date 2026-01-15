// src/app/task/task.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { NewTaskComponent } from '../new-task/new-task';
import { TaskDrawer } from '../task-drawer/task-drawer';
import { TaskService, TaskData, Project } from '../services/task.service';

declare var bootstrap: any;

@Component({
  selector: 'app-task',
  standalone: true,
  imports: [CommonModule, NewTaskComponent, TaskDrawer],
  templateUrl: './task.html',
  styleUrls: ['./task.scss'],
})
export class Task implements OnInit, OnDestroy {
  selectedTab: string = 'card';

  // State
  tasks: TaskData[] = [];
  projects: Project[] = []; // Optional: if you still want to show projects
  selectedTask: TaskData | null = null;
  isDrawerOpen = false;
  isLoading = false;

  // Statistics
  taskStats = {
    total: 0,
    completed: 0,
    inProgress: 0,
    overdue: 0,
    notStarted: 0,
  };

  private destroy$ = new Subject<void>();

  constructor(private taskService: TaskService) {}

  ngOnInit(): void {
    this.loadUserTasks(); // Now this is the correct method
    this.subscribeToTaskUpdates();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============= DATA LOADING =============

  private loadUserTasks(): void {
    this.isLoading = true;
  
    this.taskService.getUserTasks()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.ok && response.data?.pageData) {
            this.tasks = response.data.pageData;  // ← Correct path
            this.calculateStatistics();
          } else {
            console.warn('No tasks or invalid response');
            this.tasks = [];
          }
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading tasks:', error);
          this.tasks = [];
          this.isLoading = false;
        }
      });
  }

  private subscribeToTaskUpdates(): void {
    this.taskService.tasks$
      .pipe(takeUntil(this.destroy$))
      .subscribe(tasks => {
        this.tasks = tasks;
        this.calculateStatistics();
      });

    this.taskService.selectedTask$
      .pipe(takeUntil(this.destroy$))
      .subscribe(task => {
        this.selectedTask = task;
      });
  }

  reloadTasks(): void {
    this.loadUserTasks();
  }

  // ============= STATISTICS =============

  private calculateStatistics(): void {
    const today = new Date();
  
    this.taskStats.total = this.tasks.length;
    this.taskStats.completed = this.tasks.filter(t => t.status === 'Completed').length;
    this.taskStats.inProgress = this.tasks.filter(t => t.status === 'In Progress').length;
    this.taskStats.notStarted = this.tasks.filter(t => t.status === 'Not Started').length;
  
    this.taskStats.overdue = this.tasks.filter(task => {
      const dueDate = new Date(task.dueDate ?? task.due_date); // support both
      if (!dueDate) return false;
  
      // Consider both tasks already marked 'Overdue' or past due date
      return task.status === 'Overdue' || (dueDate < today && task.status !== 'Completed');
    }).length;
  }
  

  // ============= TAB & DRAWER =============

  selectTab(tab: string): void {
    this.selectedTab = tab;
  }

  openTaskModal(): void {
    const modalElement = document.getElementById('kt_modal_new_target');
    if (modalElement) {
      const modal = new bootstrap.Modal(modalElement);
      modal.show();
    }
  }

  onTaskCreated(task: TaskData): void {
    console.log('Task created:', task);
    this.reloadTasks();
  }

  openTaskDrawer(task: TaskData): void {
    this.taskService.setSelectedTask(task);
    this.isDrawerOpen = true;
  }

  closeTaskDrawer(): void {
    this.isDrawerOpen = false;
    this.taskService.setSelectedTask(null);
  }

  onTaskUpdated(updatedTask: TaskData): void {
    console.log('Task updated:', updatedTask);
  }

  onTaskDeleted(taskId: string): void {
    console.log('Task deleted:', taskId);
    this.closeTaskDrawer();
    this.reloadTasks();
  }

  // ============= FILTERING =============

  getTasksByStatus(status: string): TaskData[] {
    return this.tasks.filter(task => task.status === status);
  }

  getOverdueTasks(): TaskData[] {
    return this.taskService.getOverdueTasks();
  }

  // ============= UTILITY =============

  getPriorityBadgeClass(priority: string): string {
    const map: { [key: string]: string } = {
      'High': 'badge-light-danger',
      'Medium': 'badge-light-warning',
      'Low': 'badge-light-success'
    };
    return map[priority] || 'badge-light-secondary';
  }

  getStatusBadgeClass(status: string): string {
    const map: { [key: string]: string } = {
      'Completed': 'badge-light-success',
      'In Progress': 'badge-light-warning',
      'Under Review': 'badge-light-primary',
      'Not Started': 'badge-secondary',
      'Overdue': 'badge-light-danger'
    };
    return map[status] || 'badge-light-secondary';
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'No date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  getProjectName(task: TaskData): string {
    return task.project?.title ?? 'Not Assigned';
  }

  trackByTaskId(index: number, task: TaskData): string {
    return task.id;
  }
  
}
