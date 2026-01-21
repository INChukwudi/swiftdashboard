// src/app/services/toast.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration: number;
  icon?: string;
  showProgress?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toastsSubject = new BehaviorSubject<Toast[]>([]);
  public toasts$: Observable<Toast[]> = this.toastsSubject.asObservable();

  private defaultDuration = 4000; // 4 seconds

  /**
   * Show a success toast
   */
  success(message: string, title: string = 'Success!'): void {
    this.show({
      type: 'success',
      title,
      message,
      icon: 'ki-check-circle'
    });
  }

  /**
   * Show an error toast
   */
  error(message: string, title: string = 'Error!'): void {
    this.show({
      type: 'error',
      title,
      message,
      icon: 'ki-cross-circle',
      duration: 6000 // Errors stay longer
    });
  }

  /**
   * Show a warning toast
   */
  warning(message: string, title: string = 'Warning!'): void {
    this.show({
      type: 'warning',
      title,
      message,
      icon: 'ki-information-5'
    });
  }

  /**
   * Show an info toast
   */
  info(message: string, title: string = 'Info'): void {
    this.show({
      type: 'info',
      title,
      message,
      icon: 'ki-notification-bing'
    });
  }

  /**
   * Show a custom toast
   */
  show(options: Partial<Toast> & { type: Toast['type']; message: string }): void {
    const toast: Toast = {
      id: this.generateId(),
      type: options.type,
      title: options.title || this.getDefaultTitle(options.type),
      message: options.message,
      duration: options.duration || this.defaultDuration,
      icon: options.icon || this.getDefaultIcon(options.type),
      showProgress: options.showProgress !== false
    };

    const currentToasts = this.toastsSubject.value;
    this.toastsSubject.next([...currentToasts, toast]);

    // Auto-remove after duration
    setTimeout(() => {
      this.remove(toast.id);
    }, toast.duration);
  }

  /**
   * Remove a toast by ID
   */
  remove(id: string): void {
    const currentToasts = this.toastsSubject.value;
    this.toastsSubject.next(currentToasts.filter(t => t.id !== id));
  }

  /**
   * Clear all toasts
   */
  clearAll(): void {
    this.toastsSubject.next([]);
  }

  private generateId(): string {
    return 'toast_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private getDefaultTitle(type: Toast['type']): string {
    const titles: Record<Toast['type'], string> = {
      success: 'Success!',
      error: 'Error!',
      warning: 'Warning!',
      info: 'Information'
    };
    return titles[type];
  }

  private getDefaultIcon(type: Toast['type']): string {
    const icons: Record<Toast['type'], string> = {
      success: 'ki-check-circle',
      error: 'ki-cross-circle',
      warning: 'ki-information-5',
      info: 'ki-notification-bing'
    };
    return icons[type];
  }
}