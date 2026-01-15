import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

// Interfaces
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  email: string;
  phoneNumber: string;
  employeeId: string;
}

export interface Break {
  id: string;
  startTime: string;
  endTime: string | null;
  type: string;
}

export interface AttendanceRecord {
  id: string;
  date: string;
  checkIn: string;
  checkOut: string;
  status: string;
  isSeated?: boolean;
  currentBreak?: Break | null;
  breaks?: Break[];
  user?: User;
}

export interface AttendanceStats {
  totalPresent?: number;
  totalAbsent?: number;
  totalLate?: number;
  totalLeave?: number;
  totalStaff?: number;
  attendancePercentage?: number;
}

export interface TaskPoint {
  id: string;
  point: number;
  description: string;
}

export interface ExtraPoint {
  id: string;
  point: number;
  reason: string;
}

export interface PenaltyPoint {
  id: string;
  point: number;
  reason: string;
}

export interface AttendancePoint extends AttendanceRecord {
  point: number;
}

export interface DailyProgress {
  id: string;
  date: string;
  lastRank: number;
  monthlyTaskPoint: number;
  monthlyAttendancePoint: number;
  dailyTaskPoint: number;
  dailyAttendancePoint: number;
  totalPoint: number;
  monthlyTotalPoint: number;
  monthlyRank: number;
  rank: number;
  attendancePoint: AttendancePoint;
  taskPoints: TaskPoint[];
  extraPoints: ExtraPoint[];
  penaltyPoints: PenaltyPoint[];
}

export interface ApiResponse<T> {
  ok: boolean;
  data: T;
  error: any;
}

export type Period = 'Day' | 'Week' | 'Month' | 'Quarter' | 'Year';

@Injectable({
  providedIn: 'root'
})
export class AttendanceService {
  private baseUrl = 'https://pixels-office-server.azurewebsites.net/v1';
  private authTokenSubject = new BehaviorSubject<string>('');
  
  constructor(private http: HttpClient) {
    // Initialize with stored token or empty string
    const storedToken = localStorage.getItem('authToken');
    if (storedToken) {
      this.authTokenSubject.next(storedToken);
    }
  }

  /**
   * Set the authentication token
   */
  setAuthToken(token: string): void {
    this.authTokenSubject.next(token);
    localStorage.setItem('authToken', token);
  }

  /**
   * Get current auth token
   */
  getAuthToken(): string {
    return this.authTokenSubject.value;
  }

