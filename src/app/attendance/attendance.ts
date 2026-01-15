import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink, RouterModule, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../services/auth.service';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  email: string;
  phoneNumber: string;
  employeeId: string;
}

interface Break {
  id: string;
  startTime: string;
  endTime: string | null;
  type: string;
}

interface AttendanceRecord {
  id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  isSeated: boolean;
  currentBreak: Break | null;
  breaks: Break[];
  user: User;
}

interface PaginatedData {
  page: number;
  count: number;
  totalPages: number;
  totalItems: number;
  pageData: AttendanceRecord[];
}

interface AttendanceStats {
  totalPresent: number;
  totalAbsent: number;
  totalLate: number;
  totalLeave: number;
  totalOnTime: number;
  totalStaff: number;
}

interface ApiResponse<T> {
  ok: boolean;
  data: T;
  error: any;
}

type Period = 'Day' | 'Week' | 'Month' | 'Quarter' | 'Year';

@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLink, RouterLinkActive, FormsModule],
  templateUrl: './attendance.html',
  styleUrl: './attendance.scss',
})
export class Attendance implements OnInit, OnDestroy {
  private apiUrl = 'https://pixels-office-server.azurewebsites.net/v1';
  private destroy$ = new Subject<void>();
  

  attendanceRecords: AttendanceRecord[] = [];
  paginationData: PaginatedData | null = null;
  
  attendanceStats: AttendanceStats = {
    totalPresent: 0,
    totalAbsent: 0,
    totalLate: 0,
    totalLeave: 0,
    totalOnTime: 0,
    totalStaff: 0
  };
  
