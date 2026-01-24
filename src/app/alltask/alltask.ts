// src/app/alltask/alltask.ts
import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged, skip } from 'rxjs/operators';
import { NewTaskComponent } from '../new-task/new-task';
import { TaskDrawer } from '../task-drawer/task-drawer';
import { TaskService, TaskData, Project, ApiResponse, PageData } from '../services/task.service';

@Component({
  selector: 'app-alltask',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TaskDrawer,
    NewTaskComponent
  ],
  templateUrl: './alltask.html',
  styleUrl: './alltask.scss',
  changeDetection: ChangeDetectionStrategy.OnPush // ✅ Performance: OnPush strategy
})
export class Alltask implements OnInit, OnDestroy {

  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  // Search and filter
  searchTerm: string = '';
  dateRangePreset: string = '';
  dateRangeDisplay: string = '';
  startDate: Date | null = null;
  endDate: Date | null = null;

  // Data
  tasks: TaskData[] = [];
  filteredTasks: TaskData[] = [];
  allTasks: TaskData[] = [];
  totalItems: number = 0;
  pageSize: number = 25; // ✅ Reduced default for faster initial load
  currentPage: number = 1;
  projects: Project[] = [];

  // Pagination
  totalPages: number = 0;
  visiblePages: number[] = [];
  pageSizeOptions: number[] = [10, 25, 50, 100];

  // UI State
  selectedTab: string = 'card';
  selectedTask: TaskData | null = null;
  isDrawerOpen = false;
  isLoading = false;

  // Statistics
  globalStats = {
    total: 0,
    completed: 0,
    inProgress: 0,
    overdue: 0
  };
  
  isLoadingStats = false;

  // ✅ Cache for computed values
  private statusBadgeCache = new Map<string, string>();
  private initialsCache = new Map<string, string>();
  private dateCache = new Map<string, string>();

  constructor(
    private taskService: TaskService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.setupSearch();
    
    // ✅ Load data in parallel for faster initial load
    this.loadInitialData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    
    // Clear caches
    this.statusBadgeCache.clear();
    this.initialsCache.clear();
    this.dateCache.clear();
  }

  // ============= INITIAL DATA LOADING (PARALLEL) =============

  private loadInitialData(): void {
    // ✅ Load all data in parallel
    this.loadTasks();
    this.loadGlobalStats();
    this.loadProjects();
    this.subscribeToTaskUpdates();
  }

  // ============= SEARCH SETUP =============
  
  private setupSearch(): void {
    this.searchSubject.pipe(
      debounceTime(250), // ✅ Slightly reduced debounce for snappier feel
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
      this.filteredTasks = this.allTasks;
    } else {
      const searchLower = term.toLowerCase().trim();
      
      // ✅ Optimized search with early returns
      this.filteredTasks = this.allTasks.filter(task => {
        if (task.title?.toLowerCase().includes(searchLower)) return true;
        if (task.description?.toLowerCase().includes(searchLower)) return true;
        if (task.status?.toLowerCase().includes(searchLower)) return true;
        if (task.project?.title?.toLowerCase().includes(searchLower)) return true;
        if (task.category?.title?.toLowerCase().includes(searchLower)) return true;
        
        if (task.assignee) {
          const fullName = `${task.assignee.firstName} ${task.assignee.lastName}`.toLowerCase();
          if (fullName.includes(searchLower)) return true;
        }
        
        if (task.collaborators?.length) {
          return task.collaborators.some(collab => 
            `${collab.firstName} ${collab.lastName}`.toLowerCase().includes(searchLower)
          );
        }
        
        return false;
      });
    }
    
    // Update displayed tasks and pagination
    this.tasks = this.filteredTasks;
    this.totalItems = this.filteredTasks.length;
    this.updatePagination();
    this.cdr.markForCheck();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.filteredTasks = this.allTasks;
    this.tasks = this.allTasks;
    this.totalItems = this.allTasks.length;
    this.updatePagination();
    this.cdr.markForCheck();
  }

  // ============= DATA LOADING =============

  private loadTasks(): void {
    this.isLoading = true;
    this.cdr.markForCheck();

    const startDateStr = this.startDate ? this.formatPickerDate(this.startDate) : undefined;
    const endDateStr = this.endDate ? this.formatPickerDate(this.endDate) : undefined;

    this.taskService.getAllTasks(this.currentPage, this.pageSize, startDateStr, endDateStr)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: ApiResponse<PageData<TaskData[]>>) => {
          if (response.ok && response.data) {
            this.allTasks = response.data.pageData || [];
            
            // Apply search if active
            if (this.searchTerm) {
              this.performSearch(this.searchTerm);
            } else {
              this.filteredTasks = this.allTasks;
              this.tasks = this.allTasks;
            }
            
            this.totalItems = response.data.totalItems || 0;
            this.updatePagination();
          } else {
            this.resetTaskData();
          }
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: (err: any) => {
          console.error('Failed to load tasks:', err);
          this.resetTaskData();
          this.isLoading = false;
          this.cdr.markForCheck();
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
  }

  private loadGlobalStats(): void {
    this.isLoadingStats = true;
    this.cdr.markForCheck();
    
    this.taskService.getTaskStats()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.ok || res.success) {
            this.globalStats = {
              total: res.data?.total || 0,
              completed: res.data?.completed || 0,
              inProgress: res.data?.inProgress || 0,
              overdue: res.data?.overdue || 0
            };
          }
          this.isLoadingStats = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Failed to load stats:', err);
          this.globalStats = { total: 0, completed: 0, inProgress: 0, overdue: 0 };
          this.isLoadingStats = false;
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

  private subscribeToTaskUpdates(): void {
    this.taskService.tasks$
      .pipe(
        skip(1), // ✅ Skip initial emission to prevent double load
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.loadTasks();
      });

    this.taskService.selectedTask$
      .pipe(takeUntil(this.destroy$))
      .subscribe(task => {
        this.selectedTask = task;
        this.cdr.markForCheck();
      });
  }

  reloadTasks(): void {
    this.loadTasks();
    this.loadGlobalStats();
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
      // Show all pages if total is small
      for (let i = 1; i <= this.totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Smart pagination with ellipsis logic
      const halfVisible = Math.floor(maxVisiblePages / 2);
      let startPage = Math.max(1, this.currentPage - halfVisible);
      let endPage = Math.min(this.totalPages, this.currentPage + halfVisible);
      
      // Adjust if at the beginning
      if (this.currentPage <= halfVisible + 1) {
        endPage = maxVisiblePages;
        startPage = 1;
      }
      
      // Adjust if at the end
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

  goToPage(page: number, event?: Event): void {
    if (event) {
      event.preventDefault();
    }
    
    if (page < 1 || page > this.totalPages || page === this.currentPage) {
      return;
    }
    
    this.currentPage = page;
    this.loadTasks();
    
    // ✅ Scroll to top of table smoothly
    this.scrollToTop();
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
    this.currentPage = 1; // Reset to first page
    this.loadTasks();
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

  // ============= TAB & DRAWER =============

  selectTab(tab: string): void {
    this.selectedTab = tab;
    this.cdr.markForCheck();
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

  onTaskCreated(task: TaskData): void {
    console.log('Task created:', task);
    this.reloadTasks();
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

  // ============= DATE FILTERING =============

  clearDateFilter(): void {
    this.startDate = null;
    this.endDate = null;
    this.dateRangeDisplay = '';
    this.dateRangePreset = '';
    this.currentPage = 1;
    this.loadTasks();
  }

  private formatPickerDate(date: Date): string {
    return date.toISOString().split('T')[0];
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