import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterModule, RouterLinkActive } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil, map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

interface Department {
  id: string;
  name: string;
  description: string;
  employeeCount?: number;
}

interface Employee {
  deactivated: undefined;
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  employeeId: string;
  avatarUrl: string | null;
  position?: string;
  department?: string;
  isActive?: boolean;
}

interface EmployeeRank {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  employeeId: string;
  job: string | null;
  monthlyPoint: number;
  monthlyRank: number;
  dailyPoint: number;
  dailyRank: number;
  dailyAttendancePoint: number;
  monthlyAttendancePoint: number;
}

interface TaskStats {
  total: number;
  stats: {
    status: {
      InProgress: number;
      Blocked: number;
      Completed: number;
      UnderReview: number;
      NotStarted: number;
      Overdue: number;
    };
    priority: {
      Critical: number;
      High: number;
      Low: number;
      Medium: number;
    };
  };
}

interface AttendanceRecord {
  id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  isSeated: boolean;
  currentBreak: any;
  breaks: any[];
  user: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    employeeId: string;
    position?: string;
  };
}

interface PaginatedAttendance {
  page: number;
  count: number;
  totalPages: number;
  totalItems: number;
  pageData: AttendanceRecord[];
}

interface Project {
  id: string;
  title: string;
  status: string;
  archived: boolean;
}

interface PaginatedProjects {
  page: number;
  count: number;
  totalPages: number;
  totalItems: number;
  pageData: Project[];
}

interface ApiResponse<T> {
  ok: boolean;
  data: T;
  error: any;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLink, RouterLinkActive],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss',
})
export class AdminDashboard implements OnInit, OnDestroy {
  private apiUrl = 'https://pixels-office-server.azurewebsites.net/v1';
  private destroy$ = new Subject<void>();

  // Data properties
  departments: Department[] = [];
  employees: Employee[] = [];
  topEmployees: EmployeeRank[] = [];
  employeeRankData: EmployeeRank[] = []; // Store all ranked employees for points lookup
  taskStats: TaskStats = {
    total: 0,
    stats: {
      status: {
        InProgress: 0,
        Blocked: 0,
        Completed: 0,
        UnderReview: 0,
        NotStarted: 0,
        Overdue: 0
      },
      priority: {
        Critical: 0,
        High: 0,
        Low: 0,
        Medium: 0
      }
    }
  };
  attendanceRecords: AttendanceRecord[] = [];
  
  // Computed properties
  totalEmployees = 0;
  activeEmployees = 0;
  totalDepartments = 0;
  bestDepartment = '';
  bestDepartmentPoints = 0;
  activeProjects = 0; // Changed from hardcoded 14 to 0, will be loaded from API
  totalProjects = 0;  // Total projects count

  // Loading states
  loading = true;
  error: string | null = null;

  // Date and time
  currentDay = '';
  currentDate = '';
  currentTime = '';

  // Live update interval for real-time tracking
  private liveUpdateInterval: any = null;

  constructor(private http: HttpClient) {
    console.log('AdminDashboard component initialized');
  }

  ngOnInit(): void {
    console.log('AdminDashboard ngOnInit called');
    this.loadAllDashboardData();
    this.startClock();
    this.startLiveUpdates();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopLiveUpdates();
  }

  // ============================================
  // LIVE TRACKING METHODS
  // ============================================

  /**
   * Start live updates every minute for real-time attendance tracking
   */
  private startLiveUpdates(): void {
    this.stopLiveUpdates();
    
    // Update every minute (60000ms) for employees still clocked in
    this.liveUpdateInterval = setInterval(() => {
      // Trigger change detection by creating new array reference
      this.attendanceRecords = [...this.attendanceRecords];
    }, 60000);
  }

  /**
   * Stop live updates
   */
  private stopLiveUpdates(): void {
    if (this.liveUpdateInterval) {
      clearInterval(this.liveUpdateInterval);
      this.liveUpdateInterval = null;
    }
  }