  selectedPeriod: Period = 'Day';
  currentPage: number = 1;
  loading = true;
  error: string | null = null;
  currentUser: any = null;
emp: any;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Get current user
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.currentUser = user;
      });

    // Load attendance data
    this.loadAttendanceData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load attendance data from API
   * Uses: GET /v1/attendance?order=desc&period={Period}
   */
  loadAttendanceData(page: number = 1): void {
    this.loading = true;
    this.error = null;
    this.currentPage = page;

    const url = `${this.apiUrl}/attendance?order=desc&period=${this.selectedPeriod}`;

    this.http.get<ApiResponse<PaginatedData>>(url)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('API Response:', response); // Debug log
          
          if (response.ok && response.data) {
            // Store pagination data
            this.paginationData = response.data;
            
            // Extract attendance records from pageData
            this.attendanceRecords = response.data.pageData || [];
            
            console.log('Attendance Records:', this.attendanceRecords); // Debug log
            
            // Calculate statistics
            this.calculateStats();
            this.loading = false;
          } else {
            this.error = response.error || 'Failed to load attendance data';
            this.loading = false;
          }
        },
        error: (err) => {
          console.error('Error loading attendance:', err);
          
          // Handle specific error cases
          if (err.status === 401) {
            this.error = 'Session expired. Please login again.';
            this.authService.logout();
          } else if (err.status === 403) {
            this.error = 'You do not have permission to view this data.';
          } else if (err.status === 0) {
            this.error = 'Unable to connect to server. Please check your internet connection.';
          } else {
            this.error = 'Failed to load attendance data. Please try again.';
          }
          
          this.loading = false;
        }
      });
  }

  /**
   * Calculate statistics from attendance records
   */
  private calculateStats(): void {
    // Reset stats
    this.attendanceStats = {
      totalPresent: 0,
      totalAbsent: 0,
      totalLate: 0,
      totalLeave: 0,
      totalOnTime: 0,
      totalStaff: 0
    };

    // Count by status
    this.attendanceRecords.forEach(record => {
      const status = record.status?.toLowerCase() || 'absent';
      
      switch (status) {
        case 'present':
          this.attendanceStats.totalPresent++;
          break;
        case 'absent':
          this.attendanceStats.totalAbsent++;
          break;
        case 'late':
          this.attendanceStats.totalLate++;
          break;
        case 'leave':
          this.attendanceStats.totalLeave++;
          break;
        case 'ontime':
          this.attendanceStats.totalOnTime++;
          break;
      }
    });

    // Total staff is the total number of unique records for today
    // If it's a "Day" period, count unique users
    if (this.selectedPeriod === 'Day') {
      const uniqueUsers = new Set(this.attendanceRecords.map(r => r.user.id));
      this.attendanceStats.totalStaff = uniqueUsers.size;
    } else {
      // For other periods, use total items from pagination
      this.attendanceStats.totalStaff = this.paginationData?.totalItems || this.attendanceRecords.length;
    }
    
    console.log('Stats:', this.attendanceStats); // Debug log
  }

  /**
   * Change the period filter and reload data
   */
  changePeriod(period: Period): void {
    this.selectedPeriod = period;
    this.loadAttendanceData(1);
  }

  /**
   * Load a specific page
   */
  loadPage(page: number): void {
    if (page >= 1 && this.paginationData && page <= this.paginationData.totalPages) {
      this.loadAttendanceData(page);
    }
  }

  /**
   * Refresh the attendance data
   */
  refreshData(): void {
    this.loadAttendanceData(this.currentPage);
  }

  /**
   * Calculate working hours between check-in and check-out
   */
  getWorkingHours(checkIn: string | null, checkOut: string | null): string {
    if (!checkIn || !checkOut) return '0H 0M';
    
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    
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
   * Format time to 12-hour format with AM/PM
   */
  formatTime(dateString: string | null): string {
    if (!dateString) return '-';
    
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) return '-';
    
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  }

  /**
   * Get attendance percentage based on working hours
   * Assumes 8 hours is 100%
   */
  getAttendancePercentage(checkIn: string | null, checkOut: string | null): number {
    if (!checkIn || !checkOut) return 0;
    
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return 0;
    }
    
    const diffMs = end.getTime() - start.getTime();
    if (diffMs < 0) return 0;
    
    const diffHours = diffMs / (1000 * 60 * 60);
    
    // Calculate percentage based on 8-hour workday
    const percentage = Math.round((diffHours / 8) * 100);
    
    // Cap at 100%
    return Math.min(percentage, 100);
  }

  /**
   * Calculate attendance points
   * 40 points per hour, max 320 points (8 hours)
   */
  getAttendancePoints(checkIn: string | null, checkOut: string | null): number {
    if (!checkIn || !checkOut) return 0;
    
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return 0;
    }
    
    const diffMs = end.getTime() - start.getTime();
    if (diffMs < 0) return 0;
    
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    // 40 points per hour
    const points = diffHours * 40;
    
    // Cap at 320 points (8 hours * 40)
    return Math.min(points, 320);
  }

  /**
   * Get CSS class for status badge
   */
  getStatusBadgeClass(status: string): string {
    switch (status?.toLowerCase()) {
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
   * Get break status information
   */
  getBreakStatus(record: AttendanceRecord): { type: string; icon: string } | null {
    // If not seated and has a current break
    if (!record.isSeated && record.currentBreak) {
      const breakType = record.currentBreak.type?.toLowerCase() || 'break';
      
      if (breakType.includes('tea')) {
        return { type: 'Tea Break', icon: 'bi-cup-hot-fill text-warning' };
      } else if (breakType.includes('lunch')) {
        return { type: 'Lunch Break', icon: 'bi-egg-fried text-warning' };
      } else {
        return { type: 'Break', icon: 'bi-pause-circle text-info' };
      }
    }
    
    // If seated
    if (record.isSeated && record.checkIn) {
      return { type: 'On Seat', icon: 'bi-laptop text-primary' };
    }
    
    return null;
  }

  /**
   * Get week overview for an employee (placeholder)
   * This would need a separate API call to get weekly attendance
   */
  getWeekOverview(employeeId: string): string[] {
    // Return day initials as placeholder
    // In a real implementation, you'd fetch the week's attendance
    return ['M', 'T', 'W', 'T', 'F'];
  }

  /**
   * Get progress bar color class based on percentage
   */
  getProgressBarClass(percentage: number): string {
    if (percentage >= 90) return 'bg-success';
    if (percentage >= 70) return 'bg-warning';
    return 'bg-danger';
  }

  /**
   * Format date to readable format
   */
  formatDate(dateString: string): string {
    if (!dateString) return '-';
    
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) return '-';
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  /**
   * Check if user has permission to view attendance
   */
  canViewAttendance(): boolean {
    return this.authService.isLoggedIn();
  }

  /**
   * Navigate to employee detail page
   */
  viewEmployeeDetail(employeeId: string): void {
    // This will be handled by routerLink in the template
  }

  /**
   * Get total present count (including OnTime)
   */
  getTotalPresent(): number {
    return this.attendanceStats.totalPresent + this.attendanceStats.totalOnTime;
  }
}