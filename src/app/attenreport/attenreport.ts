import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil, forkJoin, interval } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

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
  job?: string;
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

interface EmployeeRankData {
  id: string;
  firstName: string;
  lastName: string;
  monthlyAttendancePoint: number;
  monthlyTaskPoint: number;
  monthlyExtraPoint: number;
  monthlyPenaltyPoint: number;
  monthlyPoint: number;
  monthlyRank: number;
  dailyAttendancePoint: number;
  dailyTaskPoint: number;
  dailyPoint: number;
  dailyRank: number;
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
export class Attenreport implements OnInit, OnDestroy {
  private apiUrl = 'https://pixels-office-server.azurewebsites.net/v1';
  private destroy$ = new Subject<void>();
  private liveUpdateInterval$ = new Subject<void>();

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
  
  // Today's attendance data
  todayAttendance: AttendanceRecord | null = null;
  todayCheckInTime: string = '';
  todayCheckOutTime: string = '';
  isClockedIn: boolean = false;
  todayStatus: string = 'Not Checked In';
  
  // Live working hours calculation
  liveWorkingHours: number = 0;
  liveWorkingMinutes: number = 0;
  liveAttendancePoints: number = 0;
  liveWorkingHoursDisplay: string = '0h 0m';
  
  // Monthly attendance points from rank API
  monthlyAttendancePoints: number = 0;
  employeeRankData: EmployeeRankData | null = null;
  
  // Progress tracking
  monthlyTargetPoints: number = 400;
  progressPercentage: number = 0;
  pointsToTarget: number = 0;
  
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
    this.stopLiveUpdates();
  }

