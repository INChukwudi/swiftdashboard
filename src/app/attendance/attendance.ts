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

interface EmployeeRankData {
  id: string;
  firstName: string;
  lastName: string;
  monthlyAttendancePoint: number;
  monthlyTaskPoint: number;
  monthlyExtraPoint: number;
  monthlyPenaltyPoint: number;
  monthlyPoint: number;
  monthlyRank: number;
  dailyAttendancePoint: number;
  dailyTaskPoint: number;
  dailyPoint: number;
  dailyRank: number;
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

  // ============================================
  // LIVE TRACKING PROPERTIES
  // ============================================
  liveWorkingHours: number = 0;
  liveWorkingMinutes: number = 0;
  liveAttendancePoints: number = 0;
  liveProgressPercentage: number = 0;
  currentUserTodayRecord: AttendanceRecord | null = null;
  private liveUpdateInterval: any = null;

  // Monthly data from rank API
  monthlyAttendancePoints: number = 0;
  employeeRankData: EmployeeRankData | null = null;
  monthlyTargetPoints: number = 400;
  monthlyProgressPercentage: number = 0;
  pointsToMonthlyTarget: number = 0;

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
        
        // Load rank data for the current user
        if (user?.id) {
          this.loadEmployeeRankData(user.id);
        }
      });

    // Load attendance data
    this.loadAttendanceData();
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
   * Find and track the current user's today attendance record
   */
  private trackCurrentUserAttendance(): void {
    if (!this.currentUser) return;

    // For Day period, find current user's record
    if (this.selectedPeriod === 'Day') {
      this.currentUserTodayRecord = this.attendanceRecords.find(
        record => record.user.id === this.currentUser.id
      ) || null;
    } else {
      // For other periods, find today's record from the list
      const today = new Date().toISOString().slice(0, 10);
      this.currentUserTodayRecord = this.attendanceRecords.find(
        record => record.user.id === this.currentUser.id && 
                  record.date.startsWith(today)
      ) || null;
    }

    if (this.currentUserTodayRecord?.checkIn && !this.currentUserTodayRecord?.checkOut) {
      // User is clocked in but not clocked out - start live updates
      this.startLiveUpdates();
    } else if (this.currentUserTodayRecord?.checkIn && this.currentUserTodayRecord?.checkOut) {
      // User has clocked out - calculate final values
      this.calculateFinalWorkingHours();
      this.stopLiveUpdates();
    } else {
      // No check-in record
      this.resetLiveValues();
      this.stopLiveUpdates();
    }
  }

  /**
   * Start live updates every minute
   */
  private startLiveUpdates(): void {
    this.stopLiveUpdates();

    // Update immediately
    this.updateLiveWorkingHours();

    // Update every minute (60000ms)
    this.liveUpdateInterval = setInterval(() => {
      this.updateLiveWorkingHours();
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
   * Update live working hours and points in real-time
   */
  private updateLiveWorkingHours(): void {
    if (!this.currentUserTodayRecord?.checkIn) {
      this.resetLiveValues();
      return;
    }

    const now = new Date();
    const checkIn = new Date(this.currentUserTodayRecord.checkIn);

    // Validate dates
    if (isNaN(checkIn.getTime())) {
      this.resetLiveValues();
      return;
    }

    const diffMs = now.getTime() - checkIn.getTime();
    if (diffMs < 0) {
      this.resetLiveValues();
      return;
    }

    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    this.liveWorkingHours = Math.floor(totalMinutes / 60);
    this.liveWorkingMinutes = totalMinutes % 60;

    // 1 hour = 1 point
    this.liveAttendancePoints = parseFloat((totalMinutes / 60).toFixed(2));

    // Progress based on 8 hours target (can exceed 100%)
    this.liveProgressPercentage = parseFloat(((totalMinutes / 60) / 8 * 100).toFixed(1));
  }

  /**
   * Calculate final working hours when user has clocked out
   */
  private calculateFinalWorkingHours(): void {
    if (!this.currentUserTodayRecord?.checkIn || !this.currentUserTodayRecord?.checkOut) {
      this.resetLiveValues();
      return;
    }

    const checkIn = new Date(this.currentUserTodayRecord.checkIn);
    const checkOut = new Date(this.currentUserTodayRecord.checkOut);

    // Validate dates
    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      this.resetLiveValues();
      return;
    }

    const diffMs = checkOut.getTime() - checkIn.getTime();
    if (diffMs < 0) {
      this.resetLiveValues();
      return;
    }

    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    this.liveWorkingHours = Math.floor(totalMinutes / 60);
    this.liveWorkingMinutes = totalMinutes % 60;

    // 1 hour = 1 point
    this.liveAttendancePoints = parseFloat((totalMinutes / 60).toFixed(2));

    // Progress based on 8 hours target
    this.liveProgressPercentage = parseFloat(((totalMinutes / 60) / 8 * 100).toFixed(1));
  }

  /**
   * Reset live values to zero
   */
  private resetLiveValues(): void {
    this.liveWorkingHours = 0;
    this.liveWorkingMinutes = 0;
    this.liveAttendancePoints = 0;
    this.liveProgressPercentage = 0;
  }

  /**
   * Get CSS class for live progress bar
   */
  getLiveProgressBarClass(): string {
    if (this.liveProgressPercentage >= 100) return 'bg-success';
    if (this.liveProgressPercentage >= 75) return 'bg-info';
    if (this.liveProgressPercentage >= 50) return 'bg-warning';
    return 'bg-danger';
  }

  /**
   * Load employee rank data to get monthly attendance points
   */
  loadEmployeeRankData(userId: string): void {
    const url = `${this.apiUrl}/employee/rank`;

    this.http.get<ApiResponse<{ pageData: EmployeeRankData[] }>>(url)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.ok && response.data && response.data.pageData) {
            // Find current user's rank data
            this.employeeRankData = response.data.pageData.find(
              (emp: EmployeeRankData) => emp.id === userId
            ) || null;

            if (this.employeeRankData) {
              this.monthlyAttendancePoints = this.employeeRankData.monthlyAttendancePoint || 0;
              this.calculateMonthlyProgress();
            }
          }
        },
        error: (err) => {
          console.error('Error loading rank data:', err);
        }
      });
  }

  /**
   * Calculate monthly progress toward target
   */
  private calculateMonthlyProgress(): void {
    this.monthlyProgressPercentage = Math.min(
      parseFloat(((this.monthlyAttendancePoints / this.monthlyTargetPoints) * 100).toFixed(1)),
      100
    );
    this.pointsToMonthlyTarget = Math.max(
      parseFloat((this.monthlyTargetPoints - this.monthlyAttendancePoints).toFixed(2)),
      0
    );
  }

  // ============================================
  // EXISTING METHODS (UPDATED)
  // ============================================

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
          console.log('API Response:', response);

          if (response.ok && response.data) {
            // Store pagination data
            this.paginationData = response.data;

            // Extract attendance records from pageData
            this.attendanceRecords = response.data.pageData || [];

            console.log('Attendance Records:', this.attendanceRecords);

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
    if (this.selectedPeriod === 'Day') {
      const uniqueUsers = new Set(this.attendanceRecords.map(r => r.user.id));
      this.attendanceStats.totalStaff = uniqueUsers.size;
    } else {
      this.attendanceStats.totalStaff = this.paginationData?.totalItems || this.attendanceRecords.length;
    }

    console.log('Stats:', this.attendanceStats);

    // Track current user's attendance for live updates
    this.trackCurrentUserAttendance();
  }

  /**
   * Change the period filter and reload data
   */
  changePeriod(period: Period): void {
    this.selectedPeriod = period;
    this.stopLiveUpdates();
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
    
    // Also refresh rank data
    if (this.currentUser?.id) {
      this.loadEmployeeRankData(this.currentUser.id);
    }
  }

  /**
   * Calculate working hours between check-in and check-out
   * If no check-out, uses current time
   */
  getWorkingHours(checkIn: string | null, checkOut: string | null): string {
    if (!checkIn) return '0H 0M';

    const start = new Date(checkIn);
    let end: Date;

    if (checkOut) {
      end = new Date(checkOut);
    } else {
      // Still clocked in - use current time
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
   * 8 hours = 100% (can exceed 100%)
   */
  getAttendancePercentage(checkIn: string | null, checkOut: string | null): number {
    if (!checkIn) return 0;

    const start = new Date(checkIn);
    let end: Date;

    if (checkOut) {
      end = new Date(checkOut);
    } else {
      // Still clocked in - use current time
      end = new Date();
    }

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
   * Calculate attendance points
   * 1 hour = 1 point (no cap for daily calculation)
   */
  getAttendancePoints(checkIn: string | null, checkOut: string | null): number {
    if (!checkIn) return 0;

    const start = new Date(checkIn);
    let end: Date;

    if (checkOut) {
      end = new Date(checkOut);
    } else {
      // Still clocked in - use current time
      end = new Date();
    }

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
   */
  getWeekOverview(employeeId: string): string[] {
    return ['M', 'T', 'W', 'T', 'F'];
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

  /**
   * Check if the current user is still clocked in
   */
  isCurrentUserClockedIn(): boolean {
    return !!(this.currentUserTodayRecord?.checkIn && !this.currentUserTodayRecord?.checkOut);
  }

  /**
   * Get monthly progress bar class
   */
  getMonthlyProgressBarClass(): string {
    if (this.monthlyProgressPercentage >= 100) return 'bg-success';
    if (this.monthlyProgressPercentage >= 75) return 'bg-info';
    if (this.monthlyProgressPercentage >= 50) return 'bg-warning';
    return 'bg-danger';
  }
}