  /**
   * Load all dashboard data in parallel
   */
  loadAllDashboardData(): void {
    console.log('Loading all dashboard data...');
    this.loading = true;
    this.error = null;

    forkJoin({
      departments: this.loadDepartments(),
      employees: this.loadEmployees(),
      topEmployees: this.loadEmployeeRanks(),
      taskStats: this.loadTaskStats(),
      attendance: this.loadTodayAttendance(),
      allRankedEmployees: this.loadAllRankedEmployees(),
      projects: this.loadProjects() // Added projects API call
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (results) => {
          console.log('All dashboard data loaded:', results);
          
          this.departments = results.departments;
          this.employees = results.employees;
          this.topEmployees = results.topEmployees;
          this.employeeRankData = results.allRankedEmployees; // Store for points lookup
          
          if (results.taskStats) {
            this.taskStats = results.taskStats;
          }
          
          this.attendanceRecords = results.attendance.pageData || [];
          
          // Calculate computed values
          this.totalEmployees = this.employees.length;
          this.activeEmployees = this.employees.filter(e => e.deactivated === false || e.deactivated === undefined).length;
          this.totalDepartments = this.departments.length;
          
          // Set project counts from API response
          this.totalProjects = results.projects.totalItems;
          this.activeProjects = results.projects.activeCount;
          
          // Calculate best department from ranked employees
          this.calculateBestDepartment(results.allRankedEmployees);
          
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading dashboard data:', err);
          this.error = 'Failed to load dashboard data. Please refresh the page.';
          this.loading = false;
        }
      });
  }

  /**
   * Load departments
   */
  loadDepartments() {
    const url = `${this.apiUrl}/department`;
    const token = localStorage.getItem('access_token');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
    
    return this.http.get<ApiResponse<any>>(url, { headers })
      .pipe(
        takeUntil(this.destroy$),
        map((response) => {
          if (response.ok && response.data) {
            if (Array.isArray(response.data)) {
              return response.data;
            } else if (response.data.pageData && Array.isArray(response.data.pageData)) {
              return response.data.pageData;
            }
          }
          return [];
        }),
        catchError((err) => {
          console.error('Error loading departments:', err);
          return of([]);
        })
      );
  }

  /**
   * Load employees
   */
  loadEmployees() {
    const url = `${this.apiUrl}/employee`;
    const token = localStorage.getItem('access_token');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
    
    return this.http.get<ApiResponse<any>>(url, { headers })
      .pipe(
        takeUntil(this.destroy$),
        map((response) => {
          if (response.ok && response.data) {
            if (Array.isArray(response.data)) {
              return response.data;
            } else if (response.data.pageData && Array.isArray(response.data.pageData)) {
              return response.data.pageData;
            }
          }
          return [];
        }),
        catchError((err) => {
          console.error('Error loading employees:', err);
          return of([]);
        })
      );
  }

  /**
   * Load employee rankings - uses /employee/rank endpoint
   */
  loadEmployeeRanks() {
    const url = `${this.apiUrl}/employee/rank`;
    const token = localStorage.getItem('access_token');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
    
    return this.http.get<ApiResponse<any>>(url, { headers })
      .pipe(
        takeUntil(this.destroy$),
        map((response) => {
          if (response.ok && response.data) {
            let employees: any[] = [];
            if (response.data.pageData && Array.isArray(response.data.pageData)) {
              employees = response.data.pageData;
            } else if (Array.isArray(response.data)) {
              employees = response.data;
            }
            
            // Sort by monthlyRank and return top 3
            const sortedEmployees = employees
              .sort((a, b) => a.monthlyRank - b.monthlyRank)
              .slice(0, 3)
              .map(emp => ({
                id: emp.id,
                firstName: emp.firstName,
                lastName: emp.lastName,
                avatarUrl: emp.avatarUrl,
                employeeId: emp.employeeId,
                job: emp.job || 'Employee',
                monthlyPoint: Math.round(emp.monthlyPoint) || 0,
                monthlyRank: emp.monthlyRank || 0,
                dailyPoint: emp.dailyPoint || 0,
                dailyRank: emp.dailyRank || 0,
                dailyAttendancePoint: emp.dailyAttendancePoint || 0,
                monthlyAttendancePoint: emp.monthlyAttendancePoint || 0
              } as EmployeeRank));
            
            return sortedEmployees;
          }
          return [];
        }),
        catchError((err) => {
          console.error('Error loading employee ranks:', err);
          return of([]);
        })
      );
  }

  /**
   * Load ALL ranked employees for points lookup
   */
  loadAllRankedEmployees() {
    const url = `${this.apiUrl}/employee/rank`;
    const token = localStorage.getItem('access_token');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
    
    return this.http.get<ApiResponse<any>>(url, { headers })
      .pipe(
        takeUntil(this.destroy$),
        map((response) => {
          if (response.ok && response.data) {
            if (response.data.pageData && Array.isArray(response.data.pageData)) {
              return response.data.pageData;
            } else if (Array.isArray(response.data)) {
              return response.data;
            }
          }
          return [];
        }),
        catchError((err) => {
          console.error('Error loading all ranked employees:', err);
          return of([]);
        })
      );
  }

