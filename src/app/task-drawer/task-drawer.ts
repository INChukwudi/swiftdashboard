// src/app/task-drawer/task-drawer.ts
import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskService, TaskData, SubTask, Comment, FileAttachment, User } from '../services/task.service';
import { ToastService } from '../services/toast.service';

interface Activity {
  id: string;
  type: string;
  action: string;
  user: string;
  timestamp: string;
  details?: string;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string;
  department?: string;
}

@Component({
  selector: 'app-task-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './task-drawer.html',
  styleUrls: ['./task-drawer.scss']
})
export class TaskDrawer implements OnChanges {
  @ViewChild('drawer') drawerElement!: ElementRef;
  @ViewChild('fileInput') fileInput!: ElementRef;
  @ViewChild('deleteModal') deleteModal!: ElementRef;

  @Input() isOpen = false;
  @Input() task: TaskData | null = null;

  @Output() closeDrawer = new EventEmitter<void>();
  @Output() taskUpdated = new EventEmitter<TaskData>();
  @Output() taskDeleted = new EventEmitter<string>();

  private taskId: string = '';
  activeTab = 'subtask';
  isDrawerOpen = false;

  // Editable fields
  taskTitle = '';
  taskDescription = '';
  startDate = '';
  dueDate = '';
  category = '';
  taskStatus = '';

  // Permissions
  canUpdateTask = false;
  canDeleteTask = false;
  canAddCollaborators = false;
  canCompleteTask = false;

  // Assigned by
  assignedBy = {
    name: 'Unknown',
    avatar: 'assets/media/avatars/300-1.jpg',
    email: ''
  };

  // Collaborators
  collaborators: any[] = [];
  allEmployees: Employee[] = [];
  filteredEmployees: Employee[] = [];
  selectedEmployees: Employee[] = [];
  employeeSearchTerm = '';
  isLoadingEmployees = false;

  // Sub-tasks
  subTasks: SubTask[] = [];
  isLoadingSubtasks = false;

  // Comments
  comments: Comment[] = [];
  newComment = '';
  isLoadingComments = false;

  // Files
  files: FileAttachment[] = [];
  isLoadingFiles = false;
  selectedFile: File | null = null;

  // Activities
  activities: Activity[] = [];
  isLoadingActivities = false;

  // Delete confirmation
  showDeleteModal = false;

  // Loading states for buttons
  isUpdating = false;
  isDeleting = false;
  isAddingCollaborators = false;

  constructor(
    private taskService: TaskService,
    private toastService: ToastService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['task'] && this.task) {
      this.taskId = this.task.id;
      this.checkPermissions();
      this.loadTaskData();
      this.loadAllTabData();
    }

