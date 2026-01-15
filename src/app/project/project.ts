import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterModule, RouterLinkActive } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../services/auth.service';

interface ProjectData {
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

interface ApiResponse {
  ok: boolean;
  data: {
    page: number;
    count: number;
    totalPages: number;
    totalItems: number;
    pageData:  ProjectData[];
  };
  error: any;
}

@Component({
  selector: 'app-project',
  imports: [CommonModule, RouterModule, RouterLink, RouterLinkActive ],
  templateUrl: './project.html',
  styleUrl: './project.scss',
})
export class Project implements OnInit, OnDestroy {
  isAdmin = false;

  

  private apiUrl = 'https://pixels-office-server.azurewebsites.net/v1';
  private destroy$ = new Subject<void>();

  projects: ProjectData[] = [];
  loading = true;
  error: string | null = null;

  // Statistics
  totalProjects = 0;
  completedProjects = 0;
  overdueProjects = 0;
  inProgressProjects = 0;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // dynamically set isAdmin based on logged-in user
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe(user => {
      this.isAdmin = user?.role?.toLowerCase() === 'admin';
    });
  
    this.loadProjects();
  }
  

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadProjects(): void {
    this.loading = true;
    this.error = null;

    const token = localStorage.getItem('access_token');
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    this.http.get<ApiResponse>(`${this.apiUrl}/project`, { headers })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('Projects response:', response);
          if (response.ok && response.data) {
            this.projects = response.data.pageData;
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
      const hasOverdueTasks = p.taskStats.stats.Overdue > 0;
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
  getLeadName(project: ProjectData): string {
    return `${project.lead.firstName} ${project.lead.lastName}`;
  }

  // Get lead initials
  getLeadInitials(project: ProjectData): string {
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
  getCompletionRate(project: ProjectData): number {
    if (project.taskStats.total === 0) return 0;
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
    this.loadProjects();
  }
}