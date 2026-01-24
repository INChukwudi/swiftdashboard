import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterModule, RouterLinkActive } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { AuthService } from '../services/auth.service';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  email: string;
  phoneNumber: string;
  employeeId: string;
  avatarUrl: string | null;
  department: string | null;
  job: string | null;
  deactivated: boolean;
}

interface Project {
  id: string;
  title: string;
  description: string;
  status: string;
  startDate: string;
  dueDate: string;
  isHighPriority: boolean;
  archived: boolean;
  lead: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    email: string;
    phoneNumber: string;
    employeeId: string;
    department: string | null;
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

interface ApiResponse<T> {
  ok: boolean;
  data: T;
  error: any;
}

interface PaginatedResponse<T> {
  page: number;
  count: number;
  totalPages: number;
  totalItems: number;
  pageData: T[];
}

@Component({
  selector: 'app-adminproject',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLink, RouterLinkActive, FormsModule],
  templateUrl: './adminproject.html',
  styleUrl: './adminproject.scss',
})
export class Adminproject implements OnInit, OnDestroy {
  isAdmin = false;

  private apiUrl = 'https://pixels-office-server.azurewebsites.net/v1';
  private destroy$ = new Subject<void>();

  projects: Project[] = [];
  employees: Employee[] = [];
  loading = true;
  error: string | null = null;

  // Statistics
  totalProjects = 0;
  completedProjects = 0;
  overdueProjects = 0;
  inProgressProjects = 0;

  // Create Project Modal
  showCreateModal = false;
  submitting = false;
  newProject = {
    title: '',
    description: '',
    leadId: '',
    startDate: '',
    dueDate: '',
    isHighPriority: false
  };
  formErrors: { [key: string]: string } = {};

  // Employee dropdown
  showEmployeeDropdown = false;
  employeeSearchTerm = '';
  selectedEmployee: Employee | null = null;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Dynamically set isAdmin based on logged-in user
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe(user => {
      this.isAdmin = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'superadmin';
    });

    this.loadAllData();
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

  loadAllData(): void {
    this.loading = true;
    this.error = null;

    forkJoin({
      projects: this.http.get<ApiResponse<PaginatedResponse<Project>>>(`${this.apiUrl}/project`, { headers: this.getHeaders() }),
      employees: this.http.get<ApiResponse<PaginatedResponse<Employee>>>(`${this.apiUrl}/employee`, { headers: this.getHeaders() })
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (responses) => {
        // Handle projects
        if (responses.projects.ok && responses.projects.data) {
          this.projects = responses.projects.data.pageData || [];
          this.calculateStatistics();
        }

        // Handle employees - sort alphabetically and filter active only
        if (responses.employees.ok && responses.employees.data) {
          this.employees = (responses.employees.data.pageData || [])
            .filter(e => !e.deactivated)
            .sort((a, b) => {
              const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
              const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
              return nameA.localeCompare(nameB);
            });
        }

        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading data:', err);
        this.error = 'Failed to load data. Please try again.';
        this.loading = false;
      }
    });
  }