  /**
   * Load employee data and attendance in parallel
   */
  loadEmployeeAndAttendanceData(): void {
    this.loading = true;
    this.error = null;

    // Load employee profile, attendance data, and rank data
    forkJoin({
      employee: this.loadEmployeeProfile(),
      stats: this.loadAttendanceStats(),
      records: this.loadAttendanceRecords(),
      rank: this.loadEmployeeRankData()
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (results) => {
          this.employee = results.employee;
          this.attendanceStatsData = results.stats;
          this.employeeRankData = results.rank;
          
          // Set monthly attendance points from rank API
          if (results.rank) {
            this.monthlyAttendancePoints = results.rank.monthlyAttendancePoint || 0;
            this.calculateProgress();
          }
          
          // Handle paginated response
          if (results.records && results.records.pageData) {
            this.attendanceRecords = results.records.pageData;
            this.processTodayAttendance();
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
   * Load employee rank data (contains monthly attendance points)
   */
  loadEmployeeRankData() {
    const url = `${this.apiUrl}/employee/rank`;
    
    return this.http.get<ApiResponse<{ pageData: EmployeeRankData[] }>>(url)
      .pipe(
        takeUntil(this.destroy$),
        map((response) => {
          if (response.ok && response.data && response.data.pageData) {
            // Find the current employee in the rank data
            const employeeRank = response.data.pageData.find(
              (emp: EmployeeRankData) => emp.id === this.employeeId
            );
            return employeeRank || null;
          } else {
            throw new Error(response.error || 'Failed to load rank data');
          }
        })
      );
  }

  /**
   * Process today's attendance from the records
   */
  processTodayAttendance(): void {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    
    // Find today's attendance record
    this.todayAttendance = this.attendanceRecords.find(record => {
      const recordDate = new Date(record.date).toISOString().slice(0, 10);
      return recordDate === todayStr;
    }) || null;
    
    if (this.todayAttendance) {
      // Set today's check-in time
      if (this.todayAttendance.checkIn) {
        this.todayCheckInTime = this.formatTime(this.todayAttendance.checkIn);
        this.isClockedIn = true;
        this.todayStatus = this.todayAttendance.status || 'Present';
      }
      
      // Set today's check-out time
      if (this.todayAttendance.checkOut) {
        this.todayCheckOutTime = this.formatTime(this.todayAttendance.checkOut);
        this.isClockedIn = false; // Already clocked out
      }
      
      // Start live updates if clocked in but not clocked out
      if (this.todayAttendance.checkIn && !this.todayAttendance.checkOut) {
        this.startLiveUpdates();
      } else if (this.todayAttendance.checkIn && this.todayAttendance.checkOut) {
        // Calculate final working hours for the day
        this.calculateWorkingHoursAndPoints(
          this.todayAttendance.checkIn,
          this.todayAttendance.checkOut
        );
      }
    } else {
      // No attendance record for today
      this.todayCheckInTime = '';
      this.todayCheckOutTime = '';
      this.isClockedIn = false;
      this.todayStatus = 'Not Checked In';
      this.liveWorkingHours = 0;
      this.liveWorkingMinutes = 0;
      this.liveAttendancePoints = 0;
      this.liveWorkingHoursDisplay = '0h 0m';
    }
  }

  /**
   * Start live updates for working hours calculation
   */
  startLiveUpdates(): void {
    this.stopLiveUpdates(); // Clear any existing interval
    
    // Update immediately
    this.updateLiveWorkingHours();
    
    // Update every minute
    interval(60000)
      .pipe(takeUntil(this.liveUpdateInterval$))
      .subscribe(() => {
        this.updateLiveWorkingHours();
      });
  }

  /**
   * Stop live updates
   */
  stopLiveUpdates(): void {
    this.liveUpdateInterval$.next();
  }

  /**
   * Update live working hours and points
   */
  updateLiveWorkingHours(): void {
    if (!this.todayAttendance?.checkIn) return;
    
    const now = new Date();
    const checkInTime = new Date(this.todayAttendance.checkIn);
    
    // Calculate difference in milliseconds
    const diffMs = now.getTime() - checkInTime.getTime();
    if (diffMs < 0) return;
    
    // Convert to hours and minutes
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    this.liveWorkingHours = Math.floor(totalMinutes / 60);
    this.liveWorkingMinutes = totalMinutes % 60;
    
    // Calculate attendance points (1 hour = 1 point)
    this.liveAttendancePoints = parseFloat((totalMinutes / 60).toFixed(2));
    
    // Update display string
    this.liveWorkingHoursDisplay = `${this.liveWorkingHours}h ${this.liveWorkingMinutes}m`;
  }

  /**
   * Calculate working hours and points from check-in and check-out times
   */
  calculateWorkingHoursAndPoints(checkIn: string, checkOut: string): void {
    if (!checkIn || !checkOut) return;
    
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    
    const diffMs = end.getTime() - start.getTime();
    if (diffMs < 0) return;
    
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    this.liveWorkingHours = Math.floor(totalMinutes / 60);
    this.liveWorkingMinutes = totalMinutes % 60;
    
    // Calculate attendance points (1 hour = 1 point)
    this.liveAttendancePoints = parseFloat((totalMinutes / 60).toFixed(2));
    
    this.liveWorkingHoursDisplay = `${this.liveWorkingHours}h ${this.liveWorkingMinutes}m`;
  }

  /**
   * Calculate progress towards monthly target
   */
  calculateProgress(): void {
    this.progressPercentage = Math.min(
      Math.round((this.monthlyAttendancePoints / this.monthlyTargetPoints) * 100),
      100
    );
    this.pointsToTarget = Math.max(
      this.monthlyTargetPoints - this.monthlyAttendancePoints,
      0
    );
  }

  /**
   * Get today's status badge class
   */
  getTodayStatusBadgeClass(): string {
    if (!this.todayAttendance) {
      return 'bg-light-secondary text-secondary';
    }
    
    switch (this.todayStatus.toLowerCase()) {
      case 'ontime':
      case 'present':
        return 'bg-light-success text-success';
      case 'late':
        return 'bg-light-warning text-warning';
      case 'absent':
        return 'bg-light-danger text-danger';
      default:
        return 'bg-light-info text-info';
    }
  }

  /**
   * Get display text for today's status
   */
  getTodayStatusDisplay(): string {
    if (!this.todayAttendance) {
      return 'Not Checked In';
    }
    
    switch (this.todayStatus.toLowerCase()) {
      case 'ontime':
        return 'Present (On Time)';
      case 'late':
        return 'Present (Late)';
      case 'absent':
        return 'Absent';
      default:
        return this.todayStatus;
    }
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
   * Calculate attendance points for a record (1 hour = 1 point)
   */
  getAttendancePoints(checkIn: string | null, checkOut: string | null): number {
    if (!checkIn || !checkOut) return 0;
    
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    
    const diffMs = end.getTime() - start.getTime();
    if (diffMs < 0) return 0;
    
    return parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
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

  calculateWorkingHoursFromStrings(clockIn: string, clockOut: string): any {
    if (clockIn === '-' || clockOut === '-' || !clockIn || !clockOut) {
      return { hours: 0, minutes: 0, total: 0, points: 0 };
    }
    
    const start = moment(clockIn, 'HH:mm');
    const end = moment(clockOut, 'HH:mm');
    
    const duration = moment.duration(end.diff(start));
    const hours = Math.floor(duration.asHours());
    const minutes = Math.floor(duration.asMinutes() % 60);
    const totalHours = duration.asHours();
    const points = parseFloat(totalHours.toFixed(2)); // 1 hour = 1 point
    
    return { hours, minutes, total: totalHours, points };
  }

  updateWorkingHours(row: Element, clockIn: string, clockOut: string): void {
    const workingHours = this.calculateWorkingHoursFromStrings(clockIn, clockOut);
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

  /**
   * Update attendance record via API
   */
  updateAttendanceRecord(recordId: string, date: string, checkIn: string, checkOut: string): void {
    const url = `${this.apiUrl}/employee/attendance`;
    
    // Build the ISO date strings for the API
    const dateObj = new Date(date);
    const dateISO = dateObj.toISOString();
    
    // Parse the 24-hour time and combine with the date
    const checkInISO = this.buildISODateTime(date, checkIn);
    const checkOutISO = this.buildISODateTime(date, checkOut);
    
    const payload = {
      employeeId: this.employeeId,
      date: dateISO,
      checkIn: checkInISO,
      checkOut: checkOutISO,
      
    };
    
    console.log('Updating attendance with payload:', payload);
    
    this.http.post<ApiResponse<AttendanceRecord>>(url, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.ok) {
            console.log('Attendance updated successfully:', response.data);
            if (typeof toastr !== 'undefined') {
              toastr.success('Attendance record updated successfully!');
            }
            
            // Update the local record
            const index = this.attendanceRecords.findIndex(r => r.id === recordId);
            if (index !== -1 && response.data) {
              this.attendanceRecords[index] = response.data;
            }
            
            // Refresh data to get updated stats
            this.loadAttendanceStats()
              .pipe(takeUntil(this.destroy$))
              .subscribe(stats => {
                this.attendanceStatsData = stats;
                this.updateStatsDisplay();
              });
            
            // Refresh rank data for updated points
            this.loadEmployeeRankData()
              .pipe(takeUntil(this.destroy$))
              .subscribe(rank => {
                if (rank) {
                  this.employeeRankData = rank;
                  this.monthlyAttendancePoints = rank.monthlyAttendancePoint || 0;
                  this.calculateProgress();
                }
              });
          } else {
            console.error('Failed to update attendance:', response.error);
            if (typeof toastr !== 'undefined') {
              toastr.error(response.error || 'Failed to update attendance record');
            }
          }
        },
        error: (err) => {
          console.error('Error updating attendance:', err);
          if (typeof toastr !== 'undefined') {
            toastr.error('Failed to update attendance record. Please try again.');
          }
        }
      });
  }

  /**
   * Build ISO datetime string from date and time (24-hour format)
   */
  buildISODateTime(dateStr: string, time24: string): string {
    if (!time24) return '';
    
    const date = new Date(dateStr);
    const [hours, minutes] = time24.split(':').map(Number);
    
    date.setHours(hours, minutes, 0, 0);
    
    return date.toISOString();
  }

  saveRow(event: MouseEvent): void {
    const btn = event.currentTarget as HTMLElement;
    const row = btn.closest('tr');
    if (!row) return;
    
    // Get the record ID from the row
    const recordId = row.getAttribute('data-row-id');
    
    // Find the record to get additional info (date, status)
    const record = this.attendanceRecords.find(r => r.id === recordId);
    
    const clockInCell = row.querySelector('[data-field="clockIn"]');
    const clockOutCell = row.querySelector('[data-field="clockOut"]');
    
    const clockInInput = clockInCell?.querySelector('.time-input') as HTMLInputElement;
    const clockOutInput = clockOutCell?.querySelector('.time-input') as HTMLInputElement;
    
    const newClockIn = clockInInput ? clockInInput.value : '';
    const newClockOut = clockOutInput ? clockOutInput.value : '';
    
    const clockIn12 = this.convertTo12Hour(newClockIn);
    const clockOut12 = this.convertTo12Hour(newClockOut);
    
    // Call the API to update the attendance record
    if (record && recordId) {
      this.updateAttendanceRecord(
        recordId,
        record.date,
        newClockIn,
        newClockOut,
       
      );
    }
    
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