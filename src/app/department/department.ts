// src/app/department/department.component.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, catchError, of } from 'rxjs';
import { Router } from '@angular/router';

export interface Department {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
  members?: any[];
}

interface ApiResponse<T> {
  ok: boolean;
  data: T;
  error: any;
}

interface DepartmentListResponse {
  page: number;
  count: number;
  totalPages: number;
  totalItems: number;
  pageData: Department[];
}

@Component({
  selector: 'app-department',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './department.html',
  styleUrl: './department.scss',
})
export class Department implements OnInit, OnDestroy {
  private apiUrl = 'https://pixels-office-server.azurewebsites.net/v1';
  private destroy$ = new Subject<void>();

  // Department Data
  departments: Department[] = [];
  totalDepartments = 0;
  bestPerformingDepartment = 'Admin';
  
  // Loading States
  isLoading = false;
  isSubmitting = false;
  
  // Form Data
  departmentForm = {
    name: '',
    description: ''
  };
  
  // Edit Mode
  isEditMode = false;
  editingDepartmentId: string | null = null;
  
  // Delete Confirmation
  deletingDepartmentId: string | null = null;
  departmentToDelete: Department | null = null;
  
  // Error Handling
  errorMessage = '';
  successMessage = '';

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadDepartments();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  // ============= LOAD DEPARTMENTS =============
  
