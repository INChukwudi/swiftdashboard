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
  termination?: any | null;
  createdAt: string;
  updatedAt: string;
}

export interface CurrentLeave {
  id: string;
  title: string;
  body: string;
  type: LeaveType;
  days: number;
  startDate: string;
  endDate: string;
  daysElapsed: number;
  returnDate: string;
  daysRemaining: number;
}

export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected' | 'Terminated';
export type LeaveType = 
  | 'Sick' | 'Vacation' | 'Emergency' | 'Maternity' | 'Paternity' 
  | 'Personal' | 'Other' | 'Adoption' | 'Bereavement' | 'Compassionate'
  | 'Jury' | 'Marriage' | 'Medical' | 'Military' | 'Quarantine'
  | 'Religious' | 'Sabbatical' | 'Study' | 'Suspension' | 'Unpaid'
  | 'WorkFromHome' | 'Parental';

export interface LeaveStats {
  total: number;
  days: number;
  stats: {
    status: {
      Approved: number;
      Pending: number;
      Rejected: number;
      Terminated: number;
    };
    type: Record<string, number>;
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

export interface CurrentLeaveResponse {
  ok: boolean;
  data: CurrentLeave | null;
  error: string | null;
}

export interface LeaveQueryParams {
  page?: number;
  limit?: number;
  status?: LeaveStatus;
  type?: LeaveType;
  search?: string;
}

export interface CreateLeavePayload {
  title: string;
  body: string;
  startDate: string;
  endDate: string;
  type: LeaveType;
}

export interface UpdateLeavePayload {
  title?: string;
  body?: string;
  startDate?: string;
  endDate?: string;
  type?: LeaveType;
}

@Injectable({
  providedIn: 'root'
})
export class LeaveService {
  private baseUrl = 'https://pixels-office-server.azurewebsites.net/v1';
  private adminApiUrl = `${this.baseUrl}/leave`;
  private userApiUrl = `${this.baseUrl}/user/leave`;

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  // ==================== ADMIN ENDPOINTS ====================

  /**
   * Get leave statistics (Admin)
   * GET /v1/leave/stats
   */
  getLeaveStats(): Observable<LeaveStatsResponse> {
    return this.http.get<LeaveStatsResponse>(
      `${this.adminApiUrl}/stats`,
      { headers: this.getAuthHeaders() }
    );
  }

  /**
   * Get all employee leaves (Admin - paginated)
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
      this.adminApiUrl,
      { headers: this.getAuthHeaders(), params: httpParams }
    );
  }

  /**
   * Get leaves by status (Admin)
   */
  getLeavesByStatus(status: LeaveStatus, page: number = 1, limit: number = 10): Observable<LeaveListResponse> {
    return this.getAllLeaves({ status, page, limit });
  }

  /**
   * Approve a leave request (Admin)
   * POST /v1/leave/{leaveId}/approve
   */
  approveLeave(leaveId: string, comment?: { title?: string; body?: string }): Observable<LeaveActionResponse> {
    return this.http.post<LeaveActionResponse>(
      `${this.adminApiUrl}/${leaveId}/approve`,
      comment || {},
      { headers: this.getAuthHeaders() }
    );
  }

  /**
   * Reject a leave request (Admin)
   * POST /v1/leave/{leaveId}/reject
   */
  rejectLeave(leaveId: string, reason?: { title?: string; body?: string }): Observable<LeaveActionResponse> {
    return this.http.post<LeaveActionResponse>(
      `${this.adminApiUrl}/${leaveId}/reject`,
      reason || {},
      { headers: this.getAuthHeaders() }
    );
  }

  // ==================== USER ENDPOINTS ====================

  /**
   * Get user's leave statistics
   * GET /v1/user/leave/stats
   */
  getUserLeaveStats(): Observable<LeaveStatsResponse> {
    return this.http.get<LeaveStatsResponse>(
      `${this.userApiUrl}/stats`,
      { headers: this.getAuthHeaders() }
    );
  }

  /**
   * Get user's leaves (paginated)
   * GET /v1/user/leave
   */
  getUserLeaves(params?: LeaveQueryParams): Observable<LeaveListResponse> {
    let httpParams = new HttpParams();
    
    if (params) {
      if (params.page) httpParams = httpParams.set('page', params.page.toString());
      if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
      if (params.status) httpParams = httpParams.set('status', params.status);
      if (params.type) httpParams = httpParams.set('type', params.type);
    }

    return this.http.get<LeaveListResponse>(
      this.userApiUrl,
      { headers: this.getAuthHeaders(), params: httpParams }
    );
  }

  /**
   * Get user's leaves by status
   */
  getUserLeavesByStatus(status: LeaveStatus, page: number = 1, limit: number = 10): Observable<LeaveListResponse> {
    return this.getUserLeaves({ status, page, limit });
  }

  /**
   * Get user's current active leave
   * GET /v1/user/leave/current
   */
  getCurrentLeave(): Observable<CurrentLeaveResponse> {
    return this.http.get<CurrentLeaveResponse>(
      `${this.userApiUrl}/current`,
      { headers: this.getAuthHeaders() }
    );
  }

  /**
   * Create a new leave request
   * POST /v1/user/leave
   */
  createLeave(payload: CreateLeavePayload): Observable<LeaveResponse> {
    return this.http.post<LeaveResponse>(
      this.userApiUrl,
      payload,
      { headers: this.getAuthHeaders() }
    );
  }

  /**
   * Update a leave request (only if Pending)
   * PUT /v1/user/leave/{leaveId}
   */
  updateLeave(leaveId: string, payload: UpdateLeavePayload): Observable<LeaveResponse> {
    return this.http.put<LeaveResponse>(
      `${this.userApiUrl}/${leaveId}`,
      payload,
      { headers: this.getAuthHeaders() }
    );
  }

  /**
   * Delete a leave request (only if Pending)
   * DELETE /v1/user/leave/{leaveId}
   */
  deleteLeave(leaveId: string): Observable<{ ok: boolean; error: string | null }> {
    return this.http.delete<{ ok: boolean; error: string | null }>(
      `${this.userApiUrl}/${leaveId}`,
      { headers: this.getAuthHeaders() }
    );
  }

  // ==================== HELPER METHODS ====================

  /**
   * Get all available leave types
   */
  getLeaveTypes(): LeaveType[] {
    return [
      'Vacation', 'Sick', 'Emergency', 'Personal', 'Maternity', 'Paternity',
      'Medical', 'Bereavement', 'Marriage', 'Study', 'Compassionate',
      'Religious', 'Jury', 'Military', 'Quarantine', 'Sabbatical',
      'Adoption', 'Parental', 'WorkFromHome', 'Unpaid', 'Suspension', 'Other'
    ];
  }

  /**
   * Calculate leave duration in days
   */
  calculateLeaveDuration(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1;
  }

  /**
   * Format date for display
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
   * Format date for API (ISO string)
   */
  formatDateForApi(date: Date): string {
    return date.toISOString();
  }

  /**
   * Get badge class based on leave type
   */
  getLeaveTypeBadgeClass(type: LeaveType): string {
    const badgeClasses: Record<string, string> = {
      'Sick': 'badge-light-danger',
      'Vacation': 'badge-light-primary',
      'Emergency': 'badge-light-warning',
      'Maternity': 'badge-light-info',
      'Paternity': 'badge-light-info',
      'Personal': 'badge-light-success',
      'Medical': 'badge-light-danger',
      'Bereavement': 'badge-light-dark',
      'Marriage': 'badge-light-pink',
      'Study': 'badge-light-primary',
      'Compassionate': 'badge-light-warning',
      'WorkFromHome': 'badge-light-success',
      'Other': 'badge-light-secondary'
    };
    return badgeClasses[type] || 'badge-light-secondary';
  }

  /**
   * Get badge class based on leave status
   */
  getLeaveStatusBadgeClass(status: LeaveStatus): string {
    const badgeClasses: Record<LeaveStatus, string> = {
      'Pending': 'badge-light-warning',
      'Approved': 'badge-light-success',
      'Rejected': 'badge-light-danger',
      'Terminated': 'badge-light-dark'
    };
    return badgeClasses[status] || 'badge-light-secondary';
  }
}