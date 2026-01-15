// src/app/services/task.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';

export interface TaskData {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  due_date: string;
  start_date?: string;
  dueDate: string;        // ← camelCase for template
  startDate: string;      // ← camelCase for template
  createdAt: string;
  updatedAt: string;
  assignee: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string | null;
    email: string;
  } | null;
  owner: any;
  collaborators: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string | null;
  }[];
  subtasks: any[];
  project?: {
    id: string;
    title: string;
  };
  category?: {
    id: string;
    title: string;
  };
  totalComment: number;
  totalAttachment: number;
  commentCount: number;    // ← for template
  attachmentCount: number; // ← for template
  progress: number;        // ← calculated field
  isMine: boolean;
  isAssigned: boolean;
}

export interface SubTask {
  status: string;
  id?: string;
  title: string;
  completed: boolean;
}

export interface Project {
  id: string;
  name: string;
  title?: string;
  description?: string;
}

export interface User {
  id: string;
  name?: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string;
  avatarUrl?: string | null;
  department?: string;
  job?: string;
}

export interface Comment {
  id: string;
  author: string;
  avatar?: string;
  text: string;
  timestamp: string;
  user_id?: string;
}

export interface FileAttachment {
  id: string;
  name: string;
  fileName?: string;
  size: string;
  uploadDate: string;
  icon: string;
  url?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  ok: boolean;
  data: T;
  message?: string;
  error?: any;
}

