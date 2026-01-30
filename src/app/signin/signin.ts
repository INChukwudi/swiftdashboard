import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  catchError,
  finalize,
  of,
  switchMap,
  throwError
} from 'rxjs';

// ──────────────────────────────────────────────────
// Interfaces
// ──────────────────────────────────────────────────
interface LoginResponse {
  ok: boolean;
  data?: {
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
  };
  error?: {
    message: string;
    code?: number;
  };
}

interface UserProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  profilePicture?: string;
}

// ──────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────
@Component({
  selector: 'app-signin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './signin.html',
  styleUrls: ['./signin.scss']
})
export class SigninComponent {
  email = '';
  password = '';
  isLoading = false;
  errorMessage = '';
  selectedRole = '';

  // Modal state
  showRoleModal = false;

  private readonly apiUrl = 'https://pixels-office-server.azurewebsites.net/v1';

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  // Called when Sign In button is clicked - shows the role modal
  onSignInClick() {
    // Validation
    if (this.email.trim() === '' || this.password === '') {
      this.errorMessage = 'Please enter your email and password';
      return;
    }

    // Clear any previous error
    this.errorMessage = '';

    // Show the role selection modal
    this.showRoleModal = true;
  }

  // Close the role modal
  closeRoleModal() {
    this.showRoleModal = false;
  }

  // Called when a role is selected from the modal
  selectRole(role: 'admin' | 'employee') {
    this.selectedRole = role;
    this.showRoleModal = false;
    
    // Proceed with login
    this.performLogin();
  }

  // Perform the actual login API call
  private performLogin() {
    this.isLoading = true;
    this.errorMessage = '';

    const payload = {
      phoneNumberOrEmail: this.email.trim(),
      password: this.password,
      allowedAdminRoles: this.selectedRole === 'admin'
    };

    this.http
      .post<LoginResponse>(`${this.apiUrl}/auth/login`, payload)
      .pipe(
        switchMap((loginRes) => {
          if (!loginRes.ok || !loginRes.data?.accessToken) {
            return throwError(
              () => new Error(loginRes.error?.message || 'Login failed')
            );
          }

          // Save tokens
          localStorage.setItem('access_token', loginRes.data.accessToken);
          if (loginRes.data.refreshToken) {
            localStorage.setItem('refresh_token', loginRes.data.refreshToken);
          }

          // Fetch user profile
          const headers = new HttpHeaders({
            Authorization: `Bearer ${loginRes.data.accessToken}`
          });

          return this.http.get<{ ok: boolean; data: UserProfile }>(
            `${this.apiUrl}/user`,
            { headers }
          );
        }),
        catchError((err) => {
          const msg =
            err.error?.error?.message ||
            err.message ||
            'Invalid credentials or server error. Please try again.';
          this.errorMessage = msg;
          return of(null);
        }),
        finalize(() => {
          this.isLoading = false;
        })
      )
      .subscribe((profileRes) => {
        if (profileRes?.ok && profileRes.data) {
          // Save user profile
          localStorage.setItem('user', JSON.stringify(profileRes.data));

          // Route based on selected role
          if (this.selectedRole === 'admin') {
            this.router.navigate(['/admin']);
          } else {
            this.router.navigate(['/employee']);
          }
        }
      });
  }

  // Toggle password visibility (eye icon)
  togglePassword() {
    const field = document.getElementById('password') as HTMLInputElement;
    const icon = document.getElementById('eyeIcon');

    if (field && icon) {
      if (field.type === 'password') {
        field.type = 'text';
        icon.classList.replace('ki-eye-slash', 'ki-eye');
      } else {
        field.type = 'password';
        icon.classList.replace('ki-eye', 'ki-eye-slash');
      }
    }
  }
}