  /**
   * Get HTTP headers with authentication
   */
  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Authorization': `Bearer ${this.authTokenSubject.value}`,
      'Content-Type': 'application/json',
      'accept': 'application/json'
    });
  }

  /**
   * Get all attendance records with optional filters
   */
  getAllAttendance(order: 'asc' | 'desc' = 'desc', period?: Period): Observable<AttendanceRecord[]> {
    let url = `${this.baseUrl}/employee/attendance?order=${order}`;
    if (period) {
      url += `&period=${period}`;
    }

    return this.http.get<ApiResponse<AttendanceRecord | AttendanceRecord[]>>(url, {
      headers: this.getHeaders()
    }).pipe(
      map(response => {
        if (!response.ok) {
          throw new Error(response.error || 'Failed to fetch attendance records');
        }
        // Handle both single record and array responses
        return Array.isArray(response.data) ? response.data : [response.data];
      })
    );
  }

  /**
   * Get attendance records for a specific employee
   */
  getEmployeeAttendance(
    employeeId: string, 
    by: 'date' | 'status' = 'date',
    order: 'asc' | 'desc' = 'desc',
    period?: Period
  ): Observable<AttendanceRecord[]> {
    let url = `${this.baseUrl}/employee/${employeeId}/attendance?by=${by}&order=${order}`;
    if (period) {
      url += `&period=${period}`;
    }

    return this.http.get<ApiResponse<AttendanceRecord | AttendanceRecord[]>>(url, {
      headers: this.getHeaders()
    }).pipe(
      map(response => {
        if (!response.ok) {
          throw new Error(response.error || 'Failed to fetch employee attendance');
        }
        return Array.isArray(response.data) ? response.data : [response.data];
      })
    );
  }

  /**
   * Get attendance statistics for an employee
   */
  getEmployeeAttendanceStats(employeeId: string, period?: Period): Observable<AttendanceStats> {
    let url = `${this.baseUrl}/employee/${employeeId}/attendance/stats`;
    if (period) {
      url += `?period=${period}`;
    }

    return this.http.get<ApiResponse<AttendanceStats>>(url, {
      headers: this.getHeaders()
    }).pipe(
      map(response => {
        if (!response.ok) {
          throw new Error(response.error || 'Failed to fetch attendance stats');
        }
        return response.data;
      })
    );
  }

  /**
   * Get daily progress for an employee
   */
  getEmployeeDailyProgress(employeeId: string): Observable<DailyProgress> {
    return this.http.get<ApiResponse<DailyProgress>>(
      `${this.baseUrl}/employee/${employeeId}/daily-progress`,
      { headers: this.getHeaders() }
    ).pipe(
      map(response => {
        if (!response.ok) {
          throw new Error(response.error || 'Failed to fetch daily progress');
        }
        return response.data;
      })
    );
  }

  /**
   * Auto check-in/check-out for an employee
   */
  autoAttendance(
    employeeId: string,
    checkIn: Date,
    checkOut: Date,
    allowCheckIn: boolean = true,
    allowCheckOut: boolean = true
  ): Observable<DailyProgress> {
    const requestBody = {
      checkIn: checkIn.toISOString(),
      checkOut: checkOut.toISOString(),
      allowCheckIn,
      allowCheckOut
    };

    return this.http.post<ApiResponse<DailyProgress>>(
      `${this.baseUrl}/employee/${employeeId}/attendance/auto`,
      requestBody,
      { headers: this.getHeaders() }
    ).pipe(
      map(response => {
        if (!response.ok) {
          throw new Error(response.error || 'Failed to update attendance');
        }
        return response.data;
      })
    );
  }

  /**
   * Calculate working hours between check-in and check-out
   */
  calculateWorkingHours(checkIn: string, checkOut: string): { hours: number; minutes: number; total: number } {
    if (!checkIn || !checkOut) {
      return { hours: 0, minutes: 0, total: 0 };
    }

    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffMs = end.getTime() - start.getTime();
    
    if (diffMs < 0) {
      return { hours: 0, minutes: 0, total: 0 };
    }

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const total = hours + (minutes / 60);

    return { hours, minutes, total };
  }

  /**
   * Format time to 12-hour format
   */
  formatTime(dateString: string): string {
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
   * Format date
   */
  formatDate(dateString: string): { date: string; day: string } {
    if (!dateString) return { date: '-', day: '-' };
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return { date: '-', day: '-' };

    const formattedDate = date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const day = date.toLocaleDateString('en-US', { weekday: 'long' });
    
    return { date: formattedDate, day };
  }

  /**
   * Calculate attendance percentage based on working hours
   */
  calculateAttendancePercentage(checkIn: string, checkOut: string, standardHours: number = 8): number {
    const { total } = this.calculateWorkingHours(checkIn, checkOut);
    if (total === 0) return 0;
    
    return Math.min(Math.round((total / standardHours) * 100), 100);
  }

  /**
   * Calculate attendance points
   */
  calculateAttendancePoints(checkIn: string, checkOut: string, pointsPerHour: number = 40): number {
    const { hours } = this.calculateWorkingHours(checkIn, checkOut);
    return Math.min(hours * pointsPerHour, 320); // Max 320 points (8 hours * 40)
  }

  /**
   * Get status badge class
   */
  getStatusBadgeClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'present':
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
   * Get progress bar class based on percentage
   */
  getProgressBarClass(percentage: number): string {
    if (percentage >= 90) return 'bg-success';
    if (percentage >= 70) return 'bg-warning';
    return 'bg-danger';
  }

  /**
   * Check if date is weekend
   */
  isWeekend(dateString: string): boolean {
    const date = new Date(dateString);
    const day = date.getDay();
    return day === 0 || day === 6; // Sunday = 0, Saturday = 6
  }

  /**
   * Check if date is today
   */
  isToday(dateString: string): boolean {
    const date = new Date(dateString);
    const today = new Date();
    
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  }

  /**
   * Get calendar day class
   */
  getCalendarDayClass(record: AttendanceRecord | null, dateString: string): string {
    if (!record) {
      return this.isWeekend(dateString) ? 'day-weekend' : 'day-future';
    }

    switch (record.status?.toLowerCase()) {
      case 'present':
        return 'day-present';
      case 'absent':
        return 'day-absent';
      case 'late':
        return 'day-late';
      case 'leave':
        return 'day-leave';
      default:
        return this.isWeekend(dateString) ? 'day-weekend' : 'day-future';
    }
  }

  /**
   * Get calendar day styles
   */
  getCalendarDayStyles(record: AttendanceRecord | null, dateString: string): any {
    const styles: any = {};

    if (!record) {
      if (this.isWeekend(dateString)) {
        styles.backgroundColor = '#f5f5f5';
        styles.color = '#9e9e9e';
        styles.border = '1px solid #e0e0e0';
      } else {
        styles.backgroundColor = '#fafafa';
        styles.color = '#bdbdbd';
        styles.border = '1px solid #eeeeee';
      }
      return styles;
    }

    switch (record.status?.toLowerCase()) {
      case 'present':
        styles.backgroundColor = '#e8f5e9';
        styles.color = '#2e7d32';
        styles.border = '1px solid #c8e6c9';
        break;
      case 'absent':
        styles.backgroundColor = '#ffebee';
        styles.color = '#c62828';
        styles.border = '1px solid #ffcdd2';
        break;
      case 'late':
        styles.backgroundColor = '#fff3e0';
        styles.color = '#ef6c00';
        styles.border = '1px solid #ffe0b2';
        break;
      case 'leave':
        styles.backgroundColor = '#e3f2fd';
        styles.color = '#1976d2';
        styles.border = '1px solid #bbdefb';
        break;
      default:
        if (this.isWeekend(dateString)) {
          styles.backgroundColor = '#f5f5f5';
          styles.color = '#9e9e9e';
          styles.border = '1px solid #e0e0e0';
        } else {
          styles.backgroundColor = '#fafafa';
          styles.color = '#bdbdbd';
          styles.border = '1px solid #eeeeee';
        }
    }

    if (this.isToday(dateString)) {
      styles.border = '2px solid #2196f3';
    }

    return styles;
  }
}