// src/app/task/task.ts
import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged, skip } from 'rxjs/operators';
import { NewTaskComponent } from '../new-task/new-task';
import { TaskDrawer } from '../task-drawer/task-drawer';
import { TaskService, TaskData, Project } from '../services/task.service';

declare var bootstrap: any;

@Component({
  selector: 'app-task',
  standalone: true,
  imports: [CommonModule, FormsModule, NewTaskComponent, TaskDrawer],
  templateUrl: './task.html',
  styleUrls: ['./task.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush // ✅ Performance: OnPush strategy
})
export class Task implements OnInit, OnDestroy {
  
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  // Search and filter
  searchTerm: string = '';

  // Data
  tasks: TaskData[] = [];
  filteredTasks: TaskData[] = [];
  allTasks: TaskData[] = [];
  projects: Project[] = [];

  // Pagination
  totalItems: number = 0;
  pageSize: number = 10;
  currentPage: number = 1;
  totalPages: number = 0;
  visiblePages: number[] = [];
  pageSizeOptions: number[] = [5, 10, 25, 50];

  // UI State
  selectedTab: string = 'card';
  selectedTask: TaskData | null = null;
  isDrawerOpen = false;
  isLoading = false;

  // Statistics
  taskStats = {
    total: 0,
    completed: 0,
    inProgress: 0,
    overdue: 0,
    notStarted: 0
  };

  // ✅ Cache for computed values
  private statusBadgeCache = new Map<string, string>();
  private priorityBadgeCache = new Map<string, string>();
  private initialsCache = new Map<string, string>();
  private dateCache = new Map<string, string>();

  constructor(
    private taskService: TaskService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.setupSearch();
    this.loadInitialData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    
    // Clear caches
    this.statusBadgeCache.clear();
    this.priorityBadgeCache.clear();
    this.initialsCache.clear();
    this.dateCache.clear();
  }

  // ============= INITIAL DATA LOADING =============

  private loadInitialData(): void {
    this.loadUserTasks();
    this.loadProjects();
    this.subscribeToTaskUpdates();
  }

  // ============= SEARCH SETUP =============

  private setupSearch(): void {
    this.searchSubject.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(term => {
      this.performSearch(term);
    });
  }

  onSearchChange(term: string): void {
    this.searchTerm = term;
    this.searchSubject.next(term);
  }

  private performSearch(term: string): void {
    if (!term || term.trim() === '') {
      this.filteredTasks = [...this.allTasks];
    } else {
      const searchLower = term.toLowerCase().trim();
      
      this.filteredTasks = this.allTasks.filter(task => {
        // Search in title
        if (task.title?.toLowerCase().includes(searchLower)) return true;
        
        // Search in description
        if (task.description?.toLowerCase().includes(searchLower)) return true;
        
        // Search in status
        if (task.status?.toLowerCase().includes(searchLower)) return true;
        
        // Search in project name
        if (task.project?.title?.toLowerCase().includes(searchLower)) return true;
        
        // Search in category
        if (task.category?.title?.toLowerCase().includes(searchLower)) return true;
        
        // Search in assignee name
        if (task.assignee) {
          const fullName = `${task.assignee.firstName} ${task.assignee.lastName}`.toLowerCase();
          if (fullName.includes(searchLower)) return true;
        }
        
        // Search in collaborators
        if (task.collaborators?.length) {
          return task.collaborators.some(collab => 
            `${collab.firstName} ${collab.lastName}`.toLowerCase().includes(searchLower)
          );
        }
        
        return false;
      });
    }
    
    // Reset to first page and update pagination
    this.currentPage = 1;
    this.totalItems = this.filteredTasks.length;
    this.updatePagination();
    this.updateDisplayedTasks();
    this.cdr.markForCheck();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.filteredTasks = [...this.allTasks];
    this.currentPage = 1;
    this.totalItems = this.allTasks.length;
    this.updatePagination();
    this.updateDisplayedTasks();
    this.cdr.markForCheck();
  }

  // ============= DATA LOADING =============

  private loadUserTasks(): void {
    this.isLoading = true;
    this.cdr.markForCheck();

    this.taskService.getUserTasks()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.ok && response.data?.pageData) {
            this.allTasks = response.data.pageData;
            this.filteredTasks = [...this.allTasks];
            this.totalItems = this.allTasks.length;
            this.calculateStatistics();
            this.updatePagination();
            this.updateDisplayedTasks();
          } else {
            this.resetTaskData();
          }
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error loading tasks:', error);
          this.resetTaskData();
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  private loadProjects(): void {
    this.taskService.getProjects()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.projects = response.data;
            this.cdr.markForCheck();
          }
        },
        error: (err) => {
          console.error('Failed to load projects:', err);
          this.projects = [];
        }
      });
  }

  private resetTaskData(): void {
    this.tasks = [];
    this.allTasks = [];
    this.filteredTasks = [];
    this.totalItems = 0;
    this.totalPages = 0;
    this.visiblePages = [];
    this.taskStats = {
      total: 0,
      completed: 0,
      inProgress: 0,
      overdue: 0,
      notStarted: 0
    };
  }

  private subscribeToTaskUpdates(): void {
    this.taskService.tasks$
      .pipe(
        skip(1),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.loadUserTasks();
      });

    this.taskService.selectedTask$
      .pipe(takeUntil(this.destroy$))
      .subscribe(task => {
        this.selectedTask = task;
        this.cdr.markForCheck();
      });
  }

  reloadTasks(): void {
    this.loadUserTasks();
  }

  // ============= PAGINATION (METRONIC STYLE) =============

  private updatePagination(): void {
    this.totalPages = Math.ceil(this.totalItems / this.pageSize);
    this.calculateVisiblePages();
  }

  private calculateVisiblePages(): void {
    const pages: number[] = [];
    const maxVisiblePages = 5;
    
    if (this.totalPages <= maxVisiblePages + 2) {
      for (let i = 1; i <= this.totalPages; i++) {
        pages.push(i);
      }
    } else {
      const halfVisible = Math.floor(maxVisiblePages / 2);
      let startPage = Math.max(1, this.currentPage - halfVisible);
      let endPage = Math.min(this.totalPages, this.currentPage + halfVisible);
      
      if (this.currentPage <= halfVisible + 1) {
        endPage = maxVisiblePages;
        startPage = 1;
      }
      
      if (this.currentPage >= this.totalPages - halfVisible) {
        startPage = this.totalPages - maxVisiblePages + 1;
        endPage = this.totalPages;
      }
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
    }
    
    this.visiblePages = pages;
  }

  private updateDisplayedTasks(): void {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.tasks = this.filteredTasks.slice(startIndex, endIndex);
  }

  goToPage(page: number, event?: Event): void {
    if (event) {
      event.preventDefault();
    }
    
    if (page < 1 || page > this.totalPages || page === this.currentPage) {
      return;
    }
    
    this.currentPage = page;
    this.updatePagination();
    this.updateDisplayedTasks();
    this.scrollToTop();
    this.cdr.markForCheck();
  }

  goToFirstPage(event?: Event): void {
    if (event) event.preventDefault();
    this.goToPage(1);
  }

  goToLastPage(event?: Event): void {
    if (event) event.preventDefault();
    this.goToPage(this.totalPages);
  }

  goToPreviousPage(event?: Event): void {
    if (event) event.preventDefault();
    this.goToPage(this.currentPage - 1);
  }

  goToNextPage(event?: Event): void {
    if (event) event.preventDefault();
    this.goToPage(this.currentPage + 1);
  }

  onPageSizeChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.pageSize = parseInt(target.value, 10);
    this.currentPage = 1;
    this.updatePagination();
    this.updateDisplayedTasks();
    this.cdr.markForCheck();
  }

  private scrollToTop(): void {
    const element = document.querySelector('.card-body');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  get startItem(): number {
    if (this.totalItems === 0) return 0;
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get endItem(): number {
    return Math.min(this.currentPage * this.pageSize, this.totalItems);
  }

  get showFirstEllipsis(): boolean {
    return this.visiblePages.length > 0 && this.visiblePages[0] > 2;
  }

  get showLastEllipsis(): boolean {
    return this.visiblePages.length > 0 && this.visiblePages[this.visiblePages.length - 1] < this.totalPages - 1;
  }

  get showFirstPage(): boolean {
    return this.visiblePages.length > 0 && !this.visiblePages.includes(1);
  }

  get showLastPage(): boolean {
    return this.visiblePages.length > 0 && !this.visiblePages.includes(this.totalPages);
  }

  // ============= STATISTICS =============

  private calculateStatistics(): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    this.taskStats.total = this.allTasks.length;
    this.taskStats.completed = this.allTasks.filter(t => 
      t.status === 'Completed' || t.status === 'Complete'
    ).length;
    this.taskStats.inProgress = this.allTasks.filter(t => t.status === 'In Progress').length;
    this.taskStats.notStarted = this.allTasks.filter(t => t.status === 'Not Started').length;

    this.taskStats.overdue = this.allTasks.filter(task => {
      const dueDate = new Date(task.dueDate ?? task.due_date);
      if (!dueDate || isNaN(dueDate.getTime())) return false;
      dueDate.setHours(0, 0, 0, 0);
      return task.status === 'Overdue' || (dueDate < today && task.status !== 'Completed' && task.status !== 'Complete');
    }).length;
  }

  // ============= TAB & DRAWER =============

  selectTab(tab: string): void {
    this.selectedTab = tab;
    this.cdr.markForCheck();
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
    this.cdr.markForCheck();
  }

  closeTaskDrawer(): void {
    this.isDrawerOpen = false;
    this.taskService.setSelectedTask(null);
    this.cdr.markForCheck();
  }

  onTaskUpdated(updatedTask: TaskData): void {
    console.log('Task updated:', updatedTask);
    this.reloadTasks();
  }

  onTaskDeleted(taskId: string): void {
    console.log('Task deleted:', taskId);
    this.closeTaskDrawer();
    this.reloadTasks();
  }

  // ============= FILTERING =============

  getTasksByStatus(status: string): TaskData[] {
    return this.filteredTasks.filter(task => task.status === status);
  }

  // ============= UTILITY METHODS (OPTIMIZED WITH CACHING) =============

  getInitials(firstName: string, lastName?: string): string {
    const key = `${firstName}-${lastName}`;
    
    if (this.initialsCache.has(key)) {
      return this.initialsCache.get(key)!;
    }
    
    if (!firstName) {
      this.initialsCache.set(key, '?');
      return '?';
    }
    
    const initials = firstName.charAt(0).toUpperCase() + (lastName ? lastName.charAt(0).toUpperCase() : '');
    this.initialsCache.set(key, initials);
    return initials;
  }

  getPriorityBadgeClass(priority: string): string {
    if (this.priorityBadgeCache.has(priority)) {
      return this.priorityBadgeCache.get(priority)!;
    }
    
    const map: { [key: string]: string } = {
      'High': 'badge-light-danger',
      'Medium': 'badge-light-warning',
      'Low': 'badge-light-success'
    };
    
    const badgeClass = map[priority] || 'badge-light-secondary';
    this.priorityBadgeCache.set(priority, badgeClass);
    return badgeClass;
  }

  getStatusBadgeClass(status: string): string {
    if (this.statusBadgeCache.has(status)) {
      return this.statusBadgeCache.get(status)!;
    }
    
    const map: { [key: string]: string } = {
      'Completed': 'badge-light-success',
      'Complete': 'badge-light-success',
      'In Progress': 'badge-light-warning',
      'Under Review': 'badge-light-primary',
      'Not Started': 'badge-secondary',
      'Overdue': 'badge-light-danger'
    };
    
    const badgeClass = map[status] || 'badge-light-secondary';
    this.statusBadgeCache.set(status, badgeClass);
    return badgeClass;
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'No date';
    
    if (this.dateCache.has(dateString)) {
      return this.dateCache.get(dateString)!;
    }
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      this.dateCache.set(dateString, 'Invalid date');
      return 'Invalid date';
    }
    
    const formatted = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    
    this.dateCache.set(dateString, formatted);
    return formatted;
  }

  getProjectName(task: TaskData): string {
    return task.project?.title ?? 'Not Assigned';
  }

  // ✅ TrackBy functions for better *ngFor performance
  trackByTaskId(index: number, task: TaskData): string {
    return task.id;
  }

  trackByCollaboratorId(index: number, collab: any): string {
    return collab.id;
  }

  trackByPageNumber(index: number, page: number): number {
    return page;
  }
}