  /**
   * Load task statistics
   */
  loadTaskStats() {
    const url = `${this.apiUrl}/task/stats`;
    const token = localStorage.getItem('access_token');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
    
    return this.http.get<ApiResponse<TaskStats>>(url, { headers })
      .pipe(
        takeUntil(this.destroy$),
        map((response) => {
          if (response.ok && response.data) {
            return response.data;
          }
          return {
            total: 0,
            stats: {
              status: { InProgress: 0, Blocked: 0, Completed: 0, UnderReview: 0, NotStarted: 0, Overdue: 0 },
              priority: { Critical: 0, High: 0, Low: 0, Medium: 0 }
            }
          };
        }),
        catchError((err) => {
          console.error('Error loading task stats:', err);
          return of({
            total: 0,
            stats: {
              status: { InProgress: 0, Blocked: 0, Completed: 0, UnderReview: 0, NotStarted: 0, Overdue: 0 },
              priority: { Critical: 0, High: 0, Low: 0, Medium: 0 }
            }
          });
        })
      );
  }

  /**
   * Load today's attendance
   */
  loadTodayAttendance() {
    const url = `${this.apiUrl}/attendance?order=desc&period=Day`;
    const token = localStorage.getItem('access_token');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
    
    return this.http.get<ApiResponse<PaginatedAttendance>>(url, { headers })
      .pipe(
        takeUntil(this.destroy$),
        map((response) => {
          if (response.ok && response.data) {
            return response.data;
          }
          return { page: 1, count: 0, totalPages: 0, totalItems: 0, pageData: [] };
        }),
        catchError((err) => {
          console.error('Error loading attendance:', err);
          return of({ page: 1, count: 0, totalPages: 0, totalItems: 0, pageData: [] });
        })
      );
  }

  /**
   * Load projects from API
   */
  loadProjects() {
    const url = `${this.apiUrl}/project`;
    const token = localStorage.getItem('access_token');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
    
    return this.http.get<ApiResponse<PaginatedProjects>>(url, { headers })
      .pipe(
        takeUntil(this.destroy$),
        map((response) => {
          if (response.ok && response.data) {
            const projects = response.data.pageData || [];
            // Count active projects (status is 'InProgress' and not archived)
            const activeCount = projects.filter(
              (p: Project) => p.status === 'InProgress' && !p.archived
            ).length;
            
            return {
              totalItems: response.data.totalItems || 0,
              activeCount: activeCount
            };
          }
          return { totalItems: 0, activeCount: 0 };
        }),
        catchError((err) => {
          console.error('Error loading projects:', err);
          return of({ totalItems: 0, activeCount: 0 });
        })
      );
  }

  /**
   * Calculate best performing department from ranked employees
   */
  calculateBestDepartment(rankedEmployees: any[]): void {
    if (rankedEmployees.length === 0 || this.departments.length === 0) {
      this.bestDepartment = 'N/A';
      this.bestDepartmentPoints = 0;
      return;
    }
    
    const deptPoints = new Map<string, number>();
    
    this.departments.forEach((dept: any) => {
      deptPoints.set(dept.name, 0);
    });
    
    rankedEmployees.forEach((emp: any) => {
      if (emp.department) {
        const current = deptPoints.get(emp.department) || 0;
        const points = emp.monthlyPoint || 0;
        deptPoints.set(emp.department, current + points);
      }
    });
    
    let maxPoints = 0;
    let bestDept = '';
    deptPoints.forEach((points, dept) => {
      if (points > maxPoints) {
        maxPoints = points;
        bestDept = dept;
      }
    });
    
    if (maxPoints === 0 && this.departments.length > 0) {
      const deptEmployeeCounts = new Map<string, number>();
      rankedEmployees.forEach((emp: any) => {
        if (emp.department) {
          deptEmployeeCounts.set(emp.department, (deptEmployeeCounts.get(emp.department) || 0) + 1);
        }
      });
      
      let maxCount = 0;
      deptEmployeeCounts.forEach((count, dept) => {
        if (count > maxCount) {
          maxCount = count;
          bestDept = dept;
        }
      });
    }
    
    this.bestDepartment = bestDept || 'N/A';
    this.bestDepartmentPoints = Math.round(maxPoints);
  }

  /**
   * Start the clock for date/time display
   */
  startClock(): void {
    this.updateDateTime();
    setInterval(() => this.updateDateTime(), 1000);
  }