    if (changes['isOpen']) {
      this.isDrawerOpen = this.isOpen;
      this.handleDrawerStateChange();
      
      // Load employees when drawer opens
      if (this.isDrawerOpen && this.allEmployees.length === 0) {
        this.loadEmployees();
      }
    }
  }

  private checkPermissions(): void {
    if (!this.task) return;
    this.canUpdateTask = this.task.isMine || this.task.isAssigned;
    this.canDeleteTask = this.task.isMine || this.task.isAssigned;
    this.canAddCollaborators = this.task.isMine || this.task.isAssigned;
    this.canCompleteTask = this.task.isMine || this.task.isAssigned;
  }

  private loadTaskData(): void {
    if (!this.task) return;

    this.taskTitle = this.task.title;
    this.taskDescription = this.task.description || '';
    
    // Convert dates to YYYY-MM-DD format for input fields
    this.startDate = this.formatDateForInput(this.task.start_date || this.task.startDate || '');
    this.dueDate = this.formatDateForInput(this.task.due_date || this.task.dueDate || '');
    
    this.taskStatus = this.task.status.toLowerCase().replace(' ', '-');

    this.category = this.task.category && typeof this.task.category === 'object'
      ? this.task.category.title
      : 'Uncategorized';

    if (this.task.assignee) {
      this.assignedBy = {
        name: `${this.task.assignee.firstName} ${this.task.assignee.lastName}`.trim(),
        avatar: this.task.assignee.avatarUrl || 'assets/media/avatars/300-1.jpg',
        email: this.task.assignee.email
      };
    }
  }

  /**
   * Format date to YYYY-MM-DD for HTML date input
   */
  private formatDateForInput(dateString: string): string {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      
      // Format as YYYY-MM-DD
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      return `${year}-${month}-${day}`;
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  }

  /**
   * Format date to ISO string for API (YYYY-MM-DDTHH:mm:ss.sssZ)
   */
  private formatDateForAPI(dateString: string): string | undefined {
    if (!dateString) return undefined;
    try {
      // dateString is in YYYY-MM-DD format from the input
      const date = new Date(dateString + 'T00:00:00.000Z');
      if (isNaN(date.getTime())) return undefined;
      return date.toISOString();
    } catch (error) {
      console.error('Error formatting date for API:', error);
      return undefined;
    }
  }

  private loadAllTabData(): void {
    this.loadCollaborators();
    this.loadSubtasks();
    this.loadComments();
    this.loadFiles();
    this.loadActivities();
  }

  private handleDrawerStateChange(): void {
    if (this.isDrawerOpen) {
      document.body.classList.add('drawer-on');
    } else {
      document.body.classList.remove('drawer-on');
    }
  }

  onClose(): void {
    this.isDrawerOpen = false;
    this.handleDrawerStateChange();
    this.closeDrawer.emit();
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }

  // === Progress & Status ===
  get taskCompletionRate(): number {
    if (!this.task) return 0;
    return this.task.progress || 0;
  }

  get taskCompletionClass(): string {
    const rate = this.taskCompletionRate;
    return rate === 100 ? 'bg-success' : rate >= 50 ? 'bg-primary' : 'bg-warning';
  }

  get statusBadgeClass(): string {
    switch (this.taskStatus) {
      case 'completed': return 'bg-success';
      case 'overdue': return 'bg-danger';
      case 'under-review': return 'bg-warning';
      case 'blocked': return 'bg-secondary';
      default: return 'bg-primary';
    }
  }

  get taskBadgeClass(): string {
    const completed = this.subTasks.filter(t => t.completed).length;
    const total = this.subTasks.length;

    if (completed === 0) return 'badge-light-secondary';
    if (completed === total) return 'badge-light-success';
    return 'badge-light-primary';
  }

  get completedTasksCount(): number {
    return this.subTasks.filter(t => t.completed).length;
  }

  get totalTasksCount(): number {
    return this.subTasks.length;
  }

  /**
   * Map UI status to API status format
   */
  private getAPIStatus(uiStatus: string): string {
    const statusMap: { [key: string]: string } = {
      'completed': 'Completed',
      'overdue': 'Overdue',
      'under-review': 'UnderReview',
      'blocked': 'Blocked',
      'in-progress': 'InProgress',
      'not-started': 'NotStarted'
    };
    return statusMap[uiStatus] || 'InProgress';
  }

  onStatusChange(): void {
    if (!this.taskId || !this.canUpdateTask) {
      this.toastService.error('You do not have permission to update this task status', 'Permission Denied');
      return;
    }

    const newStatus = this.getAPIStatus(this.taskStatus);

    this.taskService.updateTask(this.taskId, { status: newStatus } as any).subscribe({
      next: (res) => {
        if (res.success || res.ok) {
          this.taskUpdated.emit(res.data);
          this.loadActivities();
          this.toastService.success('Task status has been updated', 'Status Updated');
        }
      },
      error: (err) => {
        const errorMsg = err.error?.error?.message || err.error?.message || 'Failed to update status';
        this.toastService.error(errorMsg, 'Update Failed');
        console.error('Status update failed', err);
      }
    });
  }

  /**
   * Save all task updates - FIXED to use correct API format
   */
  saveTaskUpdates(): void {
    if (!this.taskId || !this.canUpdateTask) {
      this.toastService.error('You do not have permission to update this task', 'Permission Denied');
      return;
    }

    this.isUpdating = true;

    // Build update payload matching the API expected format (camelCase)
    const updates: any = {
      title: this.taskTitle,
      description: this.taskDescription
    };

    // Add dates in ISO format if they exist
    const formattedStartDate = this.formatDateForAPI(this.startDate);
    const formattedDueDate = this.formatDateForAPI(this.dueDate);
    
    if (formattedStartDate) {
      updates.startDate = formattedStartDate;
    }
    if (formattedDueDate) {
      updates.dueDate = formattedDueDate;
    }

    // Add status if needed
    updates.status = this.getAPIStatus(this.taskStatus);

    // Add other fields from original task if available
    if (this.task?.assignee?.id) {
      updates.assigneeId = this.task.assignee.id;
    }
    if (this.task?.project?.id) {
      updates.projectId = this.task.project.id;
    }
    if (this.task?.category?.id) {
      updates.categoryId = this.task.category.id;
    }

    console.log('Sending update request with data:', updates);

    const token = localStorage.getItem('access_token');

    fetch(`https://pixels-office-server.azurewebsites.net/v1/task/${this.taskId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(updates)
    })
    .then(res => res.json())
    .then(data => {
      console.log('Update response:', data);
      this.isUpdating = false;
      
      if (data.ok === true) {
        // Map the response data to TaskData format
        const updatedTask = this.mapResponseToTaskData(data.data);
        this.taskUpdated.emit(updatedTask);
        this.loadActivities();
        this.toastService.success('Your task has been updated successfully', 'Task Updated');
      } else {
        const errorMsg = data.error?.message || 'Failed to update task';
        this.toastService.error(errorMsg, 'Update Failed');
      }
    })
    .catch(err => {
      console.error('Update failed with error:', err);
      this.isUpdating = false;
      this.toastService.error('Failed to update task. Please try again.', 'Update Failed');
    });
  }

  /**
   * Map API response to TaskData format
   */
  private mapResponseToTaskData(data: any): TaskData {
    return {
      id: data.id,
      title: data.title,
      description: data.description || '',
      status: data.status,
      priority: data.priority || 'Medium',
      due_date: data.dueDate || '',
      start_date: data.startDate || '',
      dueDate: data.dueDate || '',
      startDate: data.startDate || '',
      createdAt: data.createdAt || '',
      updatedAt: data.updatedAt || '',
      assignee: data.assignee || null,
      owner: data.owner,
      collaborators: Array.isArray(data.collaborators) ? data.collaborators : [],
      subtasks: Array.isArray(data.subtasks) ? data.subtasks : [],
      project: data.project,
      category: data.category,
      totalComment: data.totalComment || 0,
      totalAttachment: data.totalAttachment || 0,
      commentCount: data.totalComment || 0,
      attachmentCount: data.totalAttachment || 0,
      progress: data.progress || 0,
      isMine: data.isMine || false,
      isAssigned: data.isAssigned || false
    };
  }

  confirmDeleteTask(): void {
    if (!this.canDeleteTask) {
      this.toastService.error('You do not have permission to delete this task', 'Permission Denied');
      return;
    }
    this.showDeleteModal = true;
  }

  /**
   * Delete task - FIXED to use correct endpoint /v1/task
   */
  deleteTask(): void {
    if (!this.taskId) return;

    this.isDeleting = true;
    const token = localStorage.getItem('access_token');

    // FIXED: Use /v1/task endpoint instead of /v1/user/task
    fetch('https://pixels-office-server.azurewebsites.net/v1/task', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        tasksId: [this.taskId]
      })
    })
    .then(res => res.json())
    .then(data => {
      console.log('Delete response:', data);
      this.isDeleting = false;
      
      if (data.ok === true) {
        this.showDeleteModal = false;
        this.taskDeleted.emit(this.taskId);
        this.onClose();
        this.toastService.success('The task has been permanently deleted', 'Task Deleted');
      } else {
        const errorMsg = data.error?.message || 'Failed to delete task';
        this.toastService.error(errorMsg, 'Delete Failed');
      }
    })
    .catch(err => {
      console.error('Delete failed', err);
      this.isDeleting = false;
      this.toastService.error('Failed to delete task. Please try again.', 'Delete Failed');
    });
  }

  cancelDelete(): void {
    this.showDeleteModal = false;
  }

  // === Collaborators ===
  private loadCollaborators(): void {
    if (!this.taskId) return;
  
    this.taskService.getTaskCollaborators(this.taskId).subscribe({
      next: (res) => {
        console.log('Collaborators full response:', res);
  
        let rawCollaborators: any[] = [];
  
        // Safely extract the array (your API format)
        if ((res.ok === true || res.success === true) && res.data) {
          if (res.data.pageData && Array.isArray(res.data.pageData)) {
            rawCollaborators = res.data.pageData;
          } else if (Array.isArray(res.data)) {
            rawCollaborators = res.data;
          }
        }
  
        console.log('Raw collaborators from API:', rawCollaborators.length);
  
        // Create a BRAND NEW array (this forces Angular to detect the change)
        const newCollaborators = rawCollaborators.map((user: any) => ({
          id: user.id,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown User',
          avatar: user.avatarUrl || null,
          email: user.email || '',
          initial: (user.firstName?.charAt(0) || 'U').toUpperCase(),
          color: this.getRandomColor()
        }));
  
        // Assign the NEW array (critical!)
        this.collaborators = [...newCollaborators];
  
        console.log('Final collaborators assigned to UI:', this.collaborators);
        console.log('Number of collaborators now visible:', this.collaborators.length);
      },
      error: (err) => {
        console.error('Failed to load collaborators:', err);
        this.collaborators = [];
      }
    });
  }

  private loadEmployees(): void {
    this.isLoadingEmployees = true;
    const token = localStorage.getItem('access_token');
  
    if (!token) {
      console.warn('No access_token found in localStorage');
      this.toastService.warning('Please login again - authentication required', 'Session Expired');
      this.isLoadingEmployees = false;
      return;
    }
  
    fetch('https://pixels-office-server.azurewebsites.net/v1/employee?page=1&count=100', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    })
    .then(res => {
      if (!res.ok) {
        throw new Error(`Server responded with ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      console.log('Full /employee response:', data);
  
      let employees: any[] = [];
  
      // Handle your API's actual format
      if (data.ok === true && data.data?.pageData) {
        employees = Array.isArray(data.data.pageData) ? data.data.pageData : [];
      } else if (Array.isArray(data.data)) {
        employees = data.data;
      }
  
      // Map to expected Employee interface
      this.allEmployees = employees.map(emp => ({
        id: emp.id,
        firstName: emp.firstName || '',
        lastName: emp.lastName || '',
        email: emp.email || '',
        avatarUrl: emp.avatarUrl || null,
        department: emp.department || ''
      }));
  
      this.filteredEmployees = [...this.allEmployees];
  
      console.log(`Successfully loaded ${this.allEmployees.length} employees`);
    })
    .catch(err => {
      console.error('Failed to load employees:', err);
      this.toastService.error('Could not load employee list', 'Loading Failed');
    })
    .finally(() => {
      this.isLoadingEmployees = false;
    });
  }

  filterEmployees(): void {
    const term = this.employeeSearchTerm.toLowerCase();
    
    this.filteredEmployees = this.allEmployees.filter(emp => {
      const matchesSearch = `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(term) ||
                           emp.email.toLowerCase().includes(term);
      return matchesSearch;
    });
  }

  toggleEmployeeSelection(employee: Employee): void {
    const isAlreadyCollaborator = this.collaborators.some(c => c.id === employee.id);
    
    if (isAlreadyCollaborator) {
      // Remove existing collaborator directly
      this.removeCollaborator(employee.id);
      return;
    }
    
    // Toggle in selected list for new additions
    const index = this.selectedEmployees.findIndex(e => e.id === employee.id);
    if (index > -1) {
      this.selectedEmployees.splice(index, 1);
    } else {
      this.selectedEmployees.push(employee);
    }
  }

  isEmployeeSelected(employee: Employee): boolean {
    // Check if in selected list OR already a collaborator
    const isSelected = this.selectedEmployees.some(e => e.id === employee.id);
    const isCollaborator = this.collaborators.some(c => c.id === employee.id);
    return isSelected || isCollaborator;
  }

  

  /**
   * Add collaborators - FIXED to use correct API format
   */
  addCollaborators(): void {
    if (!this.taskId || this.selectedEmployees.length === 0) {
      this.toastService.warning('Please select at least one collaborator', 'No Selection');
      return;
    }

    this.isAddingCollaborators = true;
    const userIds = this.selectedEmployees.map(e => e.id);
    const token = localStorage.getItem('access_token');

    console.log('Adding collaborators:', userIds);
    console.log('Task ID:', this.taskId);

    // Use fetch directly with the exact API format
    fetch(`https://pixels-office-server.azurewebsites.net/v1/task/${this.taskId}/collaborator`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        collaboratorsId: userIds
      })
    })
    .then(res => res.json())
    .then(data => {
      console.log('Add collaborators response:', data);
      this.isAddingCollaborators = false;

      if (data.ok === true || data.success === true) {
        const count = userIds.length;
        
        // Reset selection FIRST
        this.selectedEmployees = [];
        this.employeeSearchTerm = '';
        
        // Close modal properly
        this.closeModalProperly('kt_modal_add_task_collaborators');
        
        // Reload collaborators immediately (don't close drawer!)
        this.loadCollaborators();
        
        // Re-filter employees after collaborators load
        setTimeout(() => {
          this.filterEmployees();
        }, 2500);
        
        // Show success toast
        this.toastService.success(
          `${count} collaborator${count > 1 ? 's have' : ' has'} been added to this task`,
          'Collaborators Added'
        );
      }
      
      else {
        const errorMsg = data.error?.message || 'Failed to add collaborators';
        this.toastService.error(errorMsg, 'Failed');
      }
    })
    .catch(err => {
      console.error('Failed to add collaborators:', err);
      this.isAddingCollaborators = false;
      this.toastService.error('Failed to add collaborators. Please try again.', 'Failed');
    });
  }

  removeCollaborator(userId: string): void {
    if (!this.taskId || !this.canAddCollaborators) {
      this.toastService.error('You do not have permission to remove collaborators', 'Permission Denied');
      return;
    }
    if (!confirm('Remove this collaborator?')) return;

    const token = localStorage.getItem('access_token');

    fetch(`https://pixels-office-server.azurewebsites.net/v1/task/${this.taskId}/collaborator`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        collaboratorsId: [userId]
      })
    })
    .then(res => res.json())
    .then(data => {
      console.log('Remove collaborator response:', data);
      
      if (data.ok === true || data.success === true) {
        this.collaborators = this.collaborators.filter(c => c.id !== userId);
        this.loadActivities();
        this.filterEmployees(); // Re-filter to include removed collaborator
        this.toastService.success('Collaborator has been removed from this task', 'Collaborator Removed');
      } else {
        const errorMsg = data.error?.message || 'Failed to remove collaborator';
        this.toastService.error(errorMsg, 'Failed');
      }
    })
    .catch(err => {
      console.error('Failed to remove collaborator:', err);
      this.toastService.error('Failed to remove collaborator. Please try again.', 'Failed');
    });
  }

  private closeModalProperly(modalId: string): void {
    const modalEl = document.getElementById(modalId);
    if (modalEl) {
      // Try to use Bootstrap's modal instance if available
      const bootstrapModal = (window as any).bootstrap?.Modal?.getInstance(modalEl);
      if (bootstrapModal) {
        bootstrapModal.hide();
      } else {
        // Manual cleanup if Bootstrap instance not available
        modalEl.classList.remove('show');
        modalEl.style.display = 'none';
        modalEl.setAttribute('aria-hidden', 'true');
        modalEl.removeAttribute('aria-modal');
        modalEl.removeAttribute('role');
      }
      
      // Remove all backdrops
      setTimeout(() => {
        document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
          backdrop.remove();
        });
        document.body.classList.remove('modal-open');
        document.body.style.removeProperty('overflow');
        document.body.style.removeProperty('padding-right');
      }, 150);
    }
  }

  // === Sub-tasks ===
  private loadSubtasks(): void {
    if (!this.taskId) return;
    this.isLoadingSubtasks = true;

    this.taskService.getSubtasks(this.taskId).subscribe({
      next: (res) => {
        if (res.success || res.ok) {
          const subtaskData = res.data.pageData || res.data;
          this.subTasks = (Array.isArray(subtaskData) ? subtaskData : []).map((st: any): SubTask => ({
            id: st.id,
            title: st.title,
            status: st.status,
            completed: st.status === 'Completed'
          }));
        }
        this.isLoadingSubtasks = false;
      },
      error: () => {
        this.subTasks = [];
        this.isLoadingSubtasks = false;
      }
    });
  }

  addSubTask(): void {
    this.subTasks.push({
      title: '',
      status: 'Pending',
      completed: false
    });
  }

  createSubtask(index: number): void {
    const subtask = this.subTasks[index];

    if (!subtask.id && subtask.title.trim()) {
      this.taskService.createSubtask(this.taskId, {
        title: subtask.title,
        status: subtask.completed ? 'Completed' : 'Pending'
      }).subscribe({
        next: (res) => {
          if (res.success || res.ok) {
            this.subTasks[index] = {
              id: res.data.id,
              title: res.data.title,
              status: res.data.status,
              completed: res.data.status === 'Completed'
            };
            this.loadActivities();
            this.toastService.success('Subtask has been created', 'Subtask Created');
          }
        },
        error: (err) => {
          console.error('Failed to create subtask', err);
          this.toastService.error('Failed to create subtask', 'Creation Failed');
        }
      });
    }
  }

  toggleSubTaskComplete(subtask: SubTask): void {
    subtask.completed = !subtask.completed;
  }

  deleteSubTask(index: number): void {
    if (this.subTasks.length <= 0) {
      this.toastService.warning('You must have at least one subtask', 'Cannot Delete');
      return;
    }

    const subtask = this.subTasks[index];
    
    if (subtask.id) {
      if (!confirm('Delete this subtask?')) return;
      
      this.taskService.deleteSubtasks(this.taskId, [subtask.id]).subscribe({
        next: (res) => {
          if (res.success || res.ok) {
            this.subTasks.splice(index, 1);
            this.loadActivities();
            this.toastService.success('Subtask has been deleted', 'Subtask Deleted');
          }
        },
        error: (err) => {
          console.error('Failed to delete subtask', err);
          this.toastService.error('Failed to delete subtask', 'Deletion Failed');
        }
      });
    } else {
      this.subTasks.splice(index, 1);
    }
  }

  // === Comments ===
  private loadComments(): void {
    if (!this.taskId) return;
    this.isLoadingComments = true;

    this.taskService.getComments(this.taskId).subscribe({
      next: (res) => {
        if (res.success || res.ok) {
          const commentData = res.data.pageData || res.data;
          this.comments = (Array.isArray(commentData) ? commentData : []).map((c: any) => ({
            id: c.id,
            author: c.user ? `${c.user.firstName} ${c.user.lastName}` : 'Unknown',
            avatar: c.user?.avatarUrl || null,
            text: c.message || '',
            timestamp: new Date(c.createdAt).toLocaleString(),
            user_id: c.user?.id
          }));
        }
        this.isLoadingComments = false;
      },
      error: () => {
        this.comments = [];
        this.isLoadingComments = false;
      }
    });
  }

  addComment(): void {
    if (!this.taskId) return;
    
    const hasText = this.newComment.trim();
    const hasFile = this.selectedFile;

    if (!hasText && !hasFile) {
      this.toastService.warning('Please write a comment or select a file', 'Empty Comment');
      return;
    }

    const formData = new FormData();
    
    if (hasText) {
      formData.append('text', this.newComment.trim());
    }
    
    if (hasFile) {
      formData.append('attachment', hasFile);
      formData.append('type', 'attachment');
    }

    const token = localStorage.getItem('access_token');

    fetch(`https://pixels-office-server.azurewebsites.net/v1/task/${this.taskId}/comment`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    })
    .then(res => res.json())
    .then(data => {
      if (data.success || data.ok) {
        this.newComment = '';
        this.selectedFile = null;
        if (this.fileInput) this.fileInput.nativeElement.value = '';
        
        this.loadComments();
        if (hasFile) this.loadFiles();
        this.loadActivities();
        
        this.toastService.success('Your comment has been posted', 'Comment Added');
      }
    })
    .catch(err => {
      console.error('Failed to post', err);
      this.toastService.error('Failed to post comment', 'Posting Failed');
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
    }
  }

  deleteComment(commentId: string): void {
    if (!this.taskId || !confirm('Delete this comment?')) return;

    this.taskService.deleteComments(this.taskId, [commentId]).subscribe({
      next: (res) => {
        if (res.success || res.ok) {
          this.comments = this.comments.filter(c => c.id !== commentId);
          this.loadActivities();
          this.toastService.success('Comment has been deleted', 'Comment Deleted');
        }
      },
      error: (err) => {
        console.error('Failed to delete comment', err);
        this.toastService.error('Failed to delete comment', 'Deletion Failed');
      }
    });
  }

  getCommentInitials(author: string): string {
    return author.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  }

  // === Files ===
  private loadFiles(): void {
    if (!this.taskId) return;
    this.isLoadingFiles = true;

    this.taskService.getAttachments(this.taskId).subscribe({
      next: (res) => {
        if (res.success || res.ok) {
          const fileData = res.data.pageData || res.data;
          this.files = (Array.isArray(fileData) ? fileData : []).map((f: any) => ({
            id: f.id,
            name: f.fileName || f.name,
            size: f.size || '0',
            uploadDate: new Date(f.createdAt).toLocaleDateString(),
            icon: this.getFileIcon(f.fileName || f.name),
            url: f.url
          }));
        }
        this.isLoadingFiles = false;
      },
      error: () => {
        this.files = [];
        this.isLoadingFiles = false;
      }
    });
  }

  handleFileUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || !this.taskId) return;

    Array.from(input.files).forEach(file => {
      const formData = new FormData();
      formData.append('attachment', file);
      formData.append('type', 'attachment');

      const token = localStorage.getItem('access_token');

      fetch(`https://pixels-office-server.azurewebsites.net/v1/task/${this.taskId}/comment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })
      .then(res => res.json())
      .then(data => {
        if (data.success || data.ok) {
          this.loadFiles();
          this.loadActivities();
          this.toastService.success(`File "${file.name}" has been uploaded`, 'Upload Complete');
        }
      })
      .catch(err => {
        console.error('Upload error:', err);
        this.toastService.error(`Failed to upload ${file.name}`, 'Upload Failed');
      });
    });

    input.value = '';
  }

  deleteFile(fileId: string): void {
    if (!confirm('Delete this file?')) return;
    const file = this.files.find(f => f.id === fileId);
    this.files = this.files.filter(f => f.id !== fileId);
    this.toastService.success(`File "${file?.name}" has been deleted`, 'File Deleted');
  }

  formatFileSize(size: string | number = 0): string {
    let bytes = typeof size === 'string' ? parseInt(size, 10) : size;
    if (isNaN(bytes) || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }

  getFileIcon(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const map: { [key: string]: string } = {
      pdf: 'assets/files/pdf.svg',
      doc: 'assets/files/doc.svg',
      docx: 'assets/files/doc.svg',
      xls: 'assets/files/xls.svg',
      xlsx: 'assets/files/xls.svg',
      jpg: 'assets/files/jpg.svg',
      jpeg: 'assets/files/jpg.svg',
      png: 'assets/files/png.svg'
    };
    return map[ext] || 'assets/files/default.svg';
  }

  // === Activity ===
  private loadActivities(): void {
    if (!this.taskId) return;
    this.isLoadingActivities = true;

    this.taskService.getTaskActivity(this.taskId).subscribe({
      next: (res) => {
        if (res.success || res.ok) {
          const activityData = res.data.pageData || res.data;
          this.activities = (Array.isArray(activityData) ? activityData : []).map((activity: any) => ({
            id: activity.id || Date.now().toString(),
            type: this.getActivityTypeFromMessage(activity.type || activity.message),
            action: activity.message || activity.description || 'Activity logged',
            user: activity.user 
              ? `${activity.user.firstName} ${activity.user.lastName}` 
              : 'System',
            timestamp: activity.createdAt || activity.timestamp || new Date().toISOString(),
            details: activity.details
          }));
        }
        this.isLoadingActivities = false;
      },
      error: () => {
        this.activities = [];
        this.isLoadingActivities = false;
      }
    });
  }

  private getActivityTypeFromMessage(typeOrMessage: string): string {
    const lowered = typeOrMessage.toLowerCase();
    if (lowered.includes('subtask')) return 'subtask';
    if (lowered.includes('comment') || lowered.includes('note')) return 'comment';
    if (lowered.includes('attachment') || lowered.includes('file')) return 'file';
    if (lowered.includes('collaborator')) return 'collaborator';
    return 'status';
  }

  getActivityIcon(type: string): string {
    const icons: { [key: string]: string } = {
      subtask: 'ki-check-square',
      comment: 'ki-message-text',
      file: 'ki-file',
      status: 'ki-flag',
      collaborator: 'ki-user'
    };
    return icons[type] || 'ki-information';
  }

  private getRandomColor(): string {
    const colors = ['primary', 'success', 'info', 'warning', 'danger'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  formatDate(date: string): string {
    if (!date) return 'Not set';
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  trackByTaskId(_: number, task: SubTask): any { return task.id || _; }
  trackByCommentId(_: number, comment: Comment): any { return comment.id; }
  trackByFileId(_: number, file: FileAttachment): any { return file.id; }
  trackByActivityId(_: number, activity: Activity): any { return activity.id; }
  trackByEmployeeId(_: number, employee: Employee): any { return employee.id; }
}