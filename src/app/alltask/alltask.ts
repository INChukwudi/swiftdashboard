// src/app/alltask/alltask.ts
import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { NewTaskComponent } from '../new-task/new-task';
import { TaskDrawer } from '../task-drawer/task-drawer';
import { TaskService, TaskData, Project, ApiResponse, PageData } from '../services/task.service';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import flatpickr from 'flatpickr';

@Component({
  selector: 'app-alltask',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TaskDrawer,
    NewTaskComponent,
    MatPaginator
  ],
  templateUrl: './alltask.html',
  styleUrl: './alltask.scss',
})
export class Alltask implements OnInit, OnDestroy, AfterViewInit {

  @ViewChild('flatpickrInput') flatpickrInput!: ElementRef<HTMLInputElement>;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  private fpInstance: any;
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
  allTasks: TaskData[] = []; // Keep original data for client-side filtering
  totalItems: number = 0;
  pageSize: number = 100;
  currentPage: number = 1;
  projects: Project[] = [];

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

  constructor(private taskService: TaskService) {}

  ngOnInit(): void {
    this.setupSearch();
    this.loadTasks();
    this.loadGlobalStats();
    this.loadProjects();
    this.subscribeToTaskUpdates();
  }

  ngAfterViewInit(): void {
    this.initFlatpickr();
  }

  ngOnDestroy(): void {
    if (this.fpInstance) {
      this.fpInstance.destroy();
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============= SEARCH SETUP =============
  
  private setupSearch(): void {
    this.searchSubject.pipe(
      debounceTime(300),
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
        if (task.collaborators && task.collaborators.length > 0) {
          const hasMatch = task.collaborators.some(collab => {
            const collabName = `${collab.firstName} ${collab.lastName}`.toLowerCase();
            return collabName.includes(searchLower);
          });
          if (hasMatch) return true;
        }
        
        return false;
      });
    }
    
    // ✅ SORT FILTERED RESULTS by creation date (most recent first)
    this.sortTasksByCreatedDate(this.filteredTasks);
    
    // Update displayed tasks
    this.tasks = [...this.filteredTasks];
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.searchSubject.next('');
  }

  // ============= DATA LOADING =============

