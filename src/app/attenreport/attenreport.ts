import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil, forkJoin, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

declare var $: any;
declare var moment: any;
declare var toastr: any;

interface User {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  email: string;
  phoneNumber: string;
  employeeId: string;
  position?: string;
  department?: string;
}

interface Break {
  id: string;
  startTime: string;
  endTime: string | null;
  type: string;
}

interface AttendanceRecord {
  id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  isSeated: boolean;
  currentBreak: Break | null;
  breaks: Break[];
}

interface PaginatedAttendance {
  page: number;
  count: number;
  totalPages: number;
  totalItems: number;
  pageData: AttendanceRecord[];
}

interface AttendanceStatsData {
  total: number;
  stats: {
    Absent: number;
    Sick: number;
    Holiday: number;
    OnTime: number;
    Leave: number;
    Late: number;
  };
}

interface ApiResponse<T> {
  ok: boolean;
  data: T;
  error: any;
}

type Period = 'Day' | 'Week' | 'Month' | 'Quarter' | 'Year';

@Component({
  selector: 'app-attenreport',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './attenreport.html',
  styleUrl: './attenreport.scss',
})
export class Attenreport implements OnInit {
  private apiUrl = 'https://pixels-office-server.azurewebsites.net/v1';
  private destroy$ = new Subject<void>();

  // Employee data
  employeeId: string = '';
  employee: User | null = null;
  
  // Attendance data
  attendanceRecords: AttendanceRecord[] = [];
  attendanceStatsData: AttendanceStatsData = {
    total: 0,
    stats: {
      Absent: 0,
      Sick: 0,
      Holiday: 0,
      OnTime: 0,
      Leave: 0,
      Late: 0
    }
  };
  
  selectedPeriod: Period = 'Month';
  selectedMonth: string = '';
  loading = true;
  error: string | null = null;

  // Store original values for cancel functionality
  originalValues: any = {};
  currentEditingRow: any = null;

  // Calendar data
  calendarHTML: string = '';
  currentMonthData: any[] = [];
  
  // Math reference for template
  Math = Math;

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    // Get employee ID from route params
    this.route.params
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        this.employeeId = params['employeeId'] || params['id'];
        