export interface PageData<T> {
  page: number;
  count: number;
  totalPages: number;
  totalItems: number;
  pageData: T;
}

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private baseUrl = 'https://pixels-office-server.azurewebsites.net/v1';
  
  // BehaviorSubjects for reactive state management
  private tasksSubject = new BehaviorSubject<TaskData[]>([]);
  public tasks$ = this.tasksSubject.asObservable();
  
  private projectsSubject = new BehaviorSubject<Project[]>([]);
  public projects$ = this.projectsSubject.asObservable();
  
  private selectedTaskSubject = new BehaviorSubject<TaskData | null>(null);
  public selectedTask$ = this.selectedTaskSubject.asObservable();

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  // ============= RESPONSE NORMALIZER =============
  
  /**
   * Normalizes API response to handle both formats:
   * - { data: { pageData: [...] } }
   * - { data: [...] }
   */
  private normalizePageData<T>(response: ApiResponse<any>): T[] {
    if (!response || !(response.success || response.ok)) {
      return [];
    }
    
    // Handle PageData format
    if (response.data?.pageData) {
      return Array.isArray(response.data.pageData) ? response.data.pageData : [];
    }
    
    // Handle direct array format
    return Array.isArray(response.data) ? response.data : [];
  }

  /**
   * Maps raw API task data to normalized TaskData with calculated fields
   */
  private mapTaskData(task: any): TaskData {
    // Calculate progress based on subtasks if available
    let progress = 0;
    if (task.subtasks && Array.isArray(task.subtasks) && task.subtasks.length > 0) {
      const completedSubtasks = task.subtasks.filter((st: any) => 
        st.status === 'Completed' || st.completed === true
      ).length;
      progress = Math.round((completedSubtasks / task.subtasks.length) * 100);
    }

    // If task is completed, progress should be 100%
    if (task.status === 'Completed' || task.status === 'Complete') {
      progress = 100;
    }

    return {
      id: task.id,
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority || 'Medium',
      due_date: task.due_date || task.dueDate || '',
      start_date: task.start_date || task.startDate || '',
      dueDate: task.due_date || task.dueDate || '',
      startDate: task.start_date || task.startDate || '',
      createdAt: task.createdAt || task.created_at || '',
      updatedAt: task.updatedAt || task.updated_at || '',
      assignee: task.assignee || null,
      owner: task.owner,
      collaborators: Array.isArray(task.collaborators) ? task.collaborators : [],
      subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
      project: task.project,
      category: task.category,
      totalComment: task.totalComment || 0,
      totalAttachment: task.totalAttachment || 0,
      commentCount: task.totalComment || 0,
      attachmentCount: task.totalAttachment || 0,
      progress: progress,
      isMine: task.isMine || false,
      isAssigned: task.isAssigned || false
    };
  }

  // ============= TASK ENDPOINTS =============
  
  /**
   * Get all tasks with pagination and optional date filtering
   * Sorted by createdAt in descending order (most recent first)
   */
  getAllTasks(
    page: number = 1, 
    count: number = 100, 
    startDate?: string, 
    endDate?: string
  ): Observable<ApiResponse<PageData<TaskData[]>>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('count', count.toString())
      .set('by', 'createdAt')        // Sort by creation date
      .set('order', 'desc');          // Descending order (newest first)
    
    if (startDate) params = params.set('start_date', startDate);
    if (endDate) params = params.set('end_date', endDate);
    
    return this.http.get<ApiResponse<PageData<any[]>>>(
      `${this.baseUrl}/task`,
      { headers: this.getHeaders(), params }
    ).pipe(
      map(response => {
        if (response.ok || response.success) {
          // Map and normalize the task data
          const rawTasks = this.normalizePageData<any>(response);
          const mappedTasks = rawTasks.map(task => this.mapTaskData(task));
          
          // Update BehaviorSubject
          this.tasksSubject.next(mappedTasks);
          
          // Return normalized response
          return {
            ...response,
            data: {
              page: response.data?.page || page,
              count: response.data?.count || count,
              totalPages: response.data?.totalPages || 1,
              totalItems: response.data?.totalItems || mappedTasks.length,
              pageData: mappedTasks
            }
          };
        }
        return response as ApiResponse<PageData<TaskData[]>>;
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Get task statistics
   */
  getTaskStats(): Observable<ApiResponse<{
    total: number;
    completed: number;
    inProgress: number;
    overdue: number;
    notStarted?: number;
  }>> {
    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/task/stats`, {
      headers: this.getHeaders()
    }).pipe(
      map(response => {
        // Handle different response formats
        if (response.ok || response.success) {
          const data = response.data || {};
          
          // API Response Format:
          // {
          //   "total": 1988,
          //   "stats": {
          //     "status": {
          //       "InProgress": 4,
          //       "Completed": 1969,
          //       "Overdue": 13,
          //       "NotStarted": 0,
          //       "UnderReview": 2,
          //       "Blocked": 0
          //     }
          //   }
          // }
          
          const statusStats = data.stats?.status || {};
          
          return {
            ...response,
            data: {
              total: data.total || 0,
              completed: statusStats.Completed || 0,
              inProgress: statusStats.InProgress || 0,
              overdue: statusStats.Overdue || 0,
              notStarted: statusStats.NotStarted || 0
            }
          };
        }
        return response;
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Get single task by ID
   */
  getTask(taskId: string): Observable<ApiResponse<TaskData>> {
    return this.http.get<ApiResponse<any>>(
      `${this.baseUrl}/task/${taskId}`,
      { headers: this.getHeaders() }
    ).pipe(
      map(response => {
        if (response.success || response.ok) {
          const mappedTask = this.mapTaskData(response.data);
          this.selectedTaskSubject.next(mappedTask);
          return { ...response, data: mappedTask };
        }
        return response as ApiResponse<TaskData>;
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Create a new task
   */
  createTask(projectId: string, taskData: Partial<TaskData>): Observable<ApiResponse<TaskData>> {
    return this.http.post<ApiResponse<any>>(
      `${this.baseUrl}/project/${projectId}/task`,
      taskData,
      { headers: this.getHeaders() }
    ).pipe(
      map(response => {
        if (response.success || response.ok) {
          const mappedTask = this.mapTaskData(response.data);
          
          // Add to tasks list
          const currentTasks = this.tasksSubject.value;
          this.tasksSubject.next([mappedTask, ...currentTasks]);
          
          return { ...response, data: mappedTask };
        }
        return response as ApiResponse<TaskData>;
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Update a task
   */
  updateTask(taskId: string, taskData: Partial<TaskData>): Observable<ApiResponse<TaskData>> {
    return this.http.patch<ApiResponse<any>>(
      `${this.baseUrl}/task/${taskId}`,
      taskData,
      { headers: this.getHeaders() }
    ).pipe(
      map(response => {
        if (response.success || response.ok) {
          const mappedTask = this.mapTaskData(response.data);
          
          // Update in tasks list
          const currentTasks = this.tasksSubject.value;
          const updatedTasks = currentTasks.map(task => 
            task.id === taskId ? mappedTask : task
          );
          this.tasksSubject.next(updatedTasks);
          
          // Update selected task if it's the one being updated
          if (this.selectedTaskSubject.value?.id === taskId) {
            this.selectedTaskSubject.next(mappedTask);
          }
          
          return { ...response, data: mappedTask };
        }
        return response as ApiResponse<TaskData>;
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Delete tasks
   */
  deleteTasks(taskIds: string[]): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(
      `${this.baseUrl}/user/task`,
      { 
        headers: this.getHeaders(),
        body: { tasksId: taskIds }
      }
    ).pipe(
      tap((response: ApiResponse<any>) => {
        if (response.success || response.ok) {
          const currentTasks = this.tasksSubject.value;
          const filteredTasks = currentTasks.filter(
            task => !taskIds.includes(task.id)
          );
          this.tasksSubject.next(filteredTasks);
        }
      }),
      catchError(this.handleError)
    );
  }

  // ============= SUBTASK ENDPOINTS =============
  
  getSubtasks(taskId: string): Observable<ApiResponse<PageData<SubTask[]>>> {
    return this.http.get<ApiResponse<PageData<SubTask[]>>>(
      `${this.baseUrl}/task/${taskId}/subtask`,
      { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError));
  }

  createSubtask(taskId: string, subtask: Partial<SubTask>): Observable<ApiResponse<SubTask>> {
    return this.http.post<ApiResponse<SubTask>>(
      `${this.baseUrl}/task/${taskId}/subtask`,
      subtask,
      { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError));
  }

  updateSubtask(taskId: string, subtaskId: string, subtask: Partial<SubTask>): Observable<ApiResponse<SubTask>> {
    return this.http.patch<ApiResponse<SubTask>>(
      `${this.baseUrl}/task/${taskId}/subtask/${subtaskId}`,
      subtask,
      { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError));
  }

  deleteSubtasks(taskId: string, subtaskIds: string[]): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(
      `${this.baseUrl}/task/${taskId}/subtask`,
      {
        headers: this.getHeaders(),
        body: { subtask_ids: subtaskIds }
      }
    ).pipe(catchError(this.handleError));
  }

  // ============= COMMENT ENDPOINTS =============
  
  getComments(taskId: string): Observable<ApiResponse<PageData<Comment[]>>> {
    return this.http.get<ApiResponse<PageData<Comment[]>>>(
      `${this.baseUrl}/task/${taskId}/comment`,
      { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError));
  }

  addComment(taskId: string, comment: { text: string }): Observable<ApiResponse<Comment>> {
    return this.http.post<ApiResponse<Comment>>(
      `${this.baseUrl}/task/${taskId}/comment`,
      comment,
      { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError));
  }

  deleteComments(taskId: string, commentIds: string[]): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(
      `${this.baseUrl}/task/${taskId}/comment`,
      {
        headers: this.getHeaders(),
        body: { comment_ids: commentIds }
      }
    ).pipe(catchError(this.handleError));
  }

  // ============= ATTACHMENT ENDPOINTS =============
  
  getAttachments(taskId: string): Observable<ApiResponse<PageData<FileAttachment[]>>> {
    return this.http.get<ApiResponse<PageData<FileAttachment[]>>>(
      `${this.baseUrl}/task/${taskId}/attachment`,
      { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError));
  }

  uploadAttachment(taskId: string, file: File): Observable<ApiResponse<FileAttachment>> {
    const formData = new FormData();
    formData.append('file', file);
    
    const token = localStorage.getItem('access_token');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    
    return this.http.post<ApiResponse<FileAttachment>>(
      `${this.baseUrl}/task/${taskId}/attachment`,
      formData,
      { headers }
    ).pipe(catchError(this.handleError));
  }

  // ============= COLLABORATOR ENDPOINTS =============
  
  getTaskCollaborators(taskId: string): Observable<ApiResponse<PageData<User[]>>> {
    return this.http.get<ApiResponse<PageData<User[]>>>(
      `${this.baseUrl}/task/${taskId}/collaborator`,
      { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError));
  }

  addTaskCollaborators(taskId: string, userIds: string[]): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.baseUrl}/task/${taskId}/collaborator`,
      { user_ids: userIds },
      { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError));
  }

  removeTaskCollaborators(taskId: string, userIds: string[]): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(
      `${this.baseUrl}/task/${taskId}/collaborator`,
      {
        headers: this.getHeaders(),
        body: { user_ids: userIds }
      }
    ).pipe(catchError(this.handleError));
  }

  // ============= PROJECT ENDPOINTS =============
  
  getProjects(): Observable<ApiResponse<Project[]>> {
    return this.http.get<ApiResponse<Project[]>>(
      `${this.baseUrl}/project`,
      { headers: this.getHeaders() }
    ).pipe(
      tap((response: ApiResponse<Project[]>) => {
        if (response.success || response.ok) {
          this.projectsSubject.next(response.data);
        }
      }),
      catchError(this.handleError)
    );
  }

  getDepartments(page: number = 1, count: number = 100): Observable<ApiResponse<PageData<any[]>>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('count', count.toString());
    
    return this.http.get<ApiResponse<PageData<any[]>>>(
      `${this.baseUrl}/department`,
      { headers: this.getHeaders(), params }
    ).pipe(catchError(this.handleError));
  }

  // ============= CATEGORY ENDPOINTS =============
  
  /**
   * Get all categories
   */
  getCategories(page: number = 1, count: number = 100): Observable<ApiResponse<PageData<any[]>>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('count', count.toString());
    
    return this.http.get<ApiResponse<PageData<any[]>>>(
      `${this.baseUrl}/category`,
      { headers: this.getHeaders(), params }
    ).pipe(catchError(this.handleError));
  }

  /**
   * Get categories by department
   */
  getCategoriesByDepartment(departmentName: string, page: number = 1, count: number = 100): Observable<ApiResponse<PageData<any[]>>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('count', count.toString())
      .set('department', departmentName);
    
    return this.http.get<ApiResponse<PageData<any[]>>>(
      `${this.baseUrl}/category`,
      { headers: this.getHeaders(), params }
    ).pipe(catchError(this.handleError));
  }

  // ============= EMPLOYEE ENDPOINTS =============
  
  /**
   * Get all employees
   */
  getEmployees(page: number = 1, count: number = 100): Observable<ApiResponse<PageData<any[]>>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('count', count.toString());
    
    return this.http.get<ApiResponse<PageData<any[]>>>(
      `${this.baseUrl}/employee`,
      { headers: this.getHeaders(), params }
    ).pipe(catchError(this.handleError));
  }

  /**
   * Get employee by ID
   */
  getEmployeeById(employeeId: string): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(
      `${this.baseUrl}/employee/${employeeId}`,
      { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError));
  }

  getTaskActivity(taskId: string): Observable<ApiResponse<PageData<any[]>>> {
    return this.http.get<ApiResponse<PageData<any[]>>>(
      `${this.baseUrl}/task/${taskId}/activity`,
      { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError));
  }

  // ============= UTILITY METHODS =============
  
  /**
   * Get tasks for current user
   * Sorted by createdAt in descending order (most recent first)
   */
  getUserTasks(): Observable<ApiResponse<PageData<TaskData[]>>> {
    let params = new HttpParams()
      .set('by', 'createdAt')
      .set('order', 'desc');
    
    return this.http.get<ApiResponse<PageData<any[]>>>(
      `${this.baseUrl}/user/task`,
      { headers: this.getHeaders(), params }
    ).pipe(
      map(response => {
        if (response.ok || response.success) {
          const rawTasks = this.normalizePageData<any>(response);
          const mappedTasks = rawTasks.map(task => this.mapTaskData(task));
          
          this.tasksSubject.next(mappedTasks);
          
          return {
            ...response,
            data: {
              page: response.data?.page || 1,
              count: response.data?.count || mappedTasks.length,
              totalPages: response.data?.totalPages || 1,
              totalItems: response.data?.totalItems || mappedTasks.length,
              pageData: mappedTasks
            }
          };
        }
        return response as ApiResponse<PageData<TaskData[]>>;
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Get overdue tasks
   */
  getOverdueTasks(): TaskData[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return this.tasksSubject.value.filter(task => {
      const dueDateStr = task.dueDate || task.due_date;
      if (!dueDateStr) return false;

      const dueDate = new Date(dueDateStr);
      dueDate.setHours(0, 0, 0, 0);

      return dueDate < today && 
             task.status !== 'Completed' && 
             task.status !== 'Complete';
    });
  }

  setSelectedTask(task: TaskData | null): void {
    this.selectedTaskSubject.next(task);
  }

  getCurrentTasks(): TaskData[] {
    return this.tasksSubject.value;
  }

  getCurrentProjects(): Project[] {
    return this.projectsSubject.value;
  }

  private handleError(error: any): Observable<never> {
    console.error('API Error:', error);
    return throwError(() => error);
  }
}