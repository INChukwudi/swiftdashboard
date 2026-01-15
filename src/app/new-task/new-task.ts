// src/app/new-task/new-task.component.ts
import { Component, OnInit, OnDestroy, Output, EventEmitter, Input } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TaskService, TaskData, Project } from '../services/task.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TagifyInputComponent, TagifyWhitelistItem } from '../tagify-input/tagify-input';

declare var bootstrap: any;
declare var Swal: any;

// Interfaces for API responses
interface Department {
  id: string;
  name: string;
  description: string | null;
}

interface Category {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  point: number;
  department: string;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  email: string;
  phoneNumber: string;
  avatarUrl: string | null;
  department: string | null;
  job: string | null;
  employeeId: string;
}

@Component({
  selector: 'app-new-task',
  standalone: true,  
  imports: [ReactiveFormsModule, CommonModule, TagifyInputComponent],
  templateUrl: './new-task.html',
  styleUrls: ['./new-task.scss']
})
export class NewTaskComponent implements OnInit, OnDestroy {
  @Output() taskCreated = new EventEmitter<TaskData>();
  @Input() projects: Project[] = [];
  
  taskForm!: FormGroup;
  showSubtasks: boolean = false;
  isSubmitting = false;
  
  private destroy$ = new Subject<void>();
  private modal: any;

  // Tagify whitelist for collaborators
  collaboratorWhitelist: TagifyWhitelistItem[] = [];

  // Data arrays
  departments: Department[] = [];
  categories: Category[] = [];
  filteredCategories: Category[] = [];
  employees: Employee[] = [];
  
  // Loading states
  isLoadingProjects = false;
  isLoadingDepartments = false;
  isLoadingCategories = false;
  isLoadingEmployees = false;

  // Priority options
  priorities = [
    { value: 'Low', label: 'Low' },
    { value: 'Medium', label: 'Medium' },
    { value: 'High', label: 'High' }
  ];

  // Recurrence options - using API format
  recurrences = [
    { value: 'OneTime', label: 'One Time Task' },
    { value: 'Daily', label: 'Daily Task' },
    { value: 'Weekly', label: 'Weekly Task' },
    { value: 'BiWeekly', label: 'Bi-Weekly Task' },
    { value: 'Monthly', label: 'Monthly Task' },
    { value: 'Quarterly', label: 'Quarterly Task' }
  ];

