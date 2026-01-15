// src/app/adminviewproject/adminviewproject.component.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, catchError, of, forkJoin } from 'rxjs';

interface Project {
  id: string;
  title: string;
  description: string;
  status: string;
  startDate: string;
  dueDate: string;
  lead: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    email: string;
    job: string | null;
  };
  taskStats: {
    total: number;
    stats: {
      InProgress: number;
      Blocked: number;
      Completed: number;
      UnderReview: number;
      NotStarted: number;
      Overdue: number;
    };
  };
  collaborators: any[];
  createdAt: string;
  updatedAt: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  startDate: string;
  dueDate: string;
  createdAt: string;
  assignedBy: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
  collaborators: any[];
}

@Component({
  selector: 'app-viewproject',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './viewproject.html',
  styleUrl: './viewproject.scss',
})
export class Viewproject implements OnInit, OnDestroy {
  private apiUrl = 'https://pixels-office-server.azurewebsites.net/v1';
  private destroy$ = new Subject<void>();

  // For template use
  Math = Math;

  projectId: string = '';
  project: Project | null = null;
  collaborators: any[] = [];
  attachments: any[] = [];
  employees: any[] = [];
  tasks: Task[] = [];

  // Pagination
  currentPage = 1;
  totalPages = 1;
  totalTasks = 0;
  pageSize = 10;

  isLoading = true;
  isSubmitting = false;

  errorMessage = '';
  successMessage = '';

  selectedEmployeeIds: string[] = [];
  filteredEmployees: any[] = [];

  // For delete confirmations
  collaboratorToDelete: any = null;
  attachmentToDelete: any = null;

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.projectId = params['projectId'];
      console.log('📍 Project ID:', this.projectId);
      
