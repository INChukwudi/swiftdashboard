// src/app/task-drawer/task-drawer.ts
import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskService, TaskData, SubTask, Comment, FileAttachment, User } from '../services/task.service';

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

  constructor(private taskService: TaskService) {}

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

  onStatusChange(): void {
    if (!this.taskId || !this.canUpdateTask) {
      alert('You do not have permission to update this task status');
      return;
    }

    const statusMap: { [key: string]: string } = {
      'completed': 'Completed',
      'overdue': 'Overdue',
      'under-review': 'Under Review',
      'blocked': 'Blocked',
      'in-progress': 'In Progress'
    };

    const newStatus = statusMap[this.taskStatus] || 'In Progress';

    this.taskService.updateTask(this.taskId, { status: newStatus }).subscribe({
      next: (res) => {
        if (res.success || res.ok) {
          this.taskUpdated.emit(res.data);
          this.loadActivities();
          alert('Task status updated successfully!');
        }
      },
      error: (err) => {
        const errorMsg = err.error?.error?.message || 'Failed to update status';
        alert(errorMsg);
        console.error('Status update failed', err);
      }
    });
  }

  saveTaskUpdates(): void {
    if (!this.taskId || !this.canUpdateTask) {
      alert('You do not have permission to update this task');
      return;
    }
  
    // Format dates properly for the API
    const formatDateForAPI = (dateString: string): string | undefined => {
      if (!dateString) return undefined;
      try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return undefined;
        return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD
      } catch (error) {
        console.error('Error formatting date for API:', error);
        return undefined;
      }
    };
  
    const updates: any = {
      title: this.taskTitle,
      description: this.taskDescription,
      start_date: formatDateForAPI(this.startDate),
      due_date: formatDateForAPI(this.dueDate),
      // Include other fields that might be required
      status: this.taskStatus === 'completed' ? 'Completed' : 
              this.taskStatus === 'overdue' ? 'Overdue' :
              this.taskStatus === 'under-review' ? 'Under Review' :
              this.taskStatus === 'blocked' ? 'Blocked' : 'In Progress'
    };
  
    // Remove undefined fields
    Object.keys(updates).forEach(key => {
      if (updates[key] === undefined || updates[key] === null) {
        delete updates[key];
      }
    });
  
    console.log('Sending update request with data:', updates);
  
    this.taskService.updateTask(this.taskId, updates).subscribe({
      next: (res) => {
        console.log('Update response:', res);
        if (res.ok || res.success) {
          this.taskUpdated.emit(res.data);
          this.loadActivities();
          alert('Task updated successfully!');
        } else {
          // Handle API response with error
          const errorMsg = res.error?.message || 'Failed to update task';
          alert(errorMsg);
        }
      },
      error: (err) => {
        console.error('Update failed with error:', err);
        const errorMsg = err.error?.error?.message || 
                        err.error?.message || 
                        err.message || 
                        'Failed to update task';
        alert(errorMsg);
      }
    });
  }

  confirmDeleteTask(): void {
    if (!this.canDeleteTask) {
      alert('You do not have permission to delete this task');
      return;
    }
    this.showDeleteModal = true;
  }

  deleteTask(): void {
    if (!this.taskId) return;

    const token = localStorage.getItem('access_token');

    fetch('https://pixels-office-server.azurewebsites.net/v1/user/task', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'accept': 'application/json'
      },
      body: JSON.stringify({
        tasksId: [this.taskId]
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.ok) {
        this.showDeleteModal = false;
        this.taskDeleted.emit(this.taskId);
        this.onClose();
        alert('Task deleted successfully');
      } else {
        const errorMsg = data.error?.message || 'Failed to delete task';
        alert(errorMsg);
      }
    })
    .catch(err => {
      console.error('Delete failed', err);
      alert('Failed to delete task');
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
  
        // Extra safety: trigger change detection manually if needed
        // (uncomment if still not showing)
        // this.cdr.detectChanges();   ← add import { ChangeDetectorRef } from '@angular/core';
        // and inject private cdr: ChangeDetectorRef in constructor
  
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
      alert('Please login again - authentication required');
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
      console.log('Full /employee response:', data); // ← Debug gold!
  
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
      alert('Could not load employee list. Check console for details.');
    })
    .finally(() => {
      this.isLoadingEmployees = false;
    });
  }

  filterEmployees(): void {
    const term = this.employeeSearchTerm.toLowerCase();
    this.filteredEmployees = this.allEmployees.filter(emp => 
      `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(term) ||
      emp.email.toLowerCase().includes(term)
    );
  }

  toggleEmployeeSelection(employee: Employee): void {
    const index = this.selectedEmployees.findIndex(e => e.id === employee.id);
    if (index > -1) {
      this.selectedEmployees.splice(index, 1);
    } else {
      this.selectedEmployees.push(employee);
    }
  }

  isEmployeeSelected(employee: Employee): boolean {
    return this.selectedEmployees.some(e => e.id === employee.id);
  }

  addCollaborators(): void {
    if (!this.taskId || this.selectedEmployees.length === 0) {
      alert('Please select at least one collaborator');
      return;
    }
  
    const userIds = this.selectedEmployees.map(e => e.id);
  
    this.taskService.addTaskCollaborators(this.taskId, userIds).subscribe({
      next: (res) => {
        if (res.ok || res.success) {
          alert(`Successfully added ${userIds.length} collaborator(s)!`);
  
          this.selectedEmployees = [];
          this.employeeSearchTerm = '';
  
          // Close modal
          this.closeModal('kt_modal_add_task_collaborators');
  
          // Give backend 500–800ms to finalize (common race condition)
          setTimeout(() => {
            this.loadCollaborators();
          }, 800);
        }
      },
      error: (err) => {
        console.error(err);
        alert('Failed to add: ' + (err.error?.error?.message || 'Unknown error'));
      }
    });
  }
  removeCollaborator(userId: string): void {
    if (!this.taskId || !this.canAddCollaborators) {
      alert('You do not have permission to remove collaborators');
      return;
    }
    if (!confirm('Remove this collaborator?')) return;

    this.taskService.removeTaskCollaborators(this.taskId, [userId]).subscribe({
      next: (res) => {
        if (res.success || res.ok) {
          this.collaborators = this.collaborators.filter(c => c.id !== userId);
          this.loadActivities();
          alert('Collaborator removed successfully!');
        }
      },
      error: (err) => {
        const errorMsg = err.error?.error?.message || 'Failed to remove collaborator';
        alert(errorMsg);
        console.error('Failed to remove collaborator', err);
      }
    });
  }

  private closeModal(modalId: string): void {
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
            alert('Subtask created successfully!');
          }
        },
        error: (err) => {
          console.error('Failed to create subtask', err);
          alert('Failed to create subtask');
        }
      });
    }
  }

  toggleSubTaskComplete(subtask: SubTask): void {
    subtask.completed = !subtask.completed;
  }

  deleteSubTask(index: number): void {
    if (this.subTasks.length <= 0) {
      alert('You must have at least one subtask');
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
            alert('Subtask deleted');
          }
        },
        error: (err) => {
          console.error('Failed to delete subtask', err);
          alert('Failed to delete subtask');
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
      alert('Please write a comment or select a file');
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
        
        alert('Posted successfully!');
      }
    })
    .catch(err => {
      console.error('Failed to post', err);
      alert('Failed to post comment/file');
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
          alert('Comment deleted successfully!');
        }
      },
      error: (err) => {
        console.error('Failed to delete comment', err);
        alert('Failed to delete comment');
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
          alert(`File "${file.name}" uploaded successfully!`);
        }
      })
      .catch(err => {
        console.error('Upload error:', err);
        alert(`Failed to upload ${file.name}`);
      });
    });

    input.value = '';
  }

  deleteFile(fileId: string): void {
    if (!confirm('Delete this file?')) return;
    const file = this.files.find(f => f.id === fileId);
    this.files = this.files.filter(f => f.id !== fileId);
    alert(`File "${file?.name}" deleted successfully!`);
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