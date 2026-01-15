import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterLink, RouterModule, RouterLinkActive } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';

declare var $: any;
declare var moment: any;

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  employeeId: string;
  avatarUrl: string;
  job: string;
  department: string;
  monthlyPoint: number;
  monthlyRank: number;
  monthlyAttendancePoint: number;
  monthlyTaskPoint: number;
  dailyAttendancePoint: number;
  dailyTaskPoint: number;
  dailyPoint: number;
  dailyRank: number;
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
}

@Component({
  selector: 'app-ranking',
  imports: [CommonModule, RouterModule, RouterLink, RouterLinkActive],
  templateUrl: './ranking.html',
  styleUrl: './ranking.scss',
})
export class Ranking implements OnInit, OnDestroy {
  private apiUrl = 'https://pixels-office-server.azurewebsites.net/v1';
  private destroy$ = new Subject<void>();
  
  employees: Employee[] = [];
  topThreeEmployees: Employee[] = [];
  isLoading = false;
  errorMessage = '';
  
  // Date range variables
  selectedStartDate: any = null;
  selectedEndDate: any = null;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadEmployeeRanking();
    
    // Initialize DateRangePicker after view loads
    setTimeout(() => {
      this.initDateRangePicker();
      this.initPresetButtons();
    }, 100);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadEmployeeRanking() {
    this.isLoading = true;
    this.errorMessage = '';
    
    const token = localStorage.getItem('access_token');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    this.http.get<ApiResponse>(`${this.apiUrl}/employee/rank`, { headers })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.ok && response.data) {
            this.employees = response.data.pageData;
            // Get top 3 for the header section
            this.topThreeEmployees = this.employees
              .sort((a, b) => a.monthlyRank - b.monthlyRank)
              .slice(0, 3);
          }
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading employee ranking:', error);
          this.errorMessage = 'Failed to load employee ranking. Please try again.';
          this.isLoading = false;
        }
      });
  }

  // Initialize DateRangePicker
  initDateRangePicker() {
    if (typeof $ === 'undefined' || typeof moment === 'undefined') {
      console.warn('jQuery or Moment.js not loaded');
      return;
    }

    const picker = $('#kt_ecommerce_report_views_daterangepicker');

    picker.daterangepicker({
      autoUpdateInput: false,
      locale: {
        format: 'YYYY-MM-DD',
        separator: ' - ',
        applyLabel: 'Apply',
        cancelLabel: 'Cancel',
        fromLabel: 'From',
        toLabel: 'To',
        customRangeLabel: 'Custom Range',
        daysOfWeek: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        monthNames: ['January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'],
        firstDay: 1
      },
      ranges: {
        'Today': [moment(), moment()],
        'Yesterday': [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
        'Last 7 Days': [moment().subtract(6, 'days'), moment()],
        'Last 30 Days': [moment().subtract(29, 'days'), moment()],
        'This Month': [moment().startOf('month'), moment().endOf('month')],
        'Last Month': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
      },
      alwaysShowCalendars: true,
      opens: 'left'
    });

    // When date range is selected
    picker.on('apply.daterangepicker', (ev: any, pickerData: any) => {
      picker.val(pickerData.startDate.format('YYYY-MM-DD') + ' - ' + pickerData.endDate.format('YYYY-MM-DD'));
      this.selectedStartDate = pickerData.startDate;
      this.selectedEndDate = pickerData.endDate;
      this.updateReport(pickerData.startDate, pickerData.endDate);
      $('.btn-range-preset').removeClass('btn-range-active');
    });

    // When cancelled
    picker.on('cancel.daterangepicker', () => {
      picker.val('');
      this.selectedStartDate = null;
      this.selectedEndDate = null;
    });
  }

  // Initialize Preset Buttons
  initPresetButtons() {
    if (typeof $ === 'undefined' || typeof moment === 'undefined') return;

    // Today Button
    $('#todayBtn').click(() => {
      const today = moment();
      const picker = $('#kt_ecommerce_report_views_daterangepicker').data('daterangepicker');
      
      if (picker) {
        picker.setStartDate(today);
        picker.setEndDate(today);
        $('#kt_ecommerce_report_views_daterangepicker').val(today.format('YYYY-MM-DD') + ' - ' + today.format('YYYY-MM-DD'));
        
        $('.btn-range-preset').removeClass('btn-range-active');
        $('#todayBtn').addClass('btn-range-active');
        
        this.selectedStartDate = today;
        this.selectedEndDate = today;
        this.updateReport(today, today);
      }
    });
  }

  // Update report with date range
  updateReport(startDate: any, endDate: any) {
    console.log('Updating report from:', startDate.format('YYYY-MM-DD'), 'to:', endDate.format('YYYY-MM-DD'));
    
    // You can add API call with date range parameters here if your API supports it
    // For now, we'll just reload the data
    this.loadEmployeeRanking();
  }

  // Helper method to get badge class based on rank
  getRankBadgeClass(rank: number): string {
    switch (rank) {
      case 1: return 'badge-success';
      case 2: return 'badge-primary';
      case 3: return 'badge-warning';
      default: return 'badge-secondary';
    }
  }

  // Helper method to get rank label
  getRankLabel(rank: number): string {
    switch (rank) {
      case 1: return '1st';
      case 2: return '2nd';
      case 3: return '3rd';
      default: return `${rank}th`;
    }
  }

  // Helper method to format hours
  formatHours(hours: number): string {
    return hours ? `${hours.toFixed(1)}h` : '0h';
  }

  // Helper method to round points
  formatPoints(points: number): string {
    return points ? Math.round(points).toString() : '0';
  }

  // Helper to get full name
  getFullName(employee: Employee): string {
    return `${employee.firstName} ${employee.lastName}`;
  }
}