      if (this.projectId) {
        this.loadProjectData();
      } else {
        console.error('❌ No project ID');
        this.isLoading = false;
      }
    });
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

  loadProjectData(): void {
    this.isLoading = true;
    this.errorMessage = '';
    
    console.log('🔄 Loading data for project:', this.projectId);

    forkJoin({
      project: this.http.get<any>(`${this.apiUrl}/project/${this.projectId}`, { headers: this.getHeaders() })
        .pipe(catchError(err => {
          console.error('❌ Project error:', err);
          return of({ ok: false, data: null, error: err });
        })),
      collaborators: this.http.get<any>(`${this.apiUrl}/project/${this.projectId}/collaborator`, { headers: this.getHeaders() })
        .pipe(catchError(() => of({ ok: false, data: { pageData: [] } }))),
      attachments: this.http.get<any>(`${this.apiUrl}/project/${this.projectId}/attachment`, { headers: this.getHeaders() })
        .pipe(catchError(() => of({ ok: false, data: { pageData: [] } }))),
      employees: this.http.get<any>(`${this.apiUrl}/employee`, { headers: this.getHeaders() })
        .pipe(catchError(() => of({ ok: false, data: { pageData: [] } })))
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (results) => {
        console.log('📦 API Results:', results);
        
        if (results.project.ok && results.project.data) {
          this.project = results.project.data;
          console.log('✅ Project loaded:', this.project?.title || 'No title');
        } else {
          console.error('❌ Project failed');
          this.errorMessage = 'Failed to load project';
          this.isLoading = false;
          return;
        }
        
        if (results.collaborators.ok && results.collaborators.data?.pageData) {
          this.collaborators = results.collaborators.data.pageData;
          console.log('✅ Collaborators:', this.collaborators.length);
        }
        
        if (results.attachments.ok && results.attachments.data?.pageData) {
          this.attachments = results.attachments.data.pageData;
          console.log('✅ Attachments:', this.attachments.length);
        }
        
        if (results.employees.ok && results.employees.data?.pageData) {
          this.employees = results.employees.data.pageData;
          this.filteredEmployees = this.employees;
          console.log('✅ Employees:', this.employees.length);
        }
        
        this.isLoading = false;
        
        // Load tasks after basic data is loaded
        this.loadTasks();
      },
      error: (err) => {
        console.error('💥 Fatal error:', err);
        this.errorMessage = 'Error loading data';
        this.isLoading = false;
      }
    });
  }

  loadTasks(page: number = 1): void {
    console.log('📋 Loading tasks page:', page);
    
    this.http.get<any>(
      `${this.apiUrl}/project/${this.projectId}/task?order=desc&page=${page}&pageSize=${this.pageSize}`,
      { headers: this.getHeaders() }
    ).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response.ok && response.data) {
          this.tasks = response.data.pageData || [];
          this.currentPage = response.data.page || 1;
          this.totalPages = response.data.totalPages || 1;
          this.totalTasks = response.data.totalItems || 0;
          console.log('✅ Tasks loaded:', this.tasks.length, 'Total:', this.totalTasks);
        }
      },
      error: (err) => {
        console.error('⚠️ Tasks error:', err);
      }
    });
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.loadTasks(page);
  }

  addCollaborators(employeeIds: string[]): void {
    if (!employeeIds || employeeIds.length === 0) return;
    
    console.log('➕ Adding collaborators:', employeeIds);
    this.isSubmitting = true;
    
    // ✅ FIXED: Use collaboratorsId instead of employeeIds
    this.http.post<any>(
      `${this.apiUrl}/project/${this.projectId}/collaborator`, 
      { collaboratorsId: employeeIds }, 
      { headers: this.getHeaders() }
    ).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        console.log('✅ Response:', response);
        if (response.ok) {
          this.successMessage = 'Members added successfully!';
          
          // ✅ FIXED: Only reload collaborators, not everything
          this.reloadCollaborators();
          setTimeout(() => this.successMessage = '', 3000);
        }
        this.isSubmitting = false;
      },
      error: (err) => {
        console.error('❌ Error:', err);
        this.errorMessage = 'Failed to add members';
        this.isSubmitting = false;
        setTimeout(() => this.errorMessage = '', 3000);
      }
    });
  }

  confirmRemoveCollaborator(collaborator: any): void {
    this.collaboratorToDelete = collaborator;
  }

  removeCollaborator(): void {
    if (!this.collaboratorToDelete) return;
    
    console.log('🗑️ Removing collaborator:', this.collaboratorToDelete.id);
    
    // ✅ FIXED: Use collaboratorsId instead of employeeIds
    this.http.request<any>(
      'delete',
      `${this.apiUrl}/project/${this.projectId}/collaborator`,
      { 
        headers: this.getHeaders(), 
        body: { collaboratorsId: [this.collaboratorToDelete.id] }
      }
    ).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response.ok) {
          this.successMessage = 'Member removed successfully!';
          
          // ✅ FIXED: Only update collaborators array, no full reload
          this.collaborators = this.collaborators.filter(c => c.id !== this.collaboratorToDelete.id);
          
          setTimeout(() => this.successMessage = '', 3000);
          this.closeModal('kt_modal_confirm_remove_collaborator');
        }
        this.collaboratorToDelete = null;
      },
      error: () => {
        this.errorMessage = 'Failed to remove member';
        setTimeout(() => this.errorMessage = '', 3000);
        this.collaboratorToDelete = null;
      }
    });
  }

  reloadCollaborators(): void {
    this.http.get<any>(
      `${this.apiUrl}/project/${this.projectId}/collaborator`,
      { headers: this.getHeaders() }
    ).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response.ok && response.data?.pageData) {
          this.collaborators = response.data.pageData;
        }
      }
    });
  }

  uploadAttachment(file: File): void {
    if (!file) return;
    
    console.log('📎 Uploading file:', file.name, file.type);
    
    const formData = new FormData();
    formData.append('files', file);
    
    const token = localStorage.getItem('access_token');
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });
    
    this.isSubmitting = true;
    this.http.post<any>(
      `${this.apiUrl}/project/${this.projectId}/attachment`, 
      formData, 
      { headers }
    ).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response.ok) {
          this.successMessage = 'File uploaded successfully!';
          
          // ✅ FIXED: Only reload attachments, not everything
          this.reloadAttachments();
          setTimeout(() => this.successMessage = '', 3000);
        }
        this.isSubmitting = false;
      },
      error: () => {
        this.errorMessage = 'Upload failed';
        this.isSubmitting = false;
        setTimeout(() => this.errorMessage = '', 3000);
      }
    });
  }

  confirmDeleteAttachment(attachment: any): void {
    this.attachmentToDelete = attachment;
  }

  deleteAttachment(): void {
    if (!this.attachmentToDelete) return;
    
    console.log('🗑️ Deleting attachment:', this.attachmentToDelete.id);
    
    // ✅ FIXED: Use attachmentsId instead of attachmentIds
    this.http.request<any>(
      'delete',
      `${this.apiUrl}/project/${this.projectId}/attachment`,
      { 
        headers: this.getHeaders(), 
        body: { attachmentsId: [this.attachmentToDelete.id] }
      }
    ).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response.ok) {
          this.successMessage = 'File deleted successfully!';
          
          // ✅ FIXED: Only update attachments array, no full reload
          this.attachments = this.attachments.filter(a => a.id !== this.attachmentToDelete.id);
          
          setTimeout(() => this.successMessage = '', 3000);
          this.closeModal('kt_modal_confirm_delete_attachment');
        }
        this.attachmentToDelete = null;
      },
      error: () => {
        this.errorMessage = 'Delete failed';
        setTimeout(() => this.errorMessage = '', 3000);
        this.attachmentToDelete = null;
      }
    });
  }

  reloadAttachments(): void {
    this.http.get<any>(
      `${this.apiUrl}/project/${this.projectId}/attachment`,
      { headers: this.getHeaders() }
    ).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response.ok && response.data?.pageData) {
          this.attachments = response.data.pageData;
        }
      }
    });
  }

  archiveProject(): void {
    if (!confirm('Archive this project?')) return;
    
    this.isSubmitting = true;
    this.http.post<any>(
      `${this.apiUrl}/project/${this.projectId}/archive`, 
      {}, 
      { headers: this.getHeaders() }
    ).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response.ok) {
          this.successMessage = 'Project archived!';
          setTimeout(() => this.router.navigate(['/adminproject']), 2000);
        }
        this.isSubmitting = false;
      },
      error: () => {
        this.errorMessage = 'Archive failed';
        this.isSubmitting = false;
        setTimeout(() => this.errorMessage = '', 3000);
      }
    });
  }

  getTaskAssignedByName(task: Task): string {
    if (!task.assignedBy) return 'N/A';
    return `${task.assignedBy.firstName} ${task.assignedBy.lastName}`;
  }

  getTaskAssignedByInitials(task: Task): string {
    if (!task.assignedBy) return 'NA';
    const first = task.assignedBy.firstName?.[0] || '';
    const last = task.assignedBy.lastName?.[0] || '';
    return `${first}${last}`.toUpperCase() || 'NA';
  }

  getTaskStatusBadgeClass(status: string): string {
    const s = status?.toLowerCase();
    if (s === 'completed') return 'badge-light-success';
    if (s === 'inprogress') return 'badge-light-primary';
    if (s === 'blocked') return 'badge-light-danger';
    if (s === 'underreview') return 'badge-light-warning';
    return 'badge-light-secondary';
  }

  getTaskProgress(task: Task): number {
    if (task.status?.toLowerCase() === 'completed') return 100;
    if (task.status?.toLowerCase() === 'inprogress') return 50;
    return 0;
  }

  getProjectInitials(title: string): string {
    if (!title) return 'NA';
    return title.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  }

  getLeadName(): string {
    if (!this.project?.lead) return 'N/A';
    return `${this.project.lead.firstName} ${this.project.lead.lastName}`;
  }

  getLeadInitials(): string {
    if (!this.project?.lead) return 'NA';
    const first = this.project.lead.firstName?.[0] || '';
    const last = this.project.lead.lastName?.[0] || '';
    return `${first}${last}`.toUpperCase() || 'NA';
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return 'Invalid date';
    }
  }

  formatFileSize(bytes: number): string {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  getFileIcon(mimeType: string): string {
    if (!mimeType) return 'assets/files/blank-image.svg';
    
    // PDF files
    if (mimeType.includes('pdf')) return 'assets/files/pdf.svg';
    
    // Word documents
    if (mimeType.includes('word') || 
        mimeType.includes('msword') || 
        mimeType.includes('document')) {
      return 'assets/files/doc.svg';
    }
    
    // Excel/spreadsheets
    if (mimeType.includes('excel') || 
        mimeType.includes('spreadsheet') || 
        mimeType.includes('sheet')) {
      return 'assets/files/xls.svg';
    }
    
    // XML files
    if (mimeType.includes('xml')) return 'assets/files/xml.svg';
    
    // Image files
    if (mimeType.includes('image')) return 'assets/files/blank-image.svg';
    
    // Default
    return 'assets/files/blank-image.svg';
  }

  getCompletionRate(): number {
    if (!this.project?.taskStats || this.project.taskStats.total === 0) return 0;
    const stats = this.project.taskStats;
    return Math.round((stats.stats.Completed / stats.total) * 100);
  }

  getStatusBadgeClass(): string {
    const status = this.project?.status?.toLowerCase();
    if (status === 'completed') return 'badge-light-success';
    if (status === 'inprogress') return 'badge-light-primary';
    if (status === 'blocked') return 'badge-light-danger';
    return 'badge-light-warning';
  }

  goBack(): void {
    this.router.navigate(['/adminproject']);
  }

  filterEmployees(searchTerm: string): void {
    if (!searchTerm || !searchTerm.trim()) {
      this.filteredEmployees = this.employees;
      return;
    }
    const term = searchTerm.toLowerCase();
    this.filteredEmployees = this.employees.filter(emp => 
      emp.firstName?.toLowerCase().includes(term) || 
      emp.lastName?.toLowerCase().includes(term) ||
      emp.email?.toLowerCase().includes(term)
    );
  }

  toggleEmployeeSelection(employeeId: string): void {
    const index = this.selectedEmployeeIds.indexOf(employeeId);
    if (index > -1) {
      this.selectedEmployeeIds.splice(index, 1);
    } else {
      this.selectedEmployeeIds.push(employeeId);
    }
  }

  addSelectedCollaborators(): void {
    if (this.selectedEmployeeIds.length === 0) {
      this.errorMessage = 'Select at least one member';
      setTimeout(() => this.errorMessage = '', 3000);
      return;
    }
    
    console.log('🚀 Adding:', this.selectedEmployeeIds);
    this.addCollaborators([...this.selectedEmployeeIds]);
    this.selectedEmployeeIds = [];
    
    this.closeModal('kt_modal_add_collaborators');
  }

  closeModal(modalId: string): void {
    setTimeout(() => {
      const modalEl = document.getElementById(modalId);
      if (modalEl) {
        const backdrop = document.querySelector('.modal-backdrop');
        modalEl.classList.remove('show');
        modalEl.style.display = 'none';
        if (backdrop) backdrop.remove();
        document.body.classList.remove('modal-open');
        document.body.style.removeProperty('overflow');
        document.body.style.removeProperty('padding-right');
      }
    }, 100);
  }

  onFileSelected(event: any): void {
    const files = event.target.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        this.uploadAttachment(files[i]);
      }
      event.target.value = '';
    }
  }

  getPaginationNumbers(): number[] {
    const pages: number[] = [];
    const maxVisible = 7;
    
    if (this.totalPages <= maxVisible) {
      for (let i = 1; i <= this.totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (this.currentPage <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push(-1); // Ellipsis
        pages.push(this.totalPages);
      } else if (this.currentPage >= this.totalPages - 3) {
        pages.push(1);
        pages.push(-1); // Ellipsis
        for (let i = this.totalPages - 4; i <= this.totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push(-1); // Ellipsis
        for (let i = this.currentPage - 1; i <= this.currentPage + 1; i++) pages.push(i);
        pages.push(-1); // Ellipsis
        pages.push(this.totalPages);
      }
    }
    
    return pages;
  }
}