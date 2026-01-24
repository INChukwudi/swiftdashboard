import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import { RouterLink, RouterModule, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface Employee {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  employeeId: string;
  email: string;
  phoneNumber: string;
  department: string | null;
  job: string | null;
  avatarUrl: string | null;
  deactivated: boolean;
  location: string | null;
  joinedAt: string | null;
  birthday: string | null;
  skills: string[];
  role: string;
}

interface Job {
  id: string;
  name: string;
  description: string | null;
  department: string;
}

interface Department {
  id: string;
  name: string;
  description: string;
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
  selector: 'app-all-employees',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLink, RouterLinkActive, HttpClientModule, FormsModule],
  templateUrl: './all-employees.html',
  styleUrl: './all-employees.scss',
})
export class AllEmployees implements OnInit, OnDestroy {
  private apiUrl = 'https://pixels-office-server.azurewebsites.net/v1';
  private destroy$ = new Subject<void>();

  // Data
  employees: Employee[] = [];
  filteredEmployees: Employee[] = [];
  jobs: Job[] = [];
  departments: Department[] = [];

  // Stats
  totalEmployees = 0;
  activeEmployees = 0;
  deactivatedEmployees = 0;
  totalDepartments = 0;

  // Loading states
  loading = true;
  submitting = false;
  error: string | null = null;

  // Search & Filter
  searchTerm = '';
  selectedDepartment = '';

  // Add Employee Form
  newEmployee = {
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    location: 'Abuja',
    jobId: '',
    joinedAt: '',
    birthday: '',
    password: '',
    confirmPassword: '',
    employeeId: ''
  };

  // Edit Employee Form
  editingEmployee: Employee | null = null;
  editForm = {
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    location: '',
    jobId: '',
    joinedAt: '',
    birthday: ''
  };

  // Modal states
  showAddModal = false;
  showEditModal = false;
  showAccountSetupModal = false;
  createdEmployeeData: any = null;
  activationLink = '';

  // Password visibility
  showPassword = false;
  showConfirmPassword = false;

  // Form validation errors
  formErrors: { [key: string]: string } = {};

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadAllData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============================================
  // DATA LOADING
  // ============================================

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

    const token = localStorage.getItem('access_token');
    if (!token) {
      this.error = 'You are not logged in.';
      this.loading = false;
      return;
    }

