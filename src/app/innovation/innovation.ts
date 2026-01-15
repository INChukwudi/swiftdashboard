import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { formatDistanceToNow } from 'date-fns';

// -------------------------- Interfaces --------------------------
export interface Project {
  id: string;
  title: string;
  description?: string;
  isHighPriority?: boolean;
  status?: string;
  archived?: boolean;
}

export interface Owner {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  job?: {
    name?: string;
    department?: { name: string };
  };
  email?: string;
  phoneNumber?: string;
  employeeId?: string;
}

export interface Innovation {
  id: string;
  title: string;
  message: string;
  project: Project | null;
  owner: Owner;
  isMine: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ApiResponse<T> {
  ok: boolean;
  data: T;
  error: any;
}

interface InnovationsListResponse {
  page: number;
  count: number;
  totalPages: number;
  totalItems: number;
  pageData: Innovation[];
}

interface ProjectResponse {
  id: string;
  title: string;
  lead: any;
  taskStats: any;
  startDate: string;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
  collaborators: any[];
  description: string;
  isHighPriority: boolean;
  status: string;
  archived: boolean;
}

// -------------------------- Component --------------------------
@Component({
  selector: 'app-innovation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './innovation.html',
  styleUrl: './innovation.scss',
})
export class InnovationComponent implements OnInit {
  private apiBaseUrl = 'https://pixels-office-server.azurewebsites.net/v1/innovation';
  private projectApiUrl = 'https://pixels-office-server.azurewebsites.net/v1/project';

  innovations: Innovation[] = [];
  filteredInnovations: Innovation[] = [];

  isLoading = false;
  isSubmitting = false;
  isDeleting = false;

  // Modal fields
  modalMode: 'create' | 'edit' = 'create';
  currentIdeaId: string | null = null;
  ideaTitle = '';
  ideaDescription = '';
  selectedProject = '';

  // Filter
  filterProject = 'all';

  // Pagination
  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;
  totalPages = 1;

  // Delete confirmation
  ideaToDelete: Innovation | null = null;

  // Projects for dropdown
  projects: { value: string; label: string }[] = [
    { value: '', label: 'Select Project' },
  ];

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadProjects();
    this.loadInnovations();
  }

  loadProjects(): void {
    this.http
      .get<ApiResponse<{ page: number; count: number; totalPages: number; totalItems: number; pageData: ProjectResponse[] }>>(
        `${this.projectApiUrl}?order=desc&archive=false`
      )
      .subscribe({
        next: (res) => {
          if (res.ok && res.data?.pageData) {
            const projectOptions = res.data.pageData.map(proj => ({
              value: proj.title,
              label: proj.title
            }));
            this.projects = [
              { value: '', label: 'Select Project' },
              ...projectOptions,
              { value: 'other', label: 'Other' }
            ];
          }
        },
        error: (err) => {
          console.error('Failed to load projects', err);
        }
      });
  }

  loadInnovations(page: number = 1): void {
    this.isLoading = true;
    this.currentPage = page;
    
    this.http
      .get<ApiResponse<InnovationsListResponse>>(
        `${this.apiBaseUrl}?order=desc&count=${this.itemsPerPage}&page=${page}`
      )
      .subscribe({
        next: (res) => {
          if (res.ok && res.data?.pageData) {
            this.innovations = res.data.pageData;
            this.totalItems = res.data.totalItems;
            this.totalPages = res.data.totalPages;
            this.currentPage = res.data.page;
            this.applyFilter();
          }
        },
        error: (err) => {
          console.error('Failed to load innovations', err);
          alert('Failed to load ideas. Please try again.');
        },
        complete: () => {
          this.isLoading = false;
        },
      });
  }

  applyFilter(): void {
    if (this.filterProject === 'all') {
      this.filteredInnovations = this.innovations;
    } else {
      this.filteredInnovations = this.innovations.filter(
        (idea) => idea.project?.title === this.filterProject
      );
    }
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadInnovations(1);
  }

