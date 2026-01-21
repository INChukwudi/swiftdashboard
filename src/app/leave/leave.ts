// src/app/leave/leave.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { 
  LeaveService, 
  LeaveItem,
  LeaveStats, 
  LeaveStatus, 
  LeaveType,
  LeaveStatsResponse,
  LeaveListResponse,
  LeaveActionResponse
} from '../services/leave.service';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-leave',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './leave.html',
  styleUrl: './leave.scss',
})
export class Leave implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Data
  leaves: LeaveItem[] = [];
  leaveStats: LeaveStats | null = null;
  selectedLeave: LeaveItem | null = null;

  // Pagination
  currentPage = 1;
  totalPages = 1;
  totalItems = 0;
  itemsPerPage = 10;

  // Filters
  activeTab: 'new' | 'approved' | 'declined' | 'terminated' = 'new';
  
  // Loading states
  isLoading = false;
  isLoadingStats = false;
  isProcessing = false;

  // Modal states
  showViewModal = false;
  showCommentModal = false;
  commentAction: 'approve' | 'reject' | null = null;
  comment = '';

  // User permissions
  isAdmin = false;

  constructor(
    private leaveService: LeaveService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.authService.isAdmin();
    this.loadLeaveStats();
    this.loadLeaves();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load leave statistics
   */
  loadLeaveStats(): void {
    this.isLoadingStats = true;
    this.leaveService.getLeaveStats()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: LeaveStatsResponse) => {
          if (response.ok) {
            this.leaveStats = response.data;
          }
          this.isLoadingStats = false;
        },
        error: (error: Error) => {
          console.error('Error loading leave stats:', error);
          this.isLoadingStats = false;
        }
      });
  }

  /**
   * Load leaves based on active tab
   */
  loadLeaves(): void {
    this.isLoading = true;
    const statusMap: Record<string, LeaveStatus | undefined> = {
      'new': 'Pending',
      'approved': 'Approved',
      'declined': 'Rejected',
      'terminated': undefined
    };

    const status = statusMap[this.activeTab];
    
    if (status) {
      this.leaveService.getLeavesByStatus(status, this.currentPage, this.itemsPerPage)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response: LeaveListResponse) => {
            if (response.ok) {
              this.leaves = response.data.pageData;
              this.totalPages = response.data.totalPages;
              this.totalItems = response.data.totalItems;
            }
            this.isLoading = false;
          },
          error: (error: Error) => {
            console.error('Error loading leaves:', error);
            this.isLoading = false;
          }
        });
    } else {
      this.leaveService.getAllLeaves({ page: this.currentPage, limit: this.itemsPerPage })
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response: LeaveListResponse) => {
            if (response.ok) {
              this.leaves = response.data.pageData;
              this.totalPages = response.data.totalPages;
              this.totalItems = response.data.totalItems;
            }
            this.isLoading = false;
          },
          error: (error: Error) => {
            console.error('Error loading leaves:', error);
            this.isLoading = false;
          }
        });
    }
  }

  /**
   * Switch tabs
   */
  switchTab(tab: 'new' | 'approved' | 'declined' | 'terminated'): void {
    this.activeTab = tab;
    this.currentPage = 1;
    this.loadLeaves();
  }

  /**
   * View leave details
   */
  viewLeave(leave: LeaveItem): void {
    this.selectedLeave = leave;
    this.showViewModal = true;
  }

  /**
   * Close view modal
   */
  closeViewModal(): void {
    this.showViewModal = false;
    this.selectedLeave = null;
  }

  /**
   * Open approve/reject modal
   */
  openActionModal(leave: LeaveItem, action: 'approve' | 'reject'): void {
    this.selectedLeave = leave;
    this.commentAction = action;
    this.comment = '';
    this.showCommentModal = true;
  }

  /**
   * Close comment modal
   */
  closeCommentModal(): void {
    this.showCommentModal = false;
    this.commentAction = null;
    this.comment = '';
  }

  /**
   * Submit approve/reject action
   */
  submitAction(): void {
    if (!this.selectedLeave || !this.commentAction) return;

    this.isProcessing = true;
    const payload = this.comment ? { body: this.comment } : undefined;

    const action$ = this.commentAction === 'approve'
      ? this.leaveService.approveLeave(this.selectedLeave.id, payload)
      : this.leaveService.rejectLeave(this.selectedLeave.id, payload);

    action$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: LeaveActionResponse) => {
          if (response.ok) {
            this.closeCommentModal();
            this.loadLeaves();
            this.loadLeaveStats();
            console.log(`Leave ${this.commentAction}d successfully`);
          }
          this.isProcessing = false;
        },
        error: (error: Error) => {
          console.error(`Error ${this.commentAction}ing leave:`, error);
          this.isProcessing = false;
        }
      });
  }

  /**
   * Quick approve (without modal)
   */
  quickApprove(leave: LeaveItem): void {
    this.selectedLeave = leave;
    this.commentAction = 'approve';
    this.showCommentModal = true;
  }

  /**
   * Quick reject (without modal)
   */
  quickReject(leave: LeaveItem): void {
    this.selectedLeave = leave;
    this.commentAction = 'reject';
    this.showCommentModal = true;
  }

  /**
   * Pagination
   */
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadLeaves();
    }
  }

  get paginationPages(): number[] {
    const pages: number[] = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
    const endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  }

  /**
   * Helper methods
   */
  getFullName(user: { firstName: string; lastName: string }): string {
    return `${user.firstName} ${user.lastName}`.trim();
  }

  formatDate(dateString: string): string {
    return this.leaveService.formatDate(dateString);
  }

  calculateDuration(startDate: string, endDate: string): number {
    return this.leaveService.calculateLeaveDuration(startDate, endDate);
  }

  getTypeBadgeClass(type: LeaveType): string {
    return this.leaveService.getLeaveTypeBadgeClass(type);
  }

  getStatusBadgeClass(status: LeaveStatus): string {
    return this.leaveService.getLeaveStatusBadgeClass(status);
  }

  /**
   * Track by function for ngFor
   */
  trackByLeaveId(index: number, leave: LeaveItem): string {
    return leave.id;
  }
}