    // Load employees, jobs, and departments in parallel
    Promise.all([
      this.loadEmployeesAsync(),
      this.loadJobsAsync(),
      this.loadDepartmentsAsync()
    ]).then(() => {
      this.loading = false;
    }).catch(err => {
      console.error('Error loading data:', err);
      this.error = 'Failed to load data. Please try again.';
      this.loading = false;
    });
  }

  private loadEmployeesAsync(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.http.get<ApiResponse<PaginatedResponse<Employee>>>(
        `${this.apiUrl}/employee`,
        { headers: this.getHeaders() }
      ).pipe(takeUntil(this.destroy$)).subscribe({
        next: (response) => {
          if (response.ok && response.data?.pageData) {
            // Sort employees alphabetically by first name, then last name
            this.employees = response.data.pageData.sort((a, b) => {
              const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
              const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
              return nameA.localeCompare(nameB);
            });
            this.filteredEmployees = [...this.employees];
            this.calculateStats();
          }
          resolve();
        },
        error: (err) => {
          console.error('Error loading employees:', err);
          reject(err);
        }
      });
    });
  }

  private loadJobsAsync(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.http.get<ApiResponse<PaginatedResponse<Job>>>(
        `${this.apiUrl}/job`,
        { headers: this.getHeaders() }
      ).pipe(takeUntil(this.destroy$)).subscribe({
        next: (response) => {
          if (response.ok && response.data?.pageData) {
            this.jobs = response.data.pageData;
          }
          resolve();
        },
        error: (err) => {
          console.error('Error loading jobs:', err);
          resolve(); // Don't reject, jobs are optional
        }
      });
    });
  }

  private loadDepartmentsAsync(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.http.get<ApiResponse<PaginatedResponse<Department>>>(
        `${this.apiUrl}/department`,
        { headers: this.getHeaders() }
      ).pipe(takeUntil(this.destroy$)).subscribe({
        next: (response) => {
          if (response.ok && response.data?.pageData) {
            this.departments = response.data.pageData;
            this.totalDepartments = response.data.totalItems;
          } else if (response.ok && Array.isArray(response.data)) {
            this.departments = response.data;
            this.totalDepartments = response.data.length;
          }
          resolve();
        },
        error: (err) => {
          console.error('Error loading departments:', err);
          resolve(); // Don't reject, departments are optional
        }
      });
    });
  }

  loadEmployees(): void {
    this.loadEmployeesAsync().catch(err => {
      this.error = 'Failed to load employees. Please try again.';
    });
  }

  calculateStats(): void {
    this.totalEmployees = this.employees.length;
    this.activeEmployees = this.employees.filter(e => !e.deactivated).length;
    this.deactivatedEmployees = this.employees.filter(e => e.deactivated).length;
  }

  // ============================================
  // SEARCH & FILTER
  // ============================================

  onSearch(): void {
    this.applyFilters();
  }

  onDepartmentFilter(): void {
    this.applyFilters();
  }

  applyFilters(): void {
    let result = [...this.employees];

    // Apply search filter
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      result = result.filter(emp => 
        emp.firstName.toLowerCase().includes(term) ||
        emp.lastName.toLowerCase().includes(term) ||
        emp.email?.toLowerCase().includes(term) ||
        emp.employeeId?.toLowerCase().includes(term) ||
        emp.phoneNumber?.includes(term) ||
        emp.job?.toLowerCase().includes(term)
      );
    }

    // Apply department filter
    if (this.selectedDepartment) {
      result = result.filter(emp => emp.department === this.selectedDepartment);
    }

    // Sort alphabetically
    result.sort((a, b) => {
      const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
      const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });

    this.filteredEmployees = result;
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedDepartment = '';
    this.filteredEmployees = [...this.employees];
  }

  // ============================================
  // ADD EMPLOYEE
  // ============================================

  openAddModal(): void {
    this.resetAddForm();
    this.showAddModal = true;
    this.formErrors = {};
  }

  closeAddModal(): void {
    this.showAddModal = false;
    this.resetAddForm();
  }

  resetAddForm(): void {
    this.newEmployee = {
      firstName: '',
      middleName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      location: 'Abuja',
      jobId: '',
      joinedAt: new Date().toISOString().split('T')[0],
      birthday: '',
      password: '',
      confirmPassword: '',
      employeeId: ''
    };
    this.formErrors = {};
  }

  validateAddForm(): boolean {
    this.formErrors = {};

    if (!this.newEmployee.firstName.trim()) {
      this.formErrors['firstName'] = 'First name is required';
    }

    if (!this.newEmployee.lastName.trim()) {
      this.formErrors['lastName'] = 'Last name is required';
    }

    if (!this.newEmployee.email.trim()) {
      this.formErrors['email'] = 'Email is required';
    } else if (!this.isValidEmail(this.newEmployee.email)) {
      this.formErrors['email'] = 'Please enter a valid email';
    }

    if (!this.newEmployee.phoneNumber.trim()) {
      this.formErrors['phoneNumber'] = 'Phone number is required';
    }

    if (!this.newEmployee.jobId) {
      this.formErrors['jobId'] = 'Please select a job role';
    }

    if (!this.newEmployee.password) {
      this.formErrors['password'] = 'Password is required';
    } else if (this.newEmployee.password.length < 6) {
      this.formErrors['password'] = 'Password must be at least 6 characters';
    }

    if (this.newEmployee.password !== this.newEmployee.confirmPassword) {
      this.formErrors['confirmPassword'] = 'Passwords do not match';
    }

    return Object.keys(this.formErrors).length === 0;
  }

  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  submitAddEmployee(): void {
    if (!this.validateAddForm()) {
      return;
    }

    this.submitting = true;

    const payload = {
      firstName: this.newEmployee.firstName.trim(),
      middleName: this.newEmployee.middleName?.trim() || null,
      lastName: this.newEmployee.lastName.trim(),
      email: this.newEmployee.email.trim(),
      phoneNumber: this.newEmployee.phoneNumber.trim(),
      location: this.newEmployee.location || 'Abuja',
      jobId: this.newEmployee.jobId,
      joinedAt: this.newEmployee.joinedAt ? new Date(this.newEmployee.joinedAt).toISOString() : new Date().toISOString(),
      birthday: this.newEmployee.birthday ? new Date(this.newEmployee.birthday).toISOString() : null,
      password: this.newEmployee.password,
      employeeId: this.newEmployee.employeeId?.trim() || undefined
    };

    this.http.post<ApiResponse<any>>(
      `${this.apiUrl}/employee`,
      payload,
      { headers: this.getHeaders() }
    ).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        this.submitting = false;
        if (response.ok && response.data) {
          this.createdEmployeeData = response.data;
          this.activationLink = response.data.setPasswordUrl || `https://app.yourcompany.com/activate?id=${response.data.id}`;
          
          // Close add modal and show account setup modal
          this.showAddModal = false;
          this.showAccountSetupModal = true;
          
          // Reload employees list
          this.loadEmployees();
          this.resetAddForm();
        } else {
          this.formErrors['submit'] = response.error?.message || 'Failed to create employee';
        }
      },
      error: (err) => {
        this.submitting = false;
        console.error('Error creating employee:', err);
        this.formErrors['submit'] = err.error?.error?.message || 'Failed to create employee. Please try again.';
      }
    });
  }

  // ============================================
  // EDIT EMPLOYEE
  // ============================================

  openEditModal(employee: Employee): void {
    this.editingEmployee = employee;
    
    // Find the job ID for this employee
    const matchingJob = this.jobs.find(j => j.name === employee.job);
    
    this.editForm = {
      firstName: employee.firstName || '',
      middleName: employee.middleName || '',
      lastName: employee.lastName || '',
      email: employee.email || '',
      phoneNumber: employee.phoneNumber || '',
      location: employee.location || 'Abuja',
      jobId: matchingJob?.id || '',
      joinedAt: employee.joinedAt ? employee.joinedAt.split('T')[0] : '',
      birthday: employee.birthday ? employee.birthday.split('T')[0] : ''
    };
    
    this.showEditModal = true;
    this.formErrors = {};
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.editingEmployee = null;
    this.formErrors = {};
  }

  validateEditForm(): boolean {
    this.formErrors = {};

    if (!this.editForm.firstName.trim()) {
      this.formErrors['firstName'] = 'First name is required';
    }

    if (!this.editForm.lastName.trim()) {
      this.formErrors['lastName'] = 'Last name is required';
    }

    if (!this.editForm.email.trim()) {
      this.formErrors['email'] = 'Email is required';
    } else if (!this.isValidEmail(this.editForm.email)) {
      this.formErrors['email'] = 'Please enter a valid email';
    }

    if (!this.editForm.phoneNumber.trim()) {
      this.formErrors['phoneNumber'] = 'Phone number is required';
    }

    return Object.keys(this.formErrors).length === 0;
  }

  submitEditEmployee(): void {
    if (!this.editingEmployee || !this.validateEditForm()) {
      return;
    }

    this.submitting = true;

    const payload: any = {
      firstName: this.editForm.firstName.trim(),
      middleName: this.editForm.middleName?.trim() || null,
      lastName: this.editForm.lastName.trim(),
      email: this.editForm.email.trim(),
      phoneNumber: this.editForm.phoneNumber.trim(),
      location: this.editForm.location || 'Abuja'
    };

    if (this.editForm.jobId) {
      payload.jobId = this.editForm.jobId;
    }

    if (this.editForm.joinedAt) {
      payload.joinedAt = new Date(this.editForm.joinedAt).toISOString();
    }

    if (this.editForm.birthday) {
      payload.birthday = new Date(this.editForm.birthday).toISOString();
    }

    this.http.patch<ApiResponse<Employee>>(
      `${this.apiUrl}/employee/${this.editingEmployee.id}`,
      payload,
      { headers: this.getHeaders() }
    ).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        this.submitting = false;
        if (response.ok && response.data) {
          // Update employee in local list
          const index = this.employees.findIndex(e => e.id === this.editingEmployee?.id);
          if (index !== -1) {
            this.employees[index] = response.data;
            this.applyFilters();
            this.calculateStats();
          }
          
          this.closeEditModal();
          this.showToast('Employee updated successfully', 'success');
        } else {
          this.formErrors['submit'] = response.error?.message || 'Failed to update employee';
        }
      },
      error: (err) => {
        this.submitting = false;
        console.error('Error updating employee:', err);
        this.formErrors['submit'] = err.error?.error?.message || 'Failed to update employee. Please try again.';
      }
    });
  }

  // ============================================
  // ACCOUNT SETUP MODAL
  // ============================================

  closeAccountSetupModal(): void {
    this.showAccountSetupModal = false;
    this.createdEmployeeData = null;
    this.activationLink = '';
  }

  copyActivationLink(): void {
    if (this.activationLink) {
      navigator.clipboard.writeText(this.activationLink).then(() => {
        this.showToast('Activation link copied to clipboard', 'success');
      }).catch(() => {
        this.showToast('Failed to copy link', 'error');
      });
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  getFullName(emp: Employee): string {
    return `${emp.firstName} ${emp.lastName}`;
  }

  getStatusBadge(emp: Employee): string {
    return emp.deactivated ? 'badge-danger' : 'badge-success';
  }

  getStatusText(emp: Employee): string {
    return emp.deactivated ? 'Deactivated' : 'Active';
  }

  getAvatarUrl(emp: Employee): string {
    return emp.avatarUrl || 'assets/media/avatars/300-1.jpg';
  }

  getJobsByDepartment(departmentName: string): Job[] {
    return this.jobs.filter(j => j.department === departmentName);
  }

  getUniqueDepartments(): string[] {
    const depts = new Set(this.employees.map(e => e.department).filter(d => d));
    return Array.from(depts) as string[];
  }

  togglePasswordVisibility(field: 'password' | 'confirm'): void {
    if (field === 'password') {
      this.showPassword = !this.showPassword;
    } else {
      this.showConfirmPassword = !this.showConfirmPassword;
    }
  }

  showToast(message: string, type: 'success' | 'error'): void {
    // You can integrate with your toast library here
    // For now, we'll use a simple alert or console
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

  // Export functionality placeholder
  exportEmployees(): void {
    // Implement CSV export or integrate with your export library
    const csvContent = this.generateCSV();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `employees_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  generateCSV(): string {
    const headers = ['Employee ID', 'First Name', 'Last Name', 'Email', 'Phone', 'Department', 'Job', 'Status'];
    const rows = this.filteredEmployees.map(emp => [
      emp.employeeId,
      emp.firstName,
      emp.lastName,
      emp.email,
      emp.phoneNumber,
      emp.department || '',
      emp.job || '',
      emp.deactivated ? 'Deactivated' : 'Active'
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }
}