// src/app/services/auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  // add more
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'https://pixels-office-server.azurewebsites.net/v1';
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {
    this.checkSavedSession(); // Run on app start
  }

  private checkSavedSession() {
    const token = localStorage.getItem('access_token');
    const userJson = localStorage.getItem('user');

    if (token && userJson) {
      try {
        const user = JSON.parse(userJson);
        this.currentUserSubject.next(user);
      } catch (e) {
        this.logout();
      }
    }
  }

  login(accessToken: string, user: User, refreshToken?: string) {
    localStorage.setItem('access_token', accessToken);
    if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    this.currentUserSubject.next(user);
  }

  logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    this.currentUserSubject.next(null);
    this.router.navigate(['/signin']);
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('access_token');
  }

  getUser(): User | null {
    const userJson = localStorage.getItem('user');
    return userJson ? JSON.parse(userJson) : null;
  }
  isAdmin(): boolean {
    const role = this.getUser()?.role;
    return role?.toLowerCase() === 'admin'; // case-insensitive
  }

  // Optional: Refresh token endpoint (if your backend has /auth/refresh)
  refreshToken(): Observable<boolean> {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) return of(false);

    return this.http.post<any>(`${this.apiUrl}/auth/refresh`, { refreshToken }).pipe(
      map(res => {
        if (res.ok && res.data?.accessToken) {
          localStorage.setItem('access_token', res.data.accessToken);
          return true;
        }
        return false;
      }),
      catchError(() => {
        this.logout();
        return of(false);
      })
    );
  }
}