  loadDepartments(): void {
    this.isLoading = true;
    this.errorMessage = '';
    
    this.http.get<ApiResponse<DepartmentListResponse>>(
      `${this.apiUrl}/department?order=desc`,
      { headers: this.getHeaders() }
    ).pipe(
      takeUntil(this.destroy$),
      catchError(err => {
        console.error('Error loading departments:', err);
        this.errorMessage = 'Failed to load departments';
        this.isLoading = false;
        if (err.status === 401) {
          this.logout();
        }
        return of({ ok: false, data: null, error: err });
      })
    ).subscribe({
      next: (response) => {
        if (response.ok && response.data) {
          this.departments = response.data.pageData;
          this.totalDepartments = response.data.totalItems;
          console.log('Departments loaded:', this.departments);
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Subscription error:', err);
        this.isLoading = false;
      }
    });
  }

  // ============= CREATE DEPARTMENT =============
  
  createDepartment(): void {
    if (!this.departmentForm.name.trim()) {
      this.errorMessage = 'Department name is required';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    const payload = {
      name: this.departmentForm.name.trim(),
      description: this.departmentForm.description.trim() || null
    };

    console.log('Creating department:', payload);

    this.http.post<ApiResponse<Department>>(
      `${this.apiUrl}/department`,
      payload,
      { headers: this.getHeaders() }
    ).pipe(
      takeUntil(this.destroy$),
      catchError(err => {
        console.error('Error creating department:', err);
        this.errorMessage = err.error?.message || 'Failed to create department';
        this.isSubmitting = false;
        return of({ ok: false, data: null, error: err });
      })
    ).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        
        if (response.ok && response.data) {
          this.successMessage = 'Department created successfully!';
          console.log('Department created:', response.data);
          
          // Reset form
          this.resetForm();
          
          // Reload departments
          this.loadDepartments();
          
          // Close modal
          this.closeModal();
          
          // Clear success message after 3 seconds
          setTimeout(() => {
            this.successMessage = '';
          }, 3000);
        }
      },
      error: (err) => {
        console.error('Subscription error:', err);
        this.isSubmitting = false;
      }
    });
  }

  // ============= UPDATE DEPARTMENT =============
  
  updateDepartment(): void {
    if (!this.editingDepartmentId || !this.departmentForm.name.trim()) {
      this.errorMessage = 'Department name is required';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    const payload = {
      name: this.departmentForm.name.trim(),
      description: this.departmentForm.description.trim() || null
    };

    console.log('Updating department:', this.editingDepartmentId, payload);

    this.http.patch<ApiResponse<Department>>(
      `${this.apiUrl}/department/${this.editingDepartmentId}`,
      payload,
      { headers: this.getHeaders() }
    ).pipe(
      takeUntil(this.destroy$),
      catchError(err => {
        console.error('Error updating department:', err);
        this.errorMessage = err.error?.message || 'Failed to update department';
        this.isSubmitting = false;
        return of({ ok: false, data: null, error: err });
      })
    ).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        
        if (response.ok && response.data) {
          this.successMessage = 'Department updated successfully!';
          console.log('Department updated:', response.data);
          
          // Reset form and edit mode
          this.resetForm();
          
          // Reload departments
          this.loadDepartments();
          
          // Close modal
          this.closeModal();
          
          // Clear success message after 3 seconds
          setTimeout(() => {
            this.successMessage = '';
          }, 3000);
        }
      },
      error: (err) => {
        console.error('Subscription error:', err);
        this.isSubmitting = false;
      }
    });
  }

  // ============= DELETE DEPARTMENT =============
  
  confirmDelete(department: Department): void {
    this.departmentToDelete = department;
    this.deletingDepartmentId = department.id;
  }

  deleteDepartment(): void {
    if (!this.deletingDepartmentId) return;

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    console.log('Deleting department:', this.deletingDepartmentId);

    this.http.delete<ApiResponse<{ count: number }>>(
      `${this.apiUrl}/department`,
      {
        headers: this.getHeaders(),
        body: { departmentsId: [this.deletingDepartmentId] }
      }
    ).pipe(
      takeUntil(this.destroy$),
      catchError(err => {
        console.error('Error deleting department:', err);
        this.errorMessage = err.error?.message || 'Failed to delete department';
        this.isSubmitting = false;
        return of({ ok: false, data: null, error: err });
      })
    ).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        
        if (response.ok) {
          this.successMessage = 'Department deleted successfully!';
          console.log('Department deleted');
          
          // Reset delete state
          this.deletingDepartmentId = null;
          this.departmentToDelete = null;
          
          // Reload departments
          this.loadDepartments();
          
          // Close delete confirmation modal
          this.closeDeleteModal();
          
          // Clear success message after 3 seconds
          setTimeout(() => {
            this.successMessage = '';
          }, 3000);
        }
      },
      error: (err) => {
        console.error('Subscription error:', err);
        this.isSubmitting = false;
      }
    });
  }

  cancelDelete(): void {
    this.deletingDepartmentId = null;
    this.departmentToDelete = null;
    this.closeDeleteModal();
  }

  // ============= EDIT MODE =============
  
  editDepartment(department: Department): void {
    this.isEditMode = true;
    this.editingDepartmentId = department.id;
    this.departmentForm.name = department.name;
    this.departmentForm.description = department.description || '';
    
    // Open modal (handled by Bootstrap data attributes in HTML)
  }

  // ============= FORM HANDLERS =============
  
  onSubmit(): void {
    if (this.isEditMode) {
      this.updateDepartment();
    } else {
      this.createDepartment();
    }
  }

  resetForm(): void {
    this.departmentForm = {
      name: '',
      description: ''
    };
    this.isEditMode = false;
    this.editingDepartmentId = null;
    this.errorMessage = '';
  }

  openCreateModal(): void {
    this.resetForm();
    // Modal will be opened by Bootstrap data attributes
  }

  closeModal(): void {
    // Close modal using Bootstrap
    const modalElement = document.getElementById('kt_modal_new_target');
    if (modalElement) {
      const modal = (window as any).bootstrap.Modal.getInstance(modalElement);
      if (modal) {
        modal.hide();
      }
    }
    this.resetForm();
  }

  closeDeleteModal(): void {
    const modalElement = document.getElementById('kt_modal_delete_department');
    if (modalElement) {
      const modal = (window as any).bootstrap.Modal.getInstance(modalElement);
      if (modal) {
        modal.hide();
      }
    }
  }

  // ============= UTILITY METHODS =============
  
  getDepartmentInitials(name: string): string {
    const words = name.split(' ');
    if (words.length >= 2) {
      return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  getRandomColor(index: number): string {
    const colors = ['primary', 'success', 'info', 'warning', 'danger'];
    return colors[index % colors.length];
  }

  isBestPerforming(departmentName: string): boolean {
    return departmentName === this.bestPerformingDepartment;
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  trackByDepartmentId(index: number, department: Department): string {
    return department.id;
  }

  logout(): void {
    localStorage.clear();
    sessionStorage.clear();
    this.router.navigate(['/signin']);
  }
}