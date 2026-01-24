// src/app/myleave/myleave.ts
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
  CurrentLeave,
  CreateLeavePayload,
  UpdateLeavePayload,
  LeaveStatsResponse,
  LeaveListResponse,
  LeaveResponse,
  CurrentLeaveResponse
} from '../services/leave.service';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-myleave',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './myleave.html',
  styleUrl: './myleave.scss',
})
export class Myleave implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Data
  leaves: LeaveItem[] = [];
  leaveStats: LeaveStats | null = null;
  currentLeave: CurrentLeave | null = null;
  selectedLeave: LeaveItem | null = null;
  leaveTypes: LeaveType[] = [];

  // Pagination
  currentPage = 1;
  totalPages = 1;
  totalItems = 0;
  itemsPerPage = 10;

  // Filters
  activeTab: 'pending' | 'approved' | 'declined' | 'all' = 'all';

  // Loading states
  isLoading = false;
  isLoadingStats = false;
  isLoadingCurrentLeave = false;
  isSubmitting = false;
  isDeleting = false;

  // Modal states
  showCreateModal = false;
  showEditModal = false;
  showViewModal = false;
  showDeleteModal = false;

  // Form data
  leaveForm: CreateLeavePayload = {
    title: '',
    body: '',
    startDate: '',
    endDate: '',
    type: 'Vacation'
  };

  // Form validation
  formErrors: { [key: string]: string } = {};

  constructor(
    private leaveService: LeaveService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.leaveTypes = this.leaveService.getLeaveTypes();
    this.loadLeaveStats();
    this.loadCurrentLeave();
    this.loadLeaves();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==================== DATA LOADING ====================

  loadLeaveStats(): void {
    this.isLoadingStats = true;
    this.leaveService.getUserLeaveStats()
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

  loadCurrentLeave(): void {
    this.isLoadingCurrentLeave = true;
    this.leaveService.getCurrentLeave()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: CurrentLeaveResponse) => {
          if (response.ok) {
            this.currentLeave = response.data;
          }
          this.isLoadingCurrentLeave = false;
        },
        error: (error: Error) => {
          console.error('Error loading current leave:', error);
          this.isLoadingCurrentLeave = false;
        }
      });
  }

  loadLeaves(): void {
    this.isLoading = true;
    const statusMap: Record<string, LeaveStatus | undefined> = {
      'pending': 'Pending',
      'approved': 'Approved',
      'declined': 'Rejected',
      'all': undefined
    };

    const status = statusMap[this.activeTab];

    if (status) {
      this.leaveService.getUserLeavesByStatus(status, this.currentPage, this.itemsPerPage)
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
      this.leaveService.getUserLeaves({ page: this.currentPage, limit: this.itemsPerPage })
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

  // ==================== TAB SWITCHING ====================

  switchTab(tab: 'pending' | 'approved' | 'declined' | 'all'): void {
    this.activeTab = tab;
    this.currentPage = 1;
    this.loadLeaves();
  }

  // ==================== CREATE LEAVE ====================

  openCreateModal(): void {
    this.resetForm();
    this.showCreateModal = true;
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
    this.resetForm();
  }

  validateForm(): boolean {
    this.formErrors = {};

    if (!this.leaveForm.title.trim()) {
      this.formErrors['title'] = 'Leave title is required';
    }

    if (!this.leaveForm.type) {
      this.formErrors['type'] = 'Leave type is required';
    }

    if (!this.leaveForm.startDate) {
      this.formErrors['startDate'] = 'Start date is required';
    }

    if (!this.leaveForm.endDate) {
      this.formErrors['endDate'] = 'End date is required';
    }

    if (this.leaveForm.startDate && this.leaveForm.endDate) {
      const start = new Date(this.leaveForm.startDate);
      const end = new Date(this.leaveForm.endDate);
      if (end < start) {
        this.formErrors['endDate'] = 'End date must be after start date';
      }
    }

    if (!this.leaveForm.body.trim()) {
      this.formErrors['body'] = 'Leave details are required';
    }

    return Object.keys(this.formErrors).length === 0;
  }

  submitCreateLeave(): void {
    if (!this.validateForm()) return;

    this.isSubmitting = true;

    const payload: CreateLeavePayload = {
      title: this.leaveForm.title.trim(),
      body: this.leaveForm.body.trim(),
      startDate: new Date(this.leaveForm.startDate).toISOString(),
      endDate: new Date(this.leaveForm.endDate).toISOString(),
      type: this.leaveForm.type
    };

    this.leaveService.createLeave(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: LeaveResponse) => {
          if (response.ok) {
            this.closeCreateModal();
            this.loadLeaves();
            this.loadLeaveStats();
            console.log('Leave request created successfully');
          }
          this.isSubmitting = false;
        },
        error: (error: Error) => {
          console.error('Error creating leave:', error);
          this.isSubmitting = false;
        }
      });
  }

  // ==================== EDIT LEAVE ====================

  openEditModal(leave: LeaveItem): void {
    if (leave.status !== 'Pending') {
      console.warn('Only pending leaves can be edited');
      return;
    }

    this.selectedLeave = leave;
    this.leaveForm = {
      title: leave.title,
      body: leave.body,
      startDate: this.formatDateForInput(leave.startDate),
      endDate: this.formatDateForInput(leave.endDate),
      type: leave.type
    };
    this.formErrors = {};
    this.showEditModal = true;
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.selectedLeave = null;
    this.resetForm();
  }

  submitEditLeave(): void {
    if (!this.selectedLeave || !this.validateForm()) return;

    this.isSubmitting = true;

    const payload: UpdateLeavePayload = {
      title: this.leaveForm.title.trim(),
      body: this.leaveForm.body.trim(),
      startDate: new Date(this.leaveForm.startDate).toISOString(),
      endDate: new Date(this.leaveForm.endDate).toISOString(),
      type: this.leaveForm.type
    };

    this.leaveService.updateLeave(this.selectedLeave.id, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: LeaveResponse) => {
          if (response.ok) {
            this.closeEditModal();
            this.loadLeaves();
            this.loadLeaveStats();
            console.log('Leave request updated successfully');
          }
          this.isSubmitting = false;
        },
        error: (error: Error) => {
          console.error('Error updating leave:', error);
          this.isSubmitting = false;
        }
      });
  }

  // ==================== VIEW LEAVE ====================

  viewLeave(leave: LeaveItem): void {
    this.selectedLeave = leave;
    this.showViewModal = true;
  }

  closeViewModal(): void {
    this.showViewModal = false;
    this.selectedLeave = null;
  }

  // ==================== DELETE LEAVE ====================

  openDeleteModal(leave: LeaveItem): void {
    if (leave.status !== 'Pending') {
      console.warn('Only pending leaves can be deleted');
      return;
    }

    this.selectedLeave = leave;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.selectedLeave = null;
  }

  confirmDelete(): void {
    if (!this.selectedLeave) return;

    this.isDeleting = true;

    this.leaveService.deleteLeave(this.selectedLeave.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.ok) {
            this.closeDeleteModal();
            this.loadLeaves();
            this.loadLeaveStats();
            console.log('Leave request deleted successfully');
          }
          this.isDeleting = false;
        },
        error: (error: Error) => {
          console.error('Error deleting leave:', error);
          this.isDeleting = false;
        }
      });
  }

  // ==================== PAGINATION ====================

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

  // ==================== HELPER METHODS ====================

  resetForm(): void {
    this.leaveForm = {
      title: '',
      body: '',
      startDate: '',
      endDate: '',
      type: 'Vacation'
    };
    this.formErrors = {};
  }

  formatDate(dateString: string): string {
    return this.leaveService.formatDate(dateString);
  }

  formatDateForInput(dateString: string): string {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
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

  canEdit(leave: LeaveItem): boolean {
    return leave.status === 'Pending';
  }

  canDelete(leave: LeaveItem): boolean {
    return leave.status === 'Pending';
  }

  trackByLeaveId(index: number, leave: LeaveItem): string {
    return leave.id;
  }
}