  // Pagination methods
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.loadInnovations(page);
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.loadInnovations(this.currentPage + 1);
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.loadInnovations(this.currentPage - 1);
    }
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxPagesToShow = 5;
    
    let startPage = Math.max(1, this.currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(this.totalPages, startPage + maxPagesToShow - 1);
    
    if (endPage - startPage < maxPagesToShow - 1) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  get paginationStart(): number {
    return (this.currentPage - 1) * this.itemsPerPage + 1;
  }

  get paginationEnd(): number {
    return Math.min(this.currentPage * this.itemsPerPage, this.totalItems);
  }

  openCreateModal(): void {
    this.modalMode = 'create';
    this.currentIdeaId = null;
    this.ideaTitle = '';
    this.ideaDescription = '';
    this.selectedProject = '';
  }

  openEditModal(idea: Innovation): void {
    if (!idea.isMine) {
      alert('You can only edit your own ideas.');
      return;
    }

    this.modalMode = 'edit';
    this.currentIdeaId = idea.id;
    this.ideaTitle = idea.title;
    this.ideaDescription = idea.message;
    this.selectedProject = idea.project?.title || '';

    const modal = document.getElementById('submitIdeaModal');
    if (modal) {
      // @ts-ignore
      const bsModal = new bootstrap.Modal(modal);
      bsModal.show();
    }
  }

  submitIdea(): void {
    if (!this.ideaTitle.trim() || !this.ideaDescription.trim() || !this.selectedProject) {
      alert('Please fill in all required fields.');
      return;
    }

    this.isSubmitting = true;

    const payload = {
      title: this.ideaTitle.trim(),
      message: this.ideaDescription.trim(),
      projectTitle: this.selectedProject,
    };

    const request = this.modalMode === 'create'
      ? this.http.post<ApiResponse<Innovation>>(this.apiBaseUrl, payload)
      : this.http.patch<ApiResponse<Innovation>>(`${this.apiBaseUrl}/${this.currentIdeaId}`, payload);

    request.subscribe({
      next: (res) => {
        if (res.ok && res.data) {
          // Reload the current page to get updated data
          this.loadInnovations(this.currentPage);

          const modalEl = document.getElementById('submitIdeaModal');
          if (modalEl) {
            // @ts-ignore
            const bsModal = bootstrap.Modal.getInstance(modalEl);
            bsModal?.hide();
          }
          
          // Show success message
          alert(this.modalMode === 'create' ? 'Idea submitted successfully!' : 'Idea updated successfully!');
        }
      },
      error: (err) => {
        console.error(err);
        alert(err.error?.error?.message || 'Operation failed. Please try again.');
      },
      complete: () => {
        this.isSubmitting = false;
      },
    });
  }

  // Open delete confirmation modal
  openDeleteModal(idea: Innovation): void {
    if (!idea.isMine) {
      alert('You can only delete your own ideas.');
      return;
    }
    
    this.ideaToDelete = idea;
    const modal = document.getElementById('deleteConfirmModal');
    if (modal) {
      // @ts-ignore
      const bsModal = new bootstrap.Modal(modal);
      bsModal.show();
    }
  }

  // Confirm delete
  confirmDelete(): void {
    if (!this.ideaToDelete) return;

    this.isDeleting = true;
    
    // API expects innovationsId array in the body
    const payload = {
      innovationsId: [this.ideaToDelete.id]
    };

    this.http
      .delete<ApiResponse<{ count: number }>>(this.apiBaseUrl, { body: payload })
      .subscribe({
        next: (res) => {
          if (res.ok) {
            // Reload the current page
            this.loadInnovations(this.currentPage);
            
            // Close modal
            const modalEl = document.getElementById('deleteConfirmModal');
            if (modalEl) {
              // @ts-ignore
              const bsModal = bootstrap.Modal.getInstance(modalEl);
              bsModal?.hide();
            }
            
            alert('Idea deleted successfully!');
            this.ideaToDelete = null;
          }
        },
        error: (err) => {
          console.error('Delete error:', err);
          alert('Failed to delete idea. Please try again.');
        },
        complete: () => {
          this.isDeleting = false;
        }
      });
  }

  // Cancel delete
  cancelDelete(): void {
    this.ideaToDelete = null;
  }

  getInitials(firstName: string, lastName: string): string {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  }

  timeAgo(date: string): string {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  }

  getAvatarUrl(idea: Innovation): string {
    return idea.owner.avatarUrl || 'assets/pixelsicon.png';
  }
}