  /**
   * Update date and time display
   */
  updateDateTime(): void {
    const now = new Date();
    
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    this.currentDay = days[now.getDay()];
    
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                    'July', 'August', 'September', 'October', 'November', 'December'];
    this.currentDate = `${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
    
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    this.currentTime = `${hours}:${minutes}:${seconds} ${ampm}`;
  }

  /**
   * Format time to 12-hour format
   */
  formatTime(dateString: string | null): string {
    if (!dateString) return '-';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '-';
      
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
    } catch (error) {
      return '-';
    }
  }

  /**
   * Format date to readable format
   */
  formatDate(dateString: string): string {
    if (!dateString) return '-';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '-';
      
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (error) {
      return '-';
    }
  }

  /**
   * Truncate text to specified length with ellipsis
   */
  truncateText(text: string | null, maxLength: number): string {
    if (!text) return 'Employee';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '…';
  }

  // ============================================
  // ATTENDANCE POINTS CALCULATION (1 hour = 1 point)
  // ============================================

  /**
   * Calculate working hours between check-in and check-out
   * If no check-out, uses current time (live tracking)
   */
  calculateWorkingHours(checkIn: string | null, checkOut: string | null): string {
    if (!checkIn) return '0H 0M';

    const start = new Date(checkIn);
    let end: Date;

    if (checkOut) {
      end = new Date(checkOut);
    } else {
      // Still clocked in - use current time for live tracking
      end = new Date();
    }

    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return '0H 0M';
    }

    const diffMs = end.getTime() - start.getTime();
    if (diffMs < 0) return '0H 0M';

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    return `${diffHours}H ${diffMinutes}M`;
  }

  /**
   * Calculate today's attendance points based on hours worked
   * 1 hour = 1 point (calculated from check-in/check-out)
   */
  getTodayAttendancePoints(checkIn: string | null, checkOut: string | null): number {
    if (!checkIn) return 0;

    const start = new Date(checkIn);
    let end: Date;

    if (checkOut) {
      end = new Date(checkOut);
    } else {
      // Still clocked in - use current time for live tracking
      end = new Date();
    }

    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return 0;
    }

    const diffMs = end.getTime() - start.getTime();
    if (diffMs < 0) return 0;

    // 1 hour = 1 point
    const hours = diffMs / (1000 * 60 * 60);
    return parseFloat(hours.toFixed(2));
  }

  /**
   * Calculate attendance percentage based on 8-hour target
   * Can exceed 100% if worked more than 8 hours
   */
  calculateAttendancePercentage(checkIn: string | null, checkOut: string | null): number {
    if (!checkIn) return 0;

    const start = new Date(checkIn);
    let end: Date;

    if (checkOut) {
      end = new Date(checkOut);
    } else {
      // Still clocked in - use current time for live tracking
      end = new Date();
    }

    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return 0;
    }

    const diffMs = end.getTime() - start.getTime();
    if (diffMs < 0) return 0;

    const diffHours = diffMs / (1000 * 60 * 60);

    // 8 hours = 100% (can exceed 100%)
    return parseFloat(((diffHours / 8) * 100).toFixed(1));
  }

  /**
   * Get progress bar color class based on percentage
   */
  getProgressBarClass(percentage: number): string {
    if (percentage >= 100) return 'bg-success';
    if (percentage >= 75) return 'bg-info';
    if (percentage >= 50) return 'bg-warning';
    return 'bg-danger';
  }

  /**
   * Get status badge class
   */
  getStatusBadgeClass(status: string): string {
    if (!status) return 'badge-secondary';
    
    switch (status.toLowerCase()) {
      case 'present':
      case 'ontime':
        return 'badge-success';
      case 'absent':
        return 'badge-danger';
      case 'late':
        return 'badge-warning';
      case 'leave':
        return 'badge-info';
      default:
        return 'badge-secondary';
    }
  }

  /**
   * Get break status
   */
  getBreakStatus(record: AttendanceRecord): string {
    if (record.currentBreak) {
      const breakType = record.currentBreak.type || 'break';
      return breakType.toLowerCase() === 'tea' ? 'Tea Break' : 'On Break';
    }
    return record.isSeated ? 'On Seat' : '';
  }

  /**
   * Get break icon
   */
  getBreakIcon(record: AttendanceRecord): string {
    if (!record.currentBreak) return 'bi-laptop';
    const breakType = record.currentBreak.type || 'break';
    return breakType.toLowerCase() === 'tea' ? 'bi-cup-hot-fill' : 'bi-pause-circle';
  }

  /**
   * Get rank badge class
   */
  getRankBadgeClass(rank: number): string {
    switch (rank) {
      case 1: return 'badge-success';
      case 2: return 'badge-primary';
      case 3: return 'badge-warning';
      default: return 'badge-secondary';
    }
  }

  /**
   * Get active employees for display (first 6)
   */
  getActiveEmployeesForDisplay(): Employee[] {
    return this.employees
      .filter(e => e.deactivated === false || e.deactivated === undefined)
      .slice(0, 6);
  }

  /**
   * Refresh dashboard data
   */
  refreshData(): void {
    console.log('Refreshing dashboard data...');
    this.loadAllDashboardData();
  }
}