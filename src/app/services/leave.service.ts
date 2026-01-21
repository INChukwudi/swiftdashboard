// src/app/services/leave.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

// Interfaces
export interface LeaveUser {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  email: string;
  phoneNumber: string;
  employeeId: string;
  department: string;
  job: string;
  avatarUrl: string;
}

export interface LeaveApproval {
  id: string;
  title: string | null;
  body: string | null;
  user: LeaveUser;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveRejection {
  id: string;
  title: string;
  body: string;
  user: LeaveUser;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveItem {
  id: string;
  title: string;
  body: string;
  type: LeaveType;
  status: LeaveStatus;
  startDate: string;
  endDate: string;
  user: LeaveUser;
  approval: LeaveApproval | null;
  rejection: LeaveRejection | null;
  createdAt: string;
  updatedAt: string;
}

export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected';
export type LeaveType = 'Sick' | 'Vacation' | 'Emergency' | 'Maternity' | 'Paternity' | 'Personal' | 'Other';

export interface LeaveStats {
  total: number;
  stats: {
    status: {
      Approved: number;
      Pending: number;
      Rejected: number;
    };
    type: {
      Emergency: number;
      Maternity: number;
      Other: number;
      Paternity: number;
      Personal: number;
      Sick: number;
      Vacation: number;
    };
  };
}

export interface LeaveListResponse {
  ok: boolean;
  data: {
    page: number;
    count: number;
    totalPages: number;
    totalItems: number;
    pageData: LeaveItem[];
  };
  error: string | null;
}

export interface LeaveResponse {
  ok: boolean;
  data: LeaveItem;
  error: string | null;
}

export interface LeaveStatsResponse {
  ok: boolean;
  data: LeaveStats;
  error: string | null;
}

export interface LeaveActionResponse {
  ok: boolean;
  data: LeaveItem;
  error: string | null;
}

export interface LeaveQueryParams {
  page?: number;
  limit?: number;
  status?: LeaveStatus;
  type?: LeaveType;
  search?: string;
}

@Injectable({
  providedIn: 'root'
})
export class LeaveService {
  private apiUrl = 'https://pixels-office-server.azurewebsites.net/v1/leave';

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  /**
   * Get leave statistics
   * GET /v1/leave/stats
   */
  getLeaveStats(): Observable<LeaveStatsResponse> {
    return this.http.get<LeaveStatsResponse>(
      `${this.apiUrl}/stats`,
      { headers: this.getAuthHeaders() }
    );
  }

  /**
   * Get all employee leaves (paginated)
   * GET /v1/leave
   */
  getAllLeaves(params?: LeaveQueryParams): Observable<LeaveListResponse> {
    let httpParams = new HttpParams();
    
    if (params) {
      if (params.page) httpParams = httpParams.set('page', params.page.toString());
      if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
      if (params.status) httpParams = httpParams.set('status', params.status);
      if (params.type) httpParams = httpParams.set('type', params.type);
      if (params.search) httpParams = httpParams.set('search', params.search);
    }

    return this.http.get<LeaveListResponse>(
      this.apiUrl,
      { headers: this.getAuthHeaders(), params: httpParams }
    );
  }

  /**
   * Get leaves by status
   */
  getLeavesByStatus(status: LeaveStatus, page: number = 1, limit: number = 10): Observable<LeaveListResponse> {
    return this.getAllLeaves({ status, page, limit });
  }

  /**
   * Get pending leaves
   */
  getPendingLeaves(page: number = 1, limit: number = 10): Observable<LeaveListResponse> {
    return this.getLeavesByStatus('Pending', page, limit);
  }

  /**
   * Get approved leaves
   */
  getApprovedLeaves(page: number = 1, limit: number = 10): Observable<LeaveListResponse> {
    return this.getLeavesByStatus('Approved', page, limit);
  }

  /**
   * Get rejected leaves
   */
  getRejectedLeaves(page: number = 1, limit: number = 10): Observable<LeaveListResponse> {
    return this.getLeavesByStatus('Rejected', page, limit);
  }

  /**
   * Get single leave by ID
   * GET /v1/leave/{leaveId}
   */
  getLeaveById(leaveId: string): Observable<LeaveResponse> {
    return this.http.get<LeaveResponse>(
      `${this.apiUrl}/${leaveId}`,
      { headers: this.getAuthHeaders() }
    );
  }

  /**
   * Approve a leave request
   * POST /v1/leave/{leaveId}/approve
   */
  approveLeave(leaveId: string, comment?: { title?: string; body?: string }): Observable<LeaveActionResponse> {
    return this.http.post<LeaveActionResponse>(
      `${this.apiUrl}/${leaveId}/approve`,
      comment || {},
      { headers: this.getAuthHeaders() }
    );
  }

  /**
   * Reject a leave request
   * POST /v1/leave/{leaveId}/reject
   */
  rejectLeave(leaveId: string, reason?: { title?: string; body?: string }): Observable<LeaveActionResponse> {
    return this.http.post<LeaveActionResponse>(
      `${this.apiUrl}/${leaveId}/reject`,
      reason || {},
      { headers: this.getAuthHeaders() }
    );
  }

  /**
   * Helper: Calculate leave duration in days
   */
  calculateLeaveDuration(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1; // Include both start and end dates
  }

  /**
   * Helper: Format date for display
   */
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  /**
   * Helper: Get badge class based on leave type
   */
  getLeaveTypeBadgeClass(type: LeaveType): string {
    const badgeClasses: Record<LeaveType, string> = {
      'Sick': 'badge-light-danger',
      'Vacation': 'badge-light-primary',
      'Emergency': 'badge-light-warning',
      'Maternity': 'badge-light-info',
      'Paternity': 'badge-light-info',
      'Personal': 'badge-light-success',
      'Other': 'badge-light-secondary'
    };
    return badgeClasses[type] || 'badge-light-secondary';
  }

  /**
   * Helper: Get badge class based on leave status
   */
  getLeaveStatusBadgeClass(status: LeaveStatus): string {
    const badgeClasses: Record<LeaveStatus, string> = {
      'Pending': 'badge-light-warning',
      'Approved': 'badge-light-success',
      'Rejected': 'badge-light-danger'
    };
    return badgeClasses[status] || 'badge-light-secondary';
  }
}