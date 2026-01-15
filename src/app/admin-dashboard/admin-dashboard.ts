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
  bestDepartment = '';  // Empty until calculated
  bestDepartmentPoints = 0;
  activeProjects = 14; // This would come from a projects API if available

  // Loading states
  loading = true;
  error: string | null = null;

  // Date and time
  currentDay = '';
  currentDate = '';
  currentTime = '';

  constructor(private http: HttpClient) {
    console.log('AdminDashboard component initialized');
  }

  ngOnInit(): void {
    console.log('AdminDashboard ngOnInit called');
    this.loadAllDashboardData();
    this.startClock();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
      attendance: this.loadTodayAttendance()
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (results) => {
          console.log('All dashboard data loaded:', results);
          console.log('=== TOP EMPLOYEES DEBUG ===');
          console.log('results.topEmployees:', results.topEmployees);
          console.log('topEmployees length:', results.topEmployees?.length);
          
          this.departments = results.departments;
          this.employees = results.employees;
          this.topEmployees = results.topEmployees;
          
          console.log('this.topEmployees after assignment:', this.topEmployees);
          console.log('this.topEmployees.length:', this.topEmployees.length);
          
          // Safely assign taskStats
          if (results.taskStats) {
            this.taskStats = results.taskStats;
          }
          
          this.attendanceRecords = results.attendance.pageData || [];
          
          // Calculate computed values
          this.totalEmployees = this.employees.length;
          this.activeEmployees = this.employees.filter(e => e.deactivated === false || e.deactivated === undefined).length;
          this.totalDepartments = this.departments.length;
          
          // IMPORTANT: We need to load ALL ranked employees for department calculation
          // Load the full ranked employee list (not just top 3)
          this.loadAllRankedEmployees().subscribe(rankedEmployees => {
            this.calculateBestDepartment(rankedEmployees);
          });
          
          console.log('=== FINAL STATE BEFORE RENDER ===');
          console.log('loading:', this.loading);
          console.log('topEmployees:', this.topEmployees);
          console.log('topEmployees.length:', this.topEmployees.length);
          console.log('employees:', this.employees);
          console.log('totalEmployees:', this.totalEmployees);
          
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
    console.log('Loading departments from:', url);
    
    const token = localStorage.getItem('access_token');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
    
    return this.http.get<ApiResponse<any>>(url, { headers })
      .pipe(
        takeUntil(this.destroy$),
        map((response) => {
          console.log('Departments response:', response);
          if (response.ok && response.data) {
            // Handle both array response and paginated response
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
    console.log('Loading employees from:', url);
    
    const token = localStorage.getItem('access_token');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
    
    return this.http.get<ApiResponse<any>>(url, { headers })
      .pipe(
        takeUntil(this.destroy$),
        map((response) => {
          console.log('Employees response:', response);
          if (response.ok && response.data) {
            // Handle both array response and paginated response
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
   * Load employee rankings - uses /employee/rank endpoint (same as Ranking page)
   */
  loadEmployeeRanks() {
    const url = `${this.apiUrl}/employee/rank`;
    console.log('Loading employee ranks from:', url);
    
    const token = localStorage.getItem('access_token');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
    
    return this.http.get<ApiResponse<any>>(url, { headers })
      .pipe(
        takeUntil(this.destroy$),
        map((response) => {
          console.log('Employee ranks response:', response);
          if (response.ok && response.data) {
            // Handle paginated response (exactly like Ranking component)
            let employees: any[] = [];
            if (response.data.pageData && Array.isArray(response.data.pageData)) {
              employees = response.data.pageData;
            } else if (Array.isArray(response.data)) {
              employees = response.data;
            }
            
            console.log('Employees array:', employees);
            console.log('Total employees found:', employees.length);
            
            // Sort by monthlyRank and return top 3 (exactly like Ranking component)
            const sortedEmployees = employees
              .sort((a, b) => a.monthlyRank - b.monthlyRank)
              .slice(0, 3)
              .map(emp => {
                console.log(`Mapping employee: ${emp.firstName} ${emp.lastName}, rank: ${emp.monthlyRank}, points: ${emp.monthlyPoint}`);
                return {
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
                } as EmployeeRank;
              });
            
            console.log('Top 3 employees after sorting:', sortedEmployees);
            return sortedEmployees;
          }
          console.log('No valid response data');
          return [];
        }),
        catchError((err) => {
          console.error('Error loading employee ranks:', err);
          return of([]);
        })
      );
  }

  /**
   * Load task statistics
   */
  loadTaskStats() {
    const url = `${this.apiUrl}/task/stats`;
    console.log('Loading task stats from:', url);
    
    const token = localStorage.getItem('access_token');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
    
    return this.http.get<ApiResponse<TaskStats>>(url, { headers })
      .pipe(
        takeUntil(this.destroy$),
        map((response) => {
          console.log('Task stats response:', response);
          if (response.ok && response.data) {
            return response.data;
          }
          return {
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
        }),
        catchError((err) => {
          console.error('Error loading task stats:', err);
          return of({
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
          });
        })
      );
  }

  /**
   * Load today's attendance
   */
  loadTodayAttendance() {
    const url = `${this.apiUrl}/attendance?order=desc&period=Day`;
    console.log('Loading attendance from:', url);
    
    const token = localStorage.getItem('access_token');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
    
    return this.http.get<ApiResponse<PaginatedAttendance>>(url, { headers })
      .pipe(
        takeUntil(this.destroy$),
        map((response) => {
          console.log('Attendance response:', response);
          if (response.ok && response.data) {
            return response.data;
          }
          return {
            page: 1,
            count: 0,
            totalPages: 0,
            totalItems: 0,
            pageData: []
          };
        }),
        catchError((err) => {
          console.error('Error loading attendance:', err);
          return of({
            page: 1,
            count: 0,
            totalPages: 0,
            totalItems: 0,
            pageData: []
          });
        })
      );
  }

  /**
   * Load ALL ranked employees (not just top 3) for department calculations
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
   * Calculate best performing department from ranked employees
   */
  calculateBestDepartment(rankedEmployees: any[]): void {
    if (rankedEmployees.length === 0 || this.departments.length === 0) {
      this.bestDepartment = 'N/A';
      this.bestDepartmentPoints = 0;
      return;
    }

    console.log('=== DEPARTMENT CALCULATION DEBUG ===');
    console.log('Total ranked employees:', rankedEmployees.length);
    console.log('Sample employees with points:', rankedEmployees.slice(0, 3).map(e => ({
      name: e.firstName,
      dept: e.department,
      points: e.monthlyPoint
    })));
    
    const deptPoints = new Map<string, number>();
    
    // Initialize all departments with 0 points
    this.departments.forEach((dept: any) => {
      deptPoints.set(dept.name, 0);
    });
    
    // Add up employee points per department
    rankedEmployees.forEach((emp: any) => {
      if (emp.department) {
        const current = deptPoints.get(emp.department) || 0;
        const points = emp.monthlyPoint || 0;
        deptPoints.set(emp.department, current + points);
        
        if (points > 0) {
          console.log(`Adding ${points} points for ${emp.firstName} in ${emp.department}`);
        }
      }
    });
    
    console.log('Department Points:', Array.from(deptPoints.entries()));
    
    let maxPoints = 0;
    let bestDept = '';
    deptPoints.forEach((points, dept) => {
      if (points > maxPoints) {
        maxPoints = points;
        bestDept = dept;
      }
    });
    
    // If no department has any points, pick the one with most employees
    if (maxPoints === 0 && this.departments.length > 0) {
      console.log('No departments have points, using employee count fallback');
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
      console.log('Best by employee count:', bestDept);
    }
    
    console.log(`Best Department: ${bestDept} with ${maxPoints} total points`);
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
   * Calculate working hours
   */
  calculateWorkingHours(checkIn: string | null, checkOut: string | null): string {
    if (!checkIn || !checkOut) return '0h 0m';
    
    try {
      const start = new Date(checkIn);
      const end = new Date(checkOut);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return '0h 0m';
      }
      
      const diffMs = end.getTime() - start.getTime();
      if (diffMs < 0) return '0h 0m';
      
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      
      return `${diffHours}h ${diffMinutes}m`;
    } catch (error) {
      return '0h 0m';
    }
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
   * Get break badge class
   */
  getBreakBadgeClass(record: AttendanceRecord): string {
    if (!record.currentBreak) return 'text-primary';
    return 'text-warning';
  }

  /**
   * Calculate attendance percentage for an employee
   */
  calculateAttendancePercentage(userId: string): number {
    // Find employee in the employees list
    const employee = this.employees.find(emp => emp.id === userId) as any;
    if (employee && employee.monthlyAttendancePoint) {
      // Assuming max monthly points is 400 (adjust as needed)
      const percentage = Math.min((employee.monthlyAttendancePoint / 400) * 100, 100);
      return Math.round(percentage);
    }
    return 0;
  }

  /**
   * Get attendance points for an employee
   */
  getAttendancePoints(userId: string): number {
    const employee = this.employees.find(emp => emp.id === userId) as any;
    return employee?.monthlyAttendancePoint || 0;
  }

  /**
   * Get week overview for employee (last 5 days)
   */
  getWeekOverview(userId: string): string[] {
    // This would come from API - returning mock data for now
    // Returns status for M, T, W, T, F
    const statuses = ['success', 'success', 'danger', 'muted', 'muted'];
    return statuses;
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
   * Refresh dashboard data
   */
  refreshData(): void {
    console.log('Refreshing dashboard data...');
    this.loadAllDashboardData();
  }
}