  constructor(
    private fb: FormBuilder, 
    private taskService: TaskService
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.initializeModal();
    this.loadAllData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  initializeForm(): void {
    this.taskForm = this.fb.group({
      project: ['', Validators.required],
      title: ['', Validators.required],
      description: ['', Validators.required],
      department: ['', Validators.required],
      category: ['', Validators.required],
      startDate: ['', Validators.required],
      dueDate: ['', Validators.required],
      priority: ['',],
      recurrence: ['OneTime',],
      status: ['NotStarted'],
      collaboratorIds: [[]],
      subtasks: this.fb.array([])
    });

    // Listen to department changes to filter categories
    this.taskForm.get('department')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(departmentId => {
        this.onDepartmentChange(departmentId);
      });
  }

  initializeModal(): void {
    const modalElement = document.getElementById('kt_modal_new_target');
    if (modalElement) {
      this.modal = new bootstrap.Modal(modalElement);
      
      // Reset form when modal is hidden
      modalElement.addEventListener('hidden.bs.modal', () => {
        this.resetForm();
      });
    }
  }

  // ============= DATA LOADING =============

  loadAllData(): void {
    this.loadProjects();
    this.loadDepartments();
    this.loadCategories();
    this.loadEmployees();
  }

  loadProjects(): void {
    if (this.projects.length > 0) return;
    
    this.isLoadingProjects = true;
    this.taskService.getProjects()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          if (response.ok || response.success) {
            // Handle both formats: { data: [...] } or { data: { pageData: [...] } }
            if (response.data?.pageData) {
              this.projects = response.data.pageData;
            } else if (Array.isArray(response.data)) {
              this.projects = response.data;
            }
          }
          this.isLoadingProjects = false;
        },
        error: (error: any) => {
          console.error('Error loading projects:', error);
          this.isLoadingProjects = false;
          this.showErrorSwal('Failed to load projects');
        }
      });
  }

  loadDepartments(): void {
    this.isLoadingDepartments = true;
    this.taskService.getDepartments()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          if (response.ok || response.success) {
            this.departments = response.data?.pageData || response.data || [];
          }
          this.isLoadingDepartments = false;
        },
        error: (error: any) => {
          console.error('Error loading departments:', error);
          this.isLoadingDepartments = false;
          this.showErrorSwal('Failed to load departments');
        }
      });
  }

  loadCategories(): void {
    this.isLoadingCategories = true;
    this.taskService.getCategories()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          if (response.ok || response.success) {
            this.categories = response.data?.pageData || response.data || [];
            this.filteredCategories = this.categories;
          }
          this.isLoadingCategories = false;
        },
        error: (error: any) => {
          console.error('Error loading categories:', error);
          this.isLoadingCategories = false;
          this.showErrorSwal('Failed to load categories');
        }
      });
  }

  loadEmployees(): void {
    this.isLoadingEmployees = true;
    this.taskService.getEmployees()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          if (response.ok || response.success) {
            this.employees = response.data?.pageData || response.data || [];
            console.log('✅ Employees loaded:', this.employees.length);
            console.log('📋 First 3 employees from API:', this.employees.slice(0, 3));
            
            // Build whitelist for Tagify component
            this.collaboratorWhitelist = this.employees.map(emp => ({
              value: `${emp.firstName} ${emp.lastName}`,
              id: emp.id,
              email: emp.email,
              avatarUrl: emp.avatarUrl,
              firstName: emp.firstName,
              lastName: emp.lastName
            }));
            
            console.log('✅ Collaborator whitelist built:', this.collaboratorWhitelist.length, 'items');
            console.log('📋 First 3 whitelist items:', this.collaboratorWhitelist.slice(0, 3));
            console.log('📋 Sample whitelist item:', JSON.stringify(this.collaboratorWhitelist[0], null, 2));
          }
          this.isLoadingEmployees = false;
        },
        error: (error: any) => {
          console.error('Error loading employees:', error);
          this.isLoadingEmployees = false;
          this.showErrorSwal('Failed to load employees');
        }
      });
  }

  onDepartmentChange(departmentId: string): void {
    if (!departmentId) {
      this.filteredCategories = this.categories;
      this.taskForm.patchValue({ category: '' });
      return;
    }

    // Find department name by ID
    const department = this.departments.find(d => d.id === departmentId);
    const departmentName = department?.name;

    // Filter categories by department name (API returns department as name string)
    this.filteredCategories = this.categories.filter(
      cat => cat.department === departmentName
    );

    // Reset category selection
    this.taskForm.patchValue({ category: '' });
  }

  // ============= SUBTASKS =============

  get subtasks(): FormArray {
    return this.taskForm.get('subtasks') as FormArray;
  }

  toggleSubtasks(event: any): void {
    this.showSubtasks = event.target.checked;
    
    if (!this.showSubtasks) {
      this.subtasks.clear();
    }
  }

  addSubtask(): void {
    const subtaskGroup = this.fb.group({
      title: ['', Validators.required],
      completed: [false]
    });
    this.subtasks.push(subtaskGroup);
  }

  removeSubtask(index: number): void {
    this.subtasks.removeAt(index);
  }

  // ============= FORM SUBMISSION =============

  submitTask(): void {
    if (this.taskForm.invalid) {
      this.taskForm.markAllAsTouched();
      this.showValidationErrorSwal();
      return;
    }

    const projectId = this.taskForm.value.project;
    if (!projectId) {
      this.showErrorSwal('Please select a project');
      return;
    }

    console.log('📤 Submitting task with collaborators:', this.taskForm.value.collaboratorIds);
    
    this.isSubmitting = true;
    
    // Show loading indicator
    const submitButton = document.querySelector('[type="submit"]') as HTMLButtonElement;
    if (submitButton) {
      submitButton.setAttribute('data-kt-indicator', 'on');
      submitButton.disabled = true;
    }

    const taskData = this.prepareTaskData();

    this.taskService.createTask(projectId, taskData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          // Remove loading indicator
          if (submitButton) {
            submitButton.removeAttribute('data-kt-indicator');
            submitButton.disabled = false;
          }

          if (response.ok || response.success) {
            console.log("✅ Task created successfully:", response.data);
            this.showSuccessMessageSwal();
            this.taskCreated.emit(response.data);
          }
          this.isSubmitting = false;
        },
        error: (error: any) => {
          // Remove loading indicator
          if (submitButton) {
            submitButton.removeAttribute('data-kt-indicator');
            submitButton.disabled = false;
          }

          console.error('❌ Error creating task:', error);
          this.showErrorMessageSwal(error);
          this.isSubmitting = false;
        }
      });
  }

  prepareTaskData(): any {
    // Use getRawValue() to get ALL values including disabled controls
    const formValue = this.taskForm.getRawValue();
    
    console.log('=== PREPARING TASK DATA ===');
    console.log('Full form value (raw):', formValue);
    console.log('collaboratorIds from form:', formValue.collaboratorIds);
    
    // Map form fields to API expected format
    const taskData: any = {
      title: formValue.title,
      description: formValue.description,
      status: formValue.status,
      priority: formValue.priority,
      recurrence: formValue.recurrence,
      startDate: new Date(formValue.startDate).toISOString(),
      dueDate: new Date(formValue.dueDate).toISOString(),
      categoryId: formValue.category,
      collaboratorsId: formValue.collaboratorIds || []
    };

    console.log('Task data to send:', taskData);
    console.log('collaboratorsId being sent:', taskData.collaboratorsId);

    // Add subtasks if present
    if (formValue.subtasks && formValue.subtasks.length > 0) {
      taskData.subtasks = formValue.subtasks.map((st: any) => ({
        title: st.title,
        completed: st.completed || false
      }));
    }
    
    return taskData;
  }

  // ============= MODAL MANAGEMENT =============

  closeModal(): void {
    if (this.modal) {
      this.modal.hide();
    }
  }

  resetForm(): void {
    this.taskForm.reset({
      recurrence: 'OneTime',
      status: 'NotStarted',
      collaboratorIds: []
    });
    
    this.showSubtasks = false;
    this.subtasks.clear();
    
    const checkbox = document.getElementById('subtaskToggle') as HTMLInputElement;
    if (checkbox) {
      checkbox.checked = false;
    }

    // Reset filtered categories
    this.filteredCategories = this.categories;
  }

  handleCancel(): void {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        text: "Are you sure you would like to cancel?",
        icon: "warning",
        showCancelButton: true,
        buttonsStyling: false,
        confirmButtonText: "Yes, cancel it!",
        cancelButtonText: "No, return",
        customClass: {
          confirmButton: "btn btn-primary",
          cancelButton: "btn btn-active-light"
        }
      }).then((result: any) => {
        if (result.value) {
          this.resetForm();
          this.closeModal();
        }
      });
    } else {
      if (confirm('Are you sure you would like to cancel?')) {
        this.resetForm();
        this.closeModal();
      }
    }
  }

  // ============= VALIDATION & MESSAGES =============

  private showValidationErrorSwal(): void {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        text: "Sorry, looks like there are some errors detected, please try again.",
        icon: "error",
        buttonsStyling: false,
        confirmButtonText: "Ok, got it!",
        customClass: {
          confirmButton: "btn btn-primary"
        }
      });
    } else {
      this.showValidationError();
    }
  }

  private showValidationError(): void {
    const invalidFields: string[] = [];
    
    Object.keys(this.taskForm.controls).forEach(key => {
      const control = this.taskForm.get(key);
      if (control && control.invalid) {
        invalidFields.push(this.getFieldLabel(key));
      }
    });

    alert(`Please fill in all required fields:\n${invalidFields.join('\n')}`);
  }

  private getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: string } = {
      project: 'Project',
      title: 'Task Title',
      description: 'Task Description',
      department: 'Department',
      category: 'Task Category',
      startDate: 'Start Date',
      dueDate: 'Due Date',
      priority: 'Priority',
      recurrence: 'Recurrence'
    };
    return labels[fieldName] || fieldName;
  }

  private showSuccessMessageSwal(): void {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        text: "Task has been successfully created!",
        icon: "success",
        buttonsStyling: false,
        confirmButtonText: "Ok, got it!",
        customClass: {
          confirmButton: "btn btn-primary"
        }
      }).then((result: any) => {
        if (result.isConfirmed) {
          this.closeModal();
          this.resetForm();
        }
      });
    } else {
      alert('Task created successfully!');
      this.closeModal();
      this.resetForm();
    }
  }

  private showErrorSwal(message: string): void {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        text: message,
        icon: "error",
        buttonsStyling: false,
        confirmButtonText: "Ok, got it!",
        customClass: {
          confirmButton: "btn btn-primary"
        }
      });
    } else {
      alert(message);
    }
  }

  private showErrorMessageSwal(error: any): void {
    const message = error?.error?.message || 'Failed to create task. Please try again.';
    this.showErrorSwal(message);
  }

  // ============= HELPER METHODS =============

  isFieldInvalid(fieldName: string): boolean {
    const field = this.taskForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.taskForm.get(fieldName);
    if (field?.errors?.['required']) {
      return `${this.getFieldLabel(fieldName)} is required`;
    }
    return '';
  }
}