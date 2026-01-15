import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { RouterLink, RouterModule, RouterLinkActive } from '@angular/router';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  email: string;
  phoneNumber: string;
  department: string | null;
  job: string | null;
  avatarUrl: string | null;
  deactivated: boolean;
}

interface ApiResponse {
  ok: boolean;
  data: {
    page: number;
    count: number;
    totalPages: number;
    totalItems: number;
    pageData: Employee[];
  };
  error: any;
}

@Component({
  selector: 'app-all-employees',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLink, RouterLinkActive, HttpClientModule],
  templateUrl: './all-employees.html',
  styleUrl: './all-employees.scss',
})
export class AllEmployees implements OnInit {
  employees: Employee[] = [];
  loading = true;
  error: string | null = null;

  totalItems = 0;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadEmployees();
  }

  loadEmployees(): void {
    this.loading = true;
    this.error = null;
  
    const token = localStorage.getItem('access_token'); // get the token
    if (!token) {
      this.error = 'You are not logged in.';
      this.loading = false;
      return;
    }
  
    const headers = {
      Authorization: `Bearer ${token}`,
    };
  
    this.http.get<ApiResponse>('https://pixels-office-server.azurewebsites.net/v1/employee', { headers }).subscribe({
      next: (response) => {
        if (response.ok && response.data?.pageData) {
          this.employees = response.data.pageData;
          this.totalItems = response.data.totalItems;
        } else {
          this.error = 'Failed to load employees';
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('API Error:', err);
        this.error = 'Unable to connect to the server. Please try again later.';
        this.loading = false;
      },
    });
  }
  

  getFullName(emp: Employee): string {
    return `${emp.firstName} ${emp.lastName}`;
  }

  getStatusBadge(emp: Employee): string {
    return emp.deactivated ? 'badge-danger' : 'badge-success';
  }

  getStatusText(emp: Employee): string {
    return emp.deactivated ? 'Deactivated' : 'Active';
  }

  // Optional: fallback avatar if avatarUrl is null
  getAvatarUrl(emp: Employee): string {
    return emp.avatarUrl || 'assets/media/avatars/300-1.jpg'; // replace with your default image path
  }
}