  loadProjects(): void {
    this.loading = true;
    this.error = null;

    this.http.get<ApiResponse<PaginatedResponse<Project>>>(`${this.apiUrl}/project`, { headers: this.getHeaders() })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('Projects response:', response);
          if (response.ok && response.data) {
            this.projects = response.data.pageData || [];
            this.calculateStatistics();
          }
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading projects:', err);
          this.error = 'Failed to load projects. Please try again.';
          this.loading = false;
        }
      });
  }

  calculateStatistics(): void {
    this.totalProjects = this.projects.length;
    this.completedProjects = this.projects.filter(p => p.status === 'Completed').length;

    // Count overdue: any project with overdue tasks OR past due date
    this.overdueProjects = this.projects.filter(p => {
      const hasOverdueTasks = p.taskStats?.stats?.Overdue > 0;
      const isPastDue = new Date(p.dueDate) < new Date() && p.status !== 'Completed';
      return hasOverdueTasks || isPastDue;
    }).length;

    this.inProgressProjects = this.projects.filter(p => p.status === 'InProgress').length;

    console.log('Statistics:', {
      total: this.totalProjects,
      completed: this.completedProjects,
      overdue: this.overdueProjects,
      inProgress: this.inProgressProjects
    });
  }

  // ============================================
  // CREATE PROJECT MODAL
  // ============================================

  openCreateModal(): void {
    this.resetCreateForm();
    this.showCreateModal = true;
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
    this.resetCreateForm();
  }

  resetCreateForm(): void {
    this.newProject = {
      title: '',
      description: '',
      leadId: '',
      startDate: new Date().toISOString().split('T')[0],
      dueDate: '',
      isHighPriority: false
    };
    this.selectedEmployee = null;
    this.employeeSearchTerm = '';
    this.showEmployeeDropdown = false;
    this.formErrors = {};
  }

  validateCreateForm(): boolean {
    this.formErrors = {};

    if (!this.newProject.title.trim()) {
      this.formErrors['title'] = 'Project title is required';
    }

    if (!this.newProject.leadId) {
      this.formErrors['leadId'] = 'Please select a project lead';
    }

    if (!this.newProject.startDate) {
      this.formErrors['startDate'] = 'Start date is required';
    }

    if (!this.newProject.dueDate) {
      this.formErrors['dueDate'] = 'Due date is required';
    }

    if (this.newProject.startDate && this.newProject.dueDate) {
      if (new Date(this.newProject.dueDate) < new Date(this.newProject.startDate)) {
        this.formErrors['dueDate'] = 'Due date must be after start date';
      }
    }

    return Object.keys(this.formErrors).length === 0;
  }

  submitCreateProject(): void {
    if (!this.validateCreateForm()) {
      return;
    }

    this.submitting = true;

    const payload = {
      title: this.newProject.title.trim(),
      description: this.newProject.description?.trim() || '',
      leadId: this.newProject.leadId,
      startDate: new Date(this.newProject.startDate).toISOString(),
      dueDate: new Date(this.newProject.dueDate).toISOString(),
      isHighPriority: this.newProject.isHighPriority
    };

    this.http.post<ApiResponse<Project>>(
      `${this.apiUrl}/project`,
      payload,
      { headers: this.getHeaders() }
    ).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        this.submitting = false;
        if (response.ok && response.data) {
          // Reload projects to get updated list
          this.loadProjects();
          this.closeCreateModal();
          this.showToast('Project created successfully', 'success');
        } else {
          this.formErrors['submit'] = response.error?.message || 'Failed to create project';
        }
      },
      error: (err) => {
        this.submitting = false;
        console.error('Error creating project:', err);
        this.formErrors['submit'] = err.error?.error?.message || 'Failed to create project. Please try again.';
      }
    });
  }

  // ============================================
  // EMPLOYEE DROPDOWN
  // ============================================

  toggleEmployeeDropdown(): void {
    this.showEmployeeDropdown = !this.showEmployeeDropdown;
    if (this.showEmployeeDropdown) {
      this.employeeSearchTerm = '';
    }
  }

  closeEmployeeDropdown(): void {
    // Small delay to allow click events to register
    setTimeout(() => {
      this.showEmployeeDropdown = false;
    }, 200);
  }

  get filteredEmployees(): Employee[] {
    if (!this.employeeSearchTerm.trim()) {
      return this.employees;
    }

    const term = this.employeeSearchTerm.toLowerCase().trim();
    return this.employees.filter(emp =>
      emp.firstName.toLowerCase().includes(term) ||
      emp.lastName.toLowerCase().includes(term) ||
      emp.email?.toLowerCase().includes(term) ||
      emp.job?.toLowerCase().includes(term) ||
      emp.department?.toLowerCase().includes(term)
    );
  }

  selectEmployee(employee: Employee): void {
    this.selectedEmployee = employee;
    this.newProject.leadId = employee.id;
    this.showEmployeeDropdown = false;
    this.employeeSearchTerm = '';

    // Clear any previous error
    if (this.formErrors['leadId']) {
      delete this.formErrors['leadId'];
    }
  }

  clearSelectedEmployee(): void {
    this.selectedEmployee = null;
    this.newProject.leadId = '';
  }

  getEmployeeFullName(emp: Employee): string {
    return `${emp.firstName} ${emp.lastName}`;
  }

  getEmployeeInitials(emp: Employee): string {
    return `${emp.firstName[0]}${emp.lastName[0]}`.toUpperCase();
  }

  getEmployeeAvatarUrl(emp: Employee): string {
    return emp.avatarUrl || 'assets/media/avatars/300-1.jpg';
  }

  // ============================================
  // PROJECT DISPLAY HELPERS
  // ============================================

  // Get project initials for avatar
  getProjectInitials(title: string): string {
    return title
      .split(' ')
      .map(word => word[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  }

  // Get lead full name
  getLeadName(project: Project): string {
    return `${project.lead.firstName} ${project.lead.lastName}`;
  }

  // Get lead initials
  getLeadInitials(project: Project): string {
    return `${project.lead.firstName[0]}${project.lead.lastName[0]}`.toUpperCase();
  }

  // Format date
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }

  // Get status badge class
  getStatusBadgeClass(dueDate: string, status: string): string {
    if (status === 'Completed') {
      return 'badge-light-success';
    }

    const due = new Date(dueDate);
    const now = new Date();
    const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilDue < 0) {
      return 'badge-light-danger'; // Overdue
    } else if (daysUntilDue <= 7) {
      return 'badge-light-warning'; // Due soon
    } else {
      return 'badge-light-success'; // On track
    }
  }

  // Calculate completion rate
  getCompletionRate(project: Project): number {
    if (!project.taskStats || project.taskStats.total === 0) return 0;
    return Math.round((project.taskStats.stats.Completed / project.taskStats.total) * 100);
  }

  // Get completion badge class
  getCompletionBadgeClass(rate: number): string {
    if (rate >= 90) return 'badge-light-success';
    if (rate >= 70) return 'badge-light-warning';
    return 'badge-light-danger';
  }

  // Get progress bar class
  getProgressBarClass(rate: number): string {
    if (rate >= 90) return 'bg-success';
    if (rate >= 70) return 'bg-warning';
    return 'bg-danger';
  }

  // Refresh projects
  refreshProjects(): void {
    this.loadAllData();
  }

  // Toast notification
  showToast(message: string, type: 'success' | 'error'): void {
    if (typeof (window as any).toastr !== 'undefined') {
      if (type === 'success') {
        (window as any).toastr.success(message);
      } else {
        (window as any).toastr.error(message);
      }
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }
}