  private loadTasks(): void {
    this.isLoading = true;

    const startDateStr = this.startDate ? this.formatPickerDate(this.startDate) : undefined;
    const endDateStr = this.endDate ? this.formatPickerDate(this.endDate) : undefined;

    this.taskService.getAllTasks(this.currentPage, this.pageSize, startDateStr, endDateStr)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: ApiResponse<PageData<TaskData[]>>) => {
          if (response.ok && response.data) {
            // Store all tasks (already sorted by API in desc order by createdAt)
            this.allTasks = response.data.pageData || [];
            
            // ✅ ADDITIONAL CLIENT-SIDE SORT (Safety layer)
            // Ensures tasks are always sorted by most recent, even if API fails to sort
            this.sortTasksByCreatedDate(this.allTasks);
            
            // Apply search if active
            if (this.searchTerm) {
              this.performSearch(this.searchTerm);
            } else {
              this.filteredTasks = [...this.allTasks];
              this.tasks = [...this.allTasks];
            }
            
            this.totalItems = response.data.totalItems || 0;

            // Reset paginator
            if (this.paginator && this.paginator.pageIndex !== this.currentPage - 1) {
              this.paginator.pageIndex = this.currentPage - 1;
            }
          } else {
            this.tasks = [];
            this.allTasks = [];
            this.filteredTasks = [];
            this.totalItems = 0;
          }
          this.isLoading = false;
        },
        error: (err: any) => {
          console.error('Failed to load tasks:', err);
          this.tasks = [];
          this.allTasks = [];
          this.filteredTasks = [];
          this.totalItems = 0;
          this.isLoading = false;
        }
      });
  }

  /**
   * Sort tasks by creation date (most recent first)
   * This is a safety layer in addition to API sorting
   */
  private sortTasksByCreatedDate(tasks: TaskData[]): void {
    tasks.sort((a, b) => {
      const dateA = new Date(a.createdAt);
      const dateB = new Date(b.createdAt);
      
      // Most recent first (descending order)
      return dateB.getTime() - dateA.getTime();
    });
  }

  private loadGlobalStats(): void {
    this.isLoadingStats = true;
    
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
        },
        error: (err) => {
          console.error('Failed to load stats:', err);
          // Keep default values (all zeros)
          this.globalStats = {
            total: 0,
            completed: 0,
            inProgress: 0,
            overdue: 0
          };
          this.isLoadingStats = false;
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
      .pipe(takeUntil(this.destroy$))
      .subscribe(tasks => {
        // Reload when tasks are updated
        this.loadTasks();
      });

    this.taskService.selectedTask$
      .pipe(takeUntil(this.destroy$))
      .subscribe(task => {
        this.selectedTask = task;
      });
  }

  reloadTasks(): void {
    this.loadTasks();
  }

  // ============= PAGINATION =============

  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.loadTasks();
  }

  // ============= TAB & DRAWER =============

  selectTab(tab: string): void {
    this.selectedTab = tab;
  }

  openTaskDrawer(task: TaskData): void {
    this.taskService.setSelectedTask(task);
    this.isDrawerOpen = true;
  }

  closeTaskDrawer(): void {
    this.isDrawerOpen = false;
    this.taskService.setSelectedTask(null);
  }

  openTaskModal(): void {
    // Implement modal opening logic
    console.log('Open task modal');
  }

  onTaskCreated(task: TaskData): void {
    console.log('Task created:', task);
    this.reloadTasks();
  }

  onTaskUpdated(updatedTask: TaskData): void {
    console.log('Task updated:', updatedTask);
    // Reload tasks to get fresh data with correct sort order from API
    this.reloadTasks();
  }

  onTaskDeleted(taskId: string): void {
    console.log('Task deleted:', taskId);
    this.closeTaskDrawer();
    this.reloadTasks();
  }

  // ============= DATE FILTERING =============

  private initFlatpickr(): void {
    this.fpInstance = flatpickr(this.flatpickrInput.nativeElement, {
      mode: 'range',
      dateFormat: 'M d, Y',        // Show full date with year (e.g., Jan 15, 2025)
      altInput: true,               // Use alternative input for better display
      altFormat: 'M d, Y',          // Format for the display
      conjunction: ' to ',          // Separator between dates
      showMonths: 2,                // Show 2 months side by side for better range selection
      enableTime: false,            // Don't show time picker
      allowInput: true,             // Allow manual input
      clickOpens: true,             // Open on click
      
      // Date limits (optional - adjust as needed)
      minDate: '2020-01-01',        // Can select from 2020
      maxDate: new Date(new Date().setFullYear(new Date().getFullYear() + 2)), // Up to 2 years in future
      
      // Localization
      locale: {
        firstDayOfWeek: 1,          // Start week on Monday (0 = Sunday, 1 = Monday)
        rangeSeparator: ' to '
      },
      
      onClose: (selectedDates: Date[]) => {
        if (selectedDates.length === 2) {
          this.startDate = selectedDates[0];
          this.endDate = selectedDates[1];
          
          // Format for display
          this.dateRangeDisplay = this.formatDisplayDate(selectedDates[0]) + ' to ' + this.formatDisplayDate(selectedDates[1]);
          
          this.dateRangePreset = 'custom';
          this.currentPage = 1;
          this.loadTasks();
        } else if (selectedDates.length === 0) {
          this.clearDateFilter();
        } else if (selectedDates.length === 1) {
          // Single date selected - wait for second date
          this.dateRangeDisplay = this.formatDisplayDate(selectedDates[0]) + ' to ...';
        }
      },
      
      onChange: (selectedDates: Date[]) => {
        // Update display as user selects dates
        if (selectedDates.length === 1) {
          this.dateRangeDisplay = this.formatDisplayDate(selectedDates[0]) + ' to ...';
        }
      }
    });
  }

  /**
   * Format date for display (e.g., "Jan 15, 2025")
   */
  private formatDisplayDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  clearDateFilter(): void {
    this.startDate = null;
    this.endDate = null;
    this.dateRangeDisplay = '';
    this.dateRangePreset = '';
    this.currentPage = 1;
    if (this.fpInstance) {
      this.fpInstance.clear();
      this.fpInstance.close();
    }
    this.loadTasks();
  }

  private formatPickerDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  // ============= UTILITY METHODS =============

  getInitials(firstName: string, lastName?: string): string {
    if (!firstName) return '?';
    const lastInitial = lastName ? lastName.charAt(0).toUpperCase() : '';
    return (firstName.charAt(0).toUpperCase() + lastInitial);
  }

  getStatusBadgeClass(status: string): string {
    const map: { [key: string]: string } = {
      'Completed': 'badge-light-success',
      'Complete': 'badge-light-success',
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