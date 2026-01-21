// src/app/components/toast-container/toast-container.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ToastService, Toast } from './toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container-wrapper">
      <div *ngFor="let toast of toasts; trackBy: trackByToastId" 
           class="toast-item"
           [class.toast-success]="toast.type === 'success'"
           [class.toast-error]="toast.type === 'error'"
           [class.toast-warning]="toast.type === 'warning'"
           [class.toast-info]="toast.type === 'info'">
        
        <!-- Icon -->
        <div class="toast-icon-wrapper">
          <div class="toast-icon">
            <i [class]="'ki-outline ' + toast.icon + ' fs-1'"></i>
          </div>
        </div>
        
        <!-- Content -->
        <div class="toast-content">
          <div class="toast-title">{{ toast.title }}</div>
          <div class="toast-message">{{ toast.message }}</div>
        </div>
        
        <!-- Close Button -->
        <button type="button" 
                class="toast-close-btn"
                (click)="dismissToast(toast.id)"
                aria-label="Close">
          <i class="ki-outline ki-cross fs-4"></i>
        </button>
        
        <!-- Progress Bar -->
        <div *ngIf="toast.showProgress" class="toast-progress">
          <div class="toast-progress-bar" 
               [style.animation-duration.ms]="toast.duration"></div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .toast-container-wrapper {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-width: 420px;
      width: 100%;
      pointer-events: none;
    }

    .toast-item {
      display: flex;
      align-items: flex-start;
      padding: 16px 20px;
      border-radius: 12px;
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15), 
                  0 4px 10px rgba(0, 0, 0, 0.1);
      backdrop-filter: blur(10px);
      position: relative;
      overflow: hidden;
      pointer-events: auto;
      animation: slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      transform-origin: right center;
    }

    @keyframes slideInRight {
      from {
        opacity: 0;
        transform: translateX(100px) scale(0.9);
      }
      to {
        opacity: 1;
        transform: translateX(0) scale(1);
      }
    }

    /* Success Toast */
    .toast-success {
      background: linear-gradient(135deg, #e8fff3 0%, #d1fadf 100%);
      border-left: 4px solid #50cd89;
    }
    .toast-success .toast-icon {
      background: linear-gradient(135deg, #50cd89 0%, #3ec27a 100%);
      color: #fff;
    }
    .toast-success .toast-title {
      color: #1e6f4c;
    }
    .toast-success .toast-message {
      color: #2e7d5a;
    }
    .toast-success .toast-progress-bar {
      background: linear-gradient(90deg, #50cd89 0%, #3ec27a 100%);
    }

    /* Error Toast */
    .toast-error {
      background: linear-gradient(135deg, #fff5f5 0%, #ffe0e0 100%);
      border-left: 4px solid #f1416c;
    }
    .toast-error .toast-icon {
      background: linear-gradient(135deg, #f1416c 0%, #d9214e 100%);
      color: #fff;
    }
    .toast-error .toast-title {
      color: #9e1b3c;
    }
    .toast-error .toast-message {
      color: #b52a4a;
    }
    .toast-error .toast-progress-bar {
      background: linear-gradient(90deg, #f1416c 0%, #d9214e 100%);
    }

    /* Warning Toast */
    .toast-warning {
      background: linear-gradient(135deg, #fff8eb 0%, #fff3d6 100%);
      border-left: 4px solid #ffc107;
    }
    .toast-warning .toast-icon {
      background: linear-gradient(135deg, #ffc107 0%, #e5ac00 100%);
      color: #fff;
    }
    .toast-warning .toast-title {
      color: #8a6d00;
    }
    .toast-warning .toast-message {
      color: #997a00;
    }
    .toast-warning .toast-progress-bar {
      background: linear-gradient(90deg, #ffc107 0%, #e5ac00 100%);
    }

    /* Info Toast */
    .toast-info {
      background: linear-gradient(135deg, #f1f8ff 0%, #dbeafe 100%);
      border-left: 4px solid #009ef7;
    }
    .toast-info .toast-icon {
      background: linear-gradient(135deg, #009ef7 0%, #0086d4 100%);
      color: #fff;
    }
    .toast-info .toast-title {
      color: #005a99;
    }
    .toast-info .toast-message {
      color: #0068ad;
    }
    .toast-info .toast-progress-bar {
      background: linear-gradient(90deg, #009ef7 0%, #0086d4 100%);
    }

    /* Icon Wrapper */
    .toast-icon-wrapper {
      flex-shrink: 0;
      margin-right: 14px;
    }

    .toast-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    /* Content */
    .toast-content {
      flex: 1;
      min-width: 0;
      padding-right: 24px;
    }

    .toast-title {
      font-size: 15px;
      font-weight: 700;
      margin-bottom: 4px;
      line-height: 1.3;
    }

    .toast-message {
      font-size: 13px;
      font-weight: 500;
      line-height: 1.5;
      opacity: 0.9;
    }

    /* Close Button */
    .toast-close-btn {
      position: absolute;
      top: 12px;
      right: 12px;
      width: 28px;
      height: 28px;
      border: none;
      background: rgba(0, 0, 0, 0.08);
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: rgba(0, 0, 0, 0.5);
      transition: all 0.2s ease;
    }

    .toast-close-btn:hover {
      background: rgba(0, 0, 0, 0.15);
      color: rgba(0, 0, 0, 0.8);
      transform: scale(1.1);
    }

    /* Progress Bar */
    .toast-progress {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: rgba(0, 0, 0, 0.1);
      border-radius: 0 0 12px 12px;
      overflow: hidden;
    }

    .toast-progress-bar {
      height: 100%;
      width: 100%;
      animation: progressShrink linear forwards;
      transform-origin: left center;
    }

    @keyframes progressShrink {
      from {
        transform: scaleX(1);
      }
      to {
        transform: scaleX(0);
      }
    }

    /* Responsive */
    @media (max-width: 480px) {
      .toast-container-wrapper {
        top: 10px;
        right: 10px;
        left: 10px;
        max-width: none;
      }

      .toast-item {
        padding: 14px 16px;
      }

      .toast-icon {
        width: 40px;
        height: 40px;
      }

      .toast-title {
        font-size: 14px;
      }

      .toast-message {
        font-size: 12px;
      }
    }
  `]
})
export class ToastContainerComponent implements OnInit, OnDestroy {
  toasts: Toast[] = [];
  private destroy$ = new Subject<void>();

  constructor(private toastService: ToastService) {}

  ngOnInit(): void {
    this.toastService.toasts$
      .pipe(takeUntil(this.destroy$))
      .subscribe((toasts: Toast[]) => {
        this.toasts = toasts;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  dismissToast(id: string): void {
    this.toastService.remove(id);
  }

  trackByToastId(index: number, toast: Toast): string {
    return toast.id;
  }
}