        if (this.employeeId) {
          this.loadEmployeeAndAttendanceData();
        } else {
          this.error = 'No employee ID provided';
          this.loading = false;
        }
      });

    // Set default month to current month
    const now = new Date();
    this.selectedMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  }

  ngAfterViewInit(): void {
    this.initDateRangePicker();
    this.setupTableClickHandlers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load employee data and attendance in parallel
   */
  loadEmployeeAndAttendanceData(): void {
    this.loading = true;
    this.error = null;

    // Load employee profile and attendance data
    forkJoin({
      employee: this.loadEmployeeProfile(),
      stats: this.loadAttendanceStats(),
      records: this.loadAttendanceRecords()
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (results) => {
          this.employee = results.employee;
          this.attendanceStatsData = results.stats;
          
          // Handle paginated response
          if (results.records && results.records.pageData) {
            this.attendanceRecords = results.records.pageData;
          }
          
          this.updateStatsDisplay();
          this.renderCalendar();
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading data:', err);
          this.error = 'Failed to load employee attendance data';
          this.loading = false;
        }
      });
  }

  /**
   * Load employee profile
   */
  loadEmployeeProfile() {
    const url = `${this.apiUrl}/employee/${this.employeeId}`;
    return this.http.get<ApiResponse<User>>(url)
      .pipe(
        takeUntil(this.destroy$),
        map((response) => {
          if (response.ok && response.data) {
            return response.data;
          } else {
            throw new Error(response.error || 'Failed to load employee profile');
          }
        })
      );
  }

  /**
   * Load attendance statistics
   */
  loadAttendanceStats() {
    const url = `${this.apiUrl}/employee/${this.employeeId}/attendance/stats?period=${this.selectedPeriod}`;
    
    return this.http.get<ApiResponse<AttendanceStatsData>>(url)
      .pipe(
        takeUntil(this.destroy$),
        map((response) => {
          if (response.ok && response.data) {
            return response.data;
          } else {
            throw new Error(response.error || 'Failed to load stats');
          }
        })
      );
  }

  /**
   * Load attendance records
   */
  loadAttendanceRecords() {
    const url = `${this.apiUrl}/employee/${this.employeeId}/attendance?order=desc&period=${this.selectedPeriod}`;
    
    return this.http.get<ApiResponse<PaginatedAttendance>>(url)
      .pipe(
        takeUntil(this.destroy$),
        map((response) => {
          if (response.ok && response.data) {
            return response.data;
          } else {
            throw new Error(response.error || 'Failed to load records');
          }
        })
      );
  }

  /**
   * Update stats display in DOM
   */
  updateStatsDisplay(): void {
    setTimeout(() => {
      const presentCount = document.getElementById('presentCount');
      const absentCount = document.getElementById('absentCount');
      const lateCount = document.getElementById('lateCount');
      const attendancePercentage = document.getElementById('attendancePercentage');

      const stats = this.attendanceStatsData.stats;
      const total = this.attendanceStatsData.total;
      
      // Calculate present (OnTime + Leave for this use case, or adjust as needed)
      const presentTotal = stats.OnTime + stats.Leave;
      const absentTotal = stats.Absent + stats.Sick + stats.Holiday;
      
      // Calculate percentage
      const percentage = total > 0 
        ? Math.round((presentTotal / total) * 100) 
        : 0;

      if (presentCount) presentCount.textContent = presentTotal.toString();
      if (absentCount) absentCount.textContent = absentTotal.toString();
      if (lateCount) lateCount.textContent = stats.Late.toString();
      if (attendancePercentage) attendancePercentage.textContent = percentage + '%';
    }, 100);
  }

  /**
   * Change period and reload data
   */
  changePeriod(period: Period): void {
    this.selectedPeriod = period;
    this.loadEmployeeAndAttendanceData();
  }

  /**
   * Render calendar with attendance data
   */
  renderCalendar(): void {
    if (!this.selectedMonth) return;

    const [year, month] = this.selectedMonth.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    const startingDay = firstDay.getDay();
    const today = new Date();
    
    let calendarHTML = '';
    
    // Add empty cells for days before the first of the month
    for (let i = 0; i < startingDay; i++) {
      calendarHTML += `<div class="calendar-day-empty"></div>`;
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      const record = this.attendanceRecords.find(r => r.date.startsWith(dateStr));
      const isToday = today.toISOString().slice(0, 10) === dateStr;
      
      let dayClass = 'calendar-day ';
      let backgroundColor = '';
      let textColor = '';
      let borderColor = '';
      
      if (record) {
        const status = record.status.toLowerCase();
        switch(status) {
          case 'ontime':
            dayClass += 'day-present';
            backgroundColor = '#e8f5e9';
            textColor = '#2e7d32';
            borderColor = '#c8e6c9';
            break;
          case 'absent':
          case 'sick':
            dayClass += 'day-absent';
            backgroundColor = '#ffebee';
            textColor = '#c62828';
            borderColor = '#ffcdd2';
            break;
          case 'late':
            dayClass += 'day-late';
            backgroundColor = '#fff3e0';
            textColor = '#ef6c00';
            borderColor = '#ffe0b2';
            break;
          case 'leave':
          case 'holiday':
            dayClass += 'day-weekend';
            backgroundColor = '#e3f2fd';
            textColor = '#1976d2';
            borderColor = '#bbdefb';
            break;
          default:
            dayClass += 'day-future';
            backgroundColor = '#fafafa';
            textColor = '#bdbdbd';
            borderColor = '#eeeeee';
        }
      } else {
        // Check if it's a weekend
        const dayOfWeek = new Date(dateStr).getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          dayClass += 'day-weekend';
          backgroundColor = '#f5f5f5';
          textColor = '#9e9e9e';
          borderColor = '#e0e0e0';
        } else {
          dayClass += 'day-future';
          backgroundColor = '#fafafa';
          textColor = '#bdbdbd';
          borderColor = '#eeeeee';
        }
      }
      
      if (isToday) {
        dayClass += ' day-current';
        borderColor = '#2196f3';
      }
      
      const title = record ? `${record.status} - Check In: ${this.formatTime(record.checkIn)}, Check Out: ${this.formatTime(record.checkOut)}` : 'No record';
      
      calendarHTML += `
        <div class="${dayClass}" 
             style="background-color: ${backgroundColor}; color: ${textColor}; border: 1px solid ${borderColor};"
             title="${title}">
          ${day}
        </div>
      `;
    }
    
    setTimeout(() => {
      const calendar = document.getElementById('monthCalendar');
      if (calendar) {
        calendar.innerHTML = calendarHTML;
      }
    }, 0);
  }

  /**
   * Format time to 12-hour format
   */
  formatTime(dateString: string | null): string {
    if (!dateString) return '-';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  }

  /**
   * Format date
   */
  formatDate(dateString: string): string {
    if (!dateString) return '-';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    
    return date.toLocaleDateString('en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  /**
   * Get day name from date string
   */
  getDayName(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  }

  /**
   * Calculate working hours
   */
  getWorkingHours(checkIn: string | null, checkOut: string | null): string {
    if (!checkIn || !checkOut) return '0h 0m';
    
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return '0h 0m';
    }
    
    const diffMs = end.getTime() - start.getTime();
    if (diffMs < 0) return '0h 0m';
    
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${diffHours}h ${diffMinutes}m`;
  }

  /**
   * Get status badge class
   */
  getStatusBadgeClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'ontime':
        return 'badge-light-success';
      case 'absent':
      case 'sick':
        return 'badge-light-dark';
      case 'late':
        return 'badge-light-danger';
      case 'leave':
      case 'holiday':
        return 'badge-light-info';
      default:
        return 'badge-light-warning';
    }
  }

  /**
   * Get working hours badge class
   */
  getWorkingHoursBadgeClass(hours: number): string {
    if (hours >= 8) return 'badge-light-success';
    if (hours >= 6) return 'badge-light-warning';
    return 'badge-light-danger';
  }

  /**
   * Get progress bar class
   */
  getProgressBarClass(hours: number): string {
    if (hours >= 8) return 'bg-success';
    if (hours >= 6) return 'bg-warning';
    return 'bg-danger';
  }

  /**
   * Calculate hours as decimal
   */
  calculateHoursDecimal(checkIn: string | null, checkOut: string | null): number {
    if (!checkIn || !checkOut) return 0;
    
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    
    const diffMs = end.getTime() - start.getTime();
    if (diffMs < 0) return 0;
    
    return diffMs / (1000 * 60 * 60);
  }

  setupTableClickHandlers(): void {
    setTimeout(() => {
      const table = document.querySelector('#kt_attendance_table');
      if (table) {
        table.addEventListener('click', (event: Event) => {
          const target = event.target as HTMLElement;
          const button = target.closest('button') as HTMLElement;
          
          if (button) {
            const action = button.getAttribute('data-action');
            const mouseEvent = event as MouseEvent;
            
            Object.defineProperty(mouseEvent, 'currentTarget', {
              writable: false,
              value: button
            });
            
            if (action === 'edit' || button.classList.contains('edit-btn')) {
              event.preventDefault();
              this.editRow(mouseEvent);
            } else if (action === 'save' || button.classList.contains('save-btn')) {
              event.preventDefault();
              this.saveRow(mouseEvent);
            } else if (action === 'cancel' || button.classList.contains('btn-light-danger')) {
              event.preventDefault();
              this.cancelEdit(mouseEvent);
            }
          }
        });
      }
    }, 100);
  }

  initDateRangePicker(): void {
    const picker = $('#kt_ecommerce_report_views_daterangepicker');
    
    if (!picker.length) return;
    
    picker.daterangepicker({
      autoUpdateInput: false,
      locale: {
        format: 'YYYY-MM-DD',
        separator: ' - ',
        applyLabel: 'Apply',
        cancelLabel: 'Cancel',
      },
      ranges: {
        'Today': [moment(), moment()],
        'Yesterday': [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
        'Last 7 Days': [moment().subtract(6, 'days'), moment()],
        'Last 30 Days': [moment().subtract(29, 'days'), moment()],
        'This Month': [moment().startOf('month'), moment().endOf('month')],
        'Last Month': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
      }
    });

    picker.on('apply.daterangepicker', (ev: any, picker: any) => {
      $(ev.currentTarget).val(picker.startDate.format('YYYY-MM-DD') + ' - ' + picker.endDate.format('YYYY-MM-DD'));
    });

    picker.on('cancel.daterangepicker', (ev: any) => {
      $(ev.currentTarget).val('');
    });
  }

  editRow(event: MouseEvent): void {
    const btn = event.currentTarget as HTMLElement;
    const row = btn.closest('tr');
    if (!row) return;
    
    if (this.currentEditingRow && this.currentEditingRow !== row) {
      const dummyEvent = { currentTarget: this.currentEditingRow } as any;
      this.cancelEdit(dummyEvent);
    }
    
    this.currentEditingRow = row;
    
    const clockInCell = row.querySelector('[data-field="clockIn"]');
    const clockOutCell = row.querySelector('[data-field="clockOut"]');
    
    if (clockInCell && clockOutCell) {
      this.originalValues = {
        clockIn: clockInCell.querySelector('.time-display')?.textContent || '',
        clockOut: clockOutCell.querySelector('.time-display')?.textContent || ''
      };
      
      this.makeEditable(clockInCell, 'clockIn');
      this.makeEditable(clockOutCell, 'clockOut');
    }
    
    btn.innerHTML = `
      <i class="ki-duotone ki-check fs-5">
        <span class="path1"></span>
        <span class="path2"></span>
      </i>
      Save
    `;
    btn.className = 'btn btn-sm btn-success save-btn';
    btn.setAttribute('data-action', 'save');
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-sm btn-light-danger ms-2';
    cancelBtn.innerHTML = `
      <i class="ki-duotone ki-cross fs-5">
        <span class="path1"></span>
        <span class="path2"></span>
      </i>
      Cancel
    `;
    cancelBtn.setAttribute('data-action', 'cancel');
    btn.parentNode?.appendChild(cancelBtn);
  }

  makeEditable(cell: Element, field: string): void {
    const displaySpan = cell.querySelector('.time-display');
    const currentValue = displaySpan?.textContent || '';
    
    const input = document.createElement('input');
    input.type = 'time';
    input.className = 'time-input form-control form-control-sm';
    
    if (currentValue !== '-') {
      const time24 = this.convertTo24Hour(currentValue);
      input.value = time24;
    }
    
    if (displaySpan) {
      (displaySpan as HTMLElement).style.display = 'none';
    }
    const editIcon = cell.querySelector('.edit-icon');
    if (editIcon) {
      (editIcon as HTMLElement).style.display = 'none';
    }
    cell.appendChild(input);
    input.focus();
  }

  convertTo24Hour(time12h: string): string {
    if (time12h === '-') return '';
    
    const parts = time12h.split(' ');
    const time = parts[0];
    const modifier = parts[1];
    
    let [hours, minutes] = time.split(':');
    
    if (hours === '12') {
      hours = '00';
    }
    
    if (modifier === 'PM') {
      hours = (parseInt(hours, 10) + 12).toString();
    }
    
    return `${hours.padStart(2, '0')}:${minutes}`;
  }

  convertTo12Hour(time24h: string): string {
    if (!time24h) return '-';
    
    let [hoursStr, minutes] = time24h.split(':');
    let hours = parseInt(hoursStr, 10);
    
    const modifier = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    
    return `${hours.toString().padStart(2, '0')}:${minutes} ${modifier}`;
  }

  calculateWorkingHours(clockIn: string, clockOut: string): any {
    if (clockIn === '-' || clockOut === '-' || !clockIn || !clockOut) {
      return { hours: 0, minutes: 0, total: 0 };
    }
    
    const start = moment(clockIn, 'HH:mm');
    const end = moment(clockOut, 'HH:mm');
    
    const duration = moment.duration(end.diff(start));
    const hours = Math.floor(duration.asHours());
    const minutes = Math.floor(duration.asMinutes() % 60);
    const totalHours = duration.asHours();
    
    return { hours, minutes, total: totalHours };
  }

  updateWorkingHours(row: Element, clockIn: string, clockOut: string): void {
    const workingHours = this.calculateWorkingHours(clockIn, clockOut);
    const hoursDisplay = row.querySelector('.working-hours');
    const progressBar = row.querySelector('.working-hours-bar');
    
    if (hoursDisplay && workingHours.total > 0) {
      hoursDisplay.textContent = `${workingHours.hours}h ${workingHours.minutes}m`;
      
      const percentage = (workingHours.total / 8) * 100;
      
      if (progressBar) {
        (progressBar as HTMLElement).style.width = `${Math.min(percentage, 120)}%`;
        
        progressBar.className = 'progress-bar working-hours-bar';
        if (workingHours.total >= 8) {
          progressBar.classList.add('bg-success');
          hoursDisplay.className = 'badge badge-light-success fs-7 fw-bold mb-2 working-hours';
        } else if (workingHours.total >= 6) {
          progressBar.classList.add('bg-warning');
          hoursDisplay.className = 'badge badge-light-warning fs-7 fw-bold mb-2 working-hours';
        } else {
          progressBar.classList.add('bg-danger');
          hoursDisplay.className = 'badge badge-light-danger fs-7 fw-bold mb-2 working-hours';
        }
      }
    } else if (hoursDisplay) {
      hoursDisplay.textContent = '0h 0m';
      hoursDisplay.className = 'badge badge-light fs-7 fw-bold working-hours';
    }
  }

  saveRow(event: MouseEvent): void {
    const btn = event.currentTarget as HTMLElement;
    const row = btn.closest('tr');
    if (!row) return;
    
    const clockInCell = row.querySelector('[data-field="clockIn"]');
    const clockOutCell = row.querySelector('[data-field="clockOut"]');
    
    const clockInInput = clockInCell?.querySelector('.time-input') as HTMLInputElement;
    const clockOutInput = clockOutCell?.querySelector('.time-input') as HTMLInputElement;
    
    const newClockIn = clockInInput ? clockInInput.value : '';
    const newClockOut = clockOutInput ? clockOutInput.value : '';
    
    const clockIn12 = this.convertTo12Hour(newClockIn);
    const clockOut12 = this.convertTo12Hour(newClockOut);
    
    if (clockInCell) {
      const timeDisplay = clockInCell.querySelector('.time-display');
      if (timeDisplay) timeDisplay.textContent = clockIn12;
    }
    if (clockOutCell) {
      const timeDisplay = clockOutCell.querySelector('.time-display');
      if (timeDisplay) timeDisplay.textContent = clockOut12;
    }
    
    if (clockInInput) clockInInput.remove();
    if (clockOutInput) clockOutInput.remove();
    
    if (clockInCell) {
      const timeDisplay = clockInCell.querySelector('.time-display') as HTMLElement;
      const editIcon = clockInCell.querySelector('.edit-icon') as HTMLElement;
      if (timeDisplay) timeDisplay.style.display = '';
      if (editIcon) editIcon.style.display = '';
    }
    if (clockOutCell) {
      const timeDisplay = clockOutCell.querySelector('.time-display') as HTMLElement;
      const editIcon = clockOutCell.querySelector('.edit-icon') as HTMLElement;
      if (timeDisplay) timeDisplay.style.display = '';
      if (editIcon) editIcon.style.display = '';
    }
    
    this.updateWorkingHours(row, newClockIn, newClockOut);
    
    btn.innerHTML = `
      <i class="ki-duotone ki-pencil fs-5">
        <span class="path1"></span>
        <span class="path2"></span>
      </i>
      Edit
    `;
    btn.className = 'btn btn-sm btn-light-primary edit-btn';
    btn.setAttribute('data-action', 'edit');
    
    const cancelBtn = row.querySelector('.btn-light-danger');
    if (cancelBtn) cancelBtn.remove();
    
    this.currentEditingRow = null;
    
    if (typeof toastr !== 'undefined') {
      toastr.success('Changes saved successfully!');
    }
  }

  cancelEdit(event: MouseEvent | Element): void {
    const row = event instanceof MouseEvent 
      ? (event.currentTarget as HTMLElement).closest('tr')
      : event as Element;
      
    if (!row) return;
    
    const clockInCell = row.querySelector('[data-field="clockIn"]');
    const clockOutCell = row.querySelector('[data-field="clockOut"]');
    
    const inputs = row.querySelectorAll('.time-input');
    inputs.forEach(input => input.remove());
    
    if (clockInCell) {
      const timeDisplay = clockInCell.querySelector('.time-display') as HTMLElement;
      const editIcon = clockInCell.querySelector('.edit-icon') as HTMLElement;
      if (timeDisplay) timeDisplay.style.display = '';
      if (editIcon) editIcon.style.display = '';
    }
    if (clockOutCell) {
      const timeDisplay = clockOutCell.querySelector('.time-display') as HTMLElement;
      const editIcon = clockOutCell.querySelector('.edit-icon') as HTMLElement;
      if (timeDisplay) timeDisplay.style.display = '';
      if (editIcon) editIcon.style.display = '';
    }
    
    const btn = row.querySelector('.save-btn');
    if (btn) {
      btn.innerHTML = `
        <i class="ki-duotone ki-pencil fs-5">
          <span class="path1"></span>
          <span class="path2"></span>
        </i>
        Edit
      `;
      btn.className = 'btn btn-sm btn-light-primary edit-btn';
      btn.setAttribute('data-action', 'edit');
    }
    
    const cancelBtn = row.querySelector('.btn-light-danger');
    if (cancelBtn) cancelBtn.remove();
    
    this.currentEditingRow = null;
  }
}