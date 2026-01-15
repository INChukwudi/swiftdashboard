// src/app/staffprofile/staffprofile.component.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { catchError, forkJoin, of, map, Subject, takeUntil } from 'rxjs';
import { Task } from '../task/task';
import { TaskDrawer } from '../task-drawer/task-drawer'; 
import { TaskService, Project, ApiResponse, PageData, TaskData } from '../services/task.service';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  employeeId: string;
  avatarUrl: string | null;
  job: string;
  department: string;
  deactivated: boolean;
  monthlyRank: number;
  monthlyPoint: number;
  dailyRank: number;
  dailyPoint: number;
  joinedAt: string;
  birthday: string | null;
  location: string;
  skills: string[];
}

interface DisplayAttendance {
  day: string;
  short: string;
  clockIn: string;
  clockOut: string;
  hours: string;
  percentage: number;
  status: 'success' | 'warning' | 'danger';
}

interface ActivityItem {
  id: string;
  type: string;
  action: string;
  description: string;
  timestamp: string;
  badge: string;
  icon: string;
  color: string;
}

@Component({
  selector: 'app-staffprofile',
  standalone: true,
  imports: [CommonModule, Task, TaskDrawer],
  templateUrl: './staffprofile.html',
  styleUrl: './staffprofile.scss',
})
export class Staffprofile implements OnInit, OnDestroy {
  private apiUrl = 'https://pixels-office-server.azurewebsites.net/v1';
  private destroy$ = new Subject<void>();
  
  // Employee Data
  employee: Employee | null = null;
  employeeId: string = '';
  dailyProgress: any = null;  // ← NEW: For daily progress data
  
  // View Toggle
  selectedView: string = 'table';  // 'table' or 'card'
  
  // Tasks
  tasks: TaskData[] = [];
  isLoadingTasks = false;
  currentPage = 1;
  pageSize = 20;
  totalTasks = 0;
  
  // Attendance
  attendance: DisplayAttendance[] = [];
  totalWeeklyHours = '0h 00m';
  totalTarget = '40h';
  weeklyPercentage = 0;
  
  // Activity Log
  activities: ActivityItem[] = [];
  isLoadingActivities = false;
  
  // Stats
  stats = {
    totalTasks: 0,
    tasksCompleted: 0,
    overdueTasks: 0,
    inProgress: 0,
    absentDays: 0,
    performance: 0,
  };
  
  // Loading States
  isLoadingEmployee = true;
  isLoadingAttendance = false;
  errorMessage = '';
  
  // Task Drawer
  selectedTask: TaskData | null = null;
  isDrawerOpen = false;
  
  // Math reference for template
  Math = Math;

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router,
    private taskService: TaskService
  ) {}

  ngOnInit(): void {
    // Get employee ID from route params or query params
    this.route.paramMap.subscribe(params => {
      this.employeeId = params.get('id') || '';
      if (!this.employeeId) {
        this.route.queryParamMap.subscribe(queryParams => {
          this.employeeId = queryParams.get('id') || '';
        });
      }
      
      if (this.employeeId) {
        this.loadEmployeeData();
      } else {
        this.errorMessage = 'No employee ID provided';
        this.isLoadingEmployee = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'accept': 'application/json'
    });
  }

  private handleError(err: any, context: string) {
    console.error(`API Error [${context}]:`, err);
    if (err.status === 401) {
      this.logout();
    }
  }

  // ============= VIEW TOGGLE =============
  
  selectView(view: string): void {
    this.selectedView = view;
  }

  // ============= LOAD ALL DATA =============
  
  loadEmployeeData(): void {
    this.isLoadingEmployee = true;
    this.isLoadingTasks = true;
    this.isLoadingAttendance = true;
    this.isLoadingActivities = true;
    
    forkJoin({
      employee: this.fetchEmployee(),
      dailyProgress: this.fetchEmployeeDailyProgress(),  // ← NEW
      tasks: this.fetchEmployeeTasks(),
      taskStats: this.fetchEmployeeTaskStats(),
      attendance: this.fetchEmployeeAttendance(),
      activities: this.fetchEmployeeActivities()
    }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (results) => {
        // Process employee data
        if (results.employee.ok && results.employee.data) {
          this.employee = results.employee.data;
          console.log('Employee Data:', this.employee);
        }
        
        // Process daily progress (NEW)
        if (results.dailyProgress.ok && results.dailyProgress.data) {
          this.dailyProgress = results.dailyProgress.data;
          console.log('Daily Progress:', this.dailyProgress);
        }
        
        // Process tasks
        if (results.tasks.ok && results.tasks.data?.pageData) {
          this.tasks = results.tasks.data.pageData.map((task: any) => this.mapTaskData(task));
        }
        this.isLoadingTasks = false;
        
        // Process task stats
        if (results.taskStats.ok && results.taskStats.data) {
          this.processTaskStats(results.taskStats.data);
        }
        
        // Process activities
        if (results.activities.ok && results.activities.data?.pageData) {
          this.activities = this.processActivities(results.activities.data.pageData);
        }
        this.isLoadingActivities = false;
        
        this.isLoadingEmployee = false;
        this.calculateStats();
      },
      error: (err) => {
        this.handleError(err, 'loadEmployeeData');
        this.isLoadingEmployee = false;
        this.isLoadingTasks = false;
        this.isLoadingAttendance = false;
        this.isLoadingActivities = false;
        this.errorMessage = 'Failed to load employee data';
      }
    });
  }

  // ============= TASK DATA MAPPING =============
  
  private mapTaskData(task: any): TaskData {
    // Calculate progress
    let progress = 0;
    if (task.subtasks && Array.isArray(task.subtasks) && task.subtasks.length > 0) {
      const completedSubtasks = task.subtasks.filter((st: any) => 
        st.status === 'Completed' || st.completed === true
      ).length;
      progress = Math.round((completedSubtasks / task.subtasks.length) * 100);
    }

    if (task.status === 'Completed' || task.status === 'Complete') {
      progress = 100;
    }

    return {
      id: task.id,
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority || 'Medium',
      due_date: task.due_date || task.dueDate || '',
      start_date: task.start_date || task.startDate || '',
      dueDate: task.due_date || task.dueDate || '',
      startDate: task.start_date || task.startDate || '',
      createdAt: task.createdAt || task.created_at || '',
      updatedAt: task.updatedAt || task.updated_at || '',
      assignee: task.assignee || null,
      owner: task.owner,
      collaborators: Array.isArray(task.collaborators) ? task.collaborators : [],
      subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
      project: task.project,
      category: task.category,
      totalComment: task.totalComment || 0,
      totalAttachment: task.totalAttachment || 0,
      commentCount: task.totalComment || 0,
      attachmentCount: task.totalAttachment || 0,
      progress: progress,
      isMine: task.isMine || false,
      isAssigned: task.isAssigned || false
    };
  }

  // ============= FETCH EMPLOYEE INFO =============
  
  fetchEmployee() {
    return this.http.get<any>(`${this.apiUrl}/employee/${this.employeeId}`, { 
      headers: this.getHeaders() 
    }).pipe(
      catchError(err => {
        this.handleError(err, 'fetchEmployee');
        return of({ ok: false });
      })
    );
  }

  // ============= FETCH EMPLOYEE DAILY PROGRESS =============
  
  fetchEmployeeDailyProgress() {
    return this.http.get<any>(`${this.apiUrl}/employee/${this.employeeId}/daily-progress`, {
      headers: this.getHeaders()
    }).pipe(
      catchError(err => {
        this.handleError(err, 'fetchEmployeeDailyProgress');
        return of({ ok: false, data: null });
      })
    );
  }

  // ============= FETCH TASKS =============
  
  fetchEmployeeTasks() {
    // Sort by createdAt descending (most recent first)
    const params = `by=createdAt&order=desc&page=${this.currentPage}&count=${this.pageSize}`;
    return this.http.get<any>(`${this.apiUrl}/employee/${this.employeeId}/task?${params}`, {
      headers: this.getHeaders()
    }).pipe(
      map(response => {
        if (response.ok && response.data) {
          // Handle both response formats
          const pageData = response.data.pageData || response.data;
          this.totalTasks = response.data.totalItems || response.data.total || 0;
          
          return {
            ok: true,
            data: {
              pageData: Array.isArray(pageData) ? pageData : [],
              totalItems: this.totalTasks
            }
          };
        }
        return response;
      }),
      catchError(err => {
        this.handleError(err, 'fetchEmployeeTasks');
        return of({ ok: false, data: { pageData: [] } });
      })
    );
  }

  // ============= FETCH EMPLOYEE TASK STATS =============
  
  fetchEmployeeTaskStats() {
    return this.http.get<any>(`${this.apiUrl}/employee/${this.employeeId}/task/stats`, {
      headers: this.getHeaders()
    }).pipe(
      catchError(err => {
        this.handleError(err, 'fetchEmployeeTaskStats');
        return of({ ok: false, data: null });
      })
    );
  }

  private processTaskStats(statsData: any): void {
    console.log('Task Stats Response:', statsData);
    
    if (statsData && statsData.stats) {
      const status = statsData.stats.status || {};
      
      this.stats.totalTasks = statsData.total || 0;
      this.stats.tasksCompleted = status.Completed || status.completed || 0;
      this.stats.inProgress = status.InProgress || status.inProgress || status['In Progress'] || 0;
      this.stats.overdueTasks = status.Overdue || status.overdue || 0;
    }
  }
  
  loadTasksPage(page: number): void {
    this.currentPage = page;
    this.isLoadingTasks = true;
    
    this.fetchEmployeeTasks().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (result) => {
        if (result.ok && result.data?.pageData) {
          this.tasks = result.data.pageData.map((task: any) => this.mapTaskData(task));
        }
        this.isLoadingTasks = false;
      },
      error: (err) => {
        this.handleError(err, 'loadTasksPage');
        this.isLoadingTasks = false;
      }
    });
  }
  
  get totalPages(): number {
    return Math.ceil(this.totalTasks / this.pageSize);
  }
  
  get paginationPages(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    const halfVisible = Math.floor(maxVisible / 2);
    
    let startPage = Math.max(1, this.currentPage - halfVisible);
    let endPage = Math.min(this.totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  }
  
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.loadTasksPage(page);
    }
  }
  
  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.goToPage(this.currentPage + 1);
    }
  }
  
  previousPage(): void {
    if (this.currentPage > 1) {
      this.goToPage(this.currentPage - 1);
    }
  }

  // ============= FETCH ATTENDANCE =============
  
  fetchEmployeeAttendance() {
    return this.http.get<any>(
      `${this.apiUrl}/employee/${this.employeeId}/attendance?period=Week`,
      { headers: this.getHeaders() }
    ).pipe(
      map((response) => {
        console.log('Attendance API Response:', response);
        
        if (response.ok && response.data && response.data.pageData) {
          this.processAttendanceData(response.data.pageData);
        }
        this.isLoadingAttendance = false;
        return { ok: true };
      }),
      catchError(err => {
        this.handleError(err, 'fetchAttendance');
        this.isLoadingAttendance = false;
        return of({ ok: false });
      })
    );
  }

  private processAttendanceData(attendanceRecords: any[]) {
    console.log('Processing Attendance Records:', attendanceRecords);
    
    // Map to day names
    const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const dayShortNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    
    let totalHoursNum = 0;
    
    this.attendance = attendanceRecords
      .filter(record => {
        // Only show weekdays (Monday-Friday)
        const date = new Date(record.date);
        const dayOfWeek = date.getDay();
        return dayOfWeek >= 1 && dayOfWeek <= 5; // 1=Monday, 5=Friday
      })
      .map(record => {
        const date = new Date(record.date);
        const dayOfWeek = date.getDay();
        
        // Calculate hours worked
        let hoursNum = 0;
        if (record.checkIn && record.checkOut) {
          const checkInTime = new Date(record.checkIn);
          const checkOutTime = new Date(record.checkOut);
          const diffMs = checkOutTime.getTime() - checkInTime.getTime();
          hoursNum = diffMs / (1000 * 60 * 60); // Convert to hours
          
          // Subtract break time if available
          if (record.breaks && Array.isArray(record.breaks)) {
            record.breaks.forEach((breakItem: any) => {
              if (breakItem.start && breakItem.end) {
                const breakStart = new Date(breakItem.start);
                const breakEnd = new Date(breakItem.end);
                const breakDiffMs = breakEnd.getTime() - breakStart.getTime();
                hoursNum -= breakDiffMs / (1000 * 60 * 60);
              }
            });
          }
        }
        
        totalHoursNum += hoursNum;
        
        const hoursFormatted = this.formatHours(hoursNum);
        
        // Determine status based on hours
        let status: 'success' | 'warning' | 'danger' = 'danger';
        let percentage = 0;
        
        if (hoursNum >= 8) {
          status = 'success';
          percentage = 100;
        } else if (hoursNum >= 6) {
          status = 'warning';
          percentage = (hoursNum / 8) * 100;
        } else {
          percentage = (hoursNum / 8) * 100;
        }
        
        return {
          day: dayNames[dayOfWeek],
          short: dayShortNames[dayOfWeek],
          clockIn: record.checkIn 
            ? new Date(record.checkIn).toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit' 
              }) 
            : '--:--',
          clockOut: record.checkOut 
            ? new Date(record.checkOut).toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit' 
              }) 
            : '--:--',
          hours: hoursFormatted,
          percentage: Math.min(100, Math.round(percentage)),
          status,
        };
      });
    
    // Set weekly totals
    this.totalWeeklyHours = this.formatHours(totalHoursNum);
    this.weeklyPercentage = Math.min(100, Math.round((totalHoursNum / 40) * 100));
    
    console.log('Processed Attendance:', this.attendance);
    console.log('Total Weekly Hours:', this.totalWeeklyHours);
    console.log('Weekly Percentage:', this.weeklyPercentage);
  }

  // ============= FETCH ACTIVITY LOG =============
  
  fetchEmployeeActivities() {
    return this.http.get<any>(
      `${this.apiUrl}/employee/${this.employeeId}/log?order=desc`,
      { headers: this.getHeaders() }
    ).pipe(
      catchError(err => {
        this.handleError(err, 'fetchEmployeeActivities');
        return of({ ok: false, data: { pageData: [] } });
      })
    );
  }

  private processActivities(activityData: any[]): ActivityItem[] {
    return activityData.map(activity => {
      let badge = 'secondary';
      let icon = 'bi-bell';
      let color = 'info';
      
      switch (activity.type) {
        case 'Login':
          badge = 'info';
          icon = 'bi-box-arrow-in-right';
          color = 'info';
          break;
        case 'TaskCompleted':
          badge = 'success';
          icon = 'bi-check-circle';
          color = 'success';
          break;
        case 'Break':
          badge = 'warning';
          icon = 'bi-cup-hot';
          color = 'warning';
          break;
        case 'Meeting':
          badge = 'dark';
          icon = 'bi-people';
          color = 'dark';
          break;
        case 'Absent':
          badge = 'danger';
          icon = 'bi-x-circle';
          color = 'danger';
          break;
        case 'TaskAssigned':
          badge = 'primary';
          icon = 'bi-clipboard-check';
          color = 'primary';
          break;
      }
      
      return {
        id: activity.id,
        type: activity.type,
        action: activity.action || activity.type,
        description: activity.description || activity.body || '',
        timestamp: activity.timestamp || activity.createdAt,
        badge,
        icon,
        color
      };
    });
  }

  // ============= CALCULATE STATS =============
  
  calculateStats(): void {
    // Stats from API are already set in processTaskStats()
    // We just need to calculate performance and absent days here
    
    // Absent Days (count from attendance)
    this.stats.absentDays = this.attendance.filter(a => 
      a.hours === '0h 00m' || a.clockIn === '--:--'
    ).length;
    
    // Performance (average of completion rate and attendance percentage)
    let completionRate = 0;
    if (this.stats.totalTasks > 0) {
      completionRate = (this.stats.tasksCompleted / this.stats.totalTasks) * 100;
    }
    this.stats.performance = Math.round((completionRate + this.weeklyPercentage) / 2);
    
    // Debug logging
    console.log('=== STATS CALCULATED ===');
    console.log('Total Tasks:', this.stats.totalTasks);
    console.log('Completed Tasks:', this.stats.tasksCompleted);
    console.log('In Progress Tasks:', this.stats.inProgress);
    console.log('Overdue Tasks:', this.stats.overdueTasks);
    console.log('Absent Days:', this.stats.absentDays);
    console.log('Weekly Hours:', this.totalWeeklyHours);
    console.log('Weekly %:', this.weeklyPercentage);
    console.log('Completion Rate:', completionRate.toFixed(2) + '%');
    console.log('Performance:', this.stats.performance + '%');
    console.log('=======================');
  }

  // ============= UTILITY METHODS =============
  
  private formatHours(decimalHours: number): string {
    const hours = Math.floor(decimalHours);
    const minutes = Math.floor((decimalHours - hours) * 60);
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
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

  formatTime(dateString: string): string {
    if (!dateString) return '--:--';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getFullName(): string {
    if (!this.employee) return 'Employee';
    return `${this.employee.firstName} ${this.employee.lastName}`;
  }

  getAvatarUrl(): string {
    if (this.employee?.avatarUrl) {
      return this.employee.avatarUrl;
    }
    if (this.employee) {
      return `https://ui-avatars.com/api/?name=${this.employee.firstName}+${this.employee.lastName}&background=random`;
    }
    return 'assets/media/avatars/blank.png';
  }

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
      'InProgress': 'badge-light-warning',
      'Under Review': 'badge-light-primary',
      'UnderReview': 'badge-light-primary',
      'Not Started': 'badge-secondary',
      'NotStarted': 'badge-secondary',
      'Overdue': 'badge-light-danger',
      'Blocked': 'badge-light-dark'
    };
    return map[status] || 'badge-light-secondary';
  }

  getProjectName(task: TaskData): string {
    return task.project?.title || 'No Project';
  }

  getDayRankSuffix(rank: number | undefined | null): string {
    if (!rank || rank === 0) return '';
    
    const lastDigit = rank % 10;
    const lastTwoDigits = rank % 100;
    
    // Handle special cases for 11, 12, 13
    if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
      return 'th';
    }
    
    // Handle other cases
    switch (lastDigit) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  }

  // ============= NAVIGATION =============
  
  openTaskDrawer(task: TaskData): void {
    this.selectedTask = task;
    this.taskService.setSelectedTask(task);
    this.isDrawerOpen = true;
  }

  closeTaskDrawer(): void {
    this.isDrawerOpen = false;
    this.taskService.setSelectedTask(null);
  }

  onTaskUpdated(updatedTask: TaskData): void {
    console.log('Task updated:', updatedTask);
    this.loadTasksPage(this.currentPage);
  }

  onTaskDeleted(taskId: string): void {
    console.log('Task deleted:', taskId);
    this.closeTaskDrawer();
    this.loadTasksPage(this.currentPage);
  }

  downloadLog(): void {
    console.log('Download log for employee:', this.employeeId);
    // Implement download logic
  }

  createNewTask(): void {
    console.log('Create new task for employee:', this.employeeId);
    // Open task creation modal
  }

  logout(): void {
    localStorage.clear();
    sessionStorage.clear();
    this.router.navigate(['/signin']);
  }

  // ============= TRACK BY FUNCTIONS =============
  
  trackByTaskId(index: number, task: TaskData): string {
    return task.id;
  }

  trackByActivityId(index: number, activity: ActivityItem): string {
    return activity.id;
  }

  trackByDay(index: number, att: DisplayAttendance): string {
    return att.day;
  }
}