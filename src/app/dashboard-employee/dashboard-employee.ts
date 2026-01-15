// src/app/dashboard-employee/dashboard-employee.component.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { catchError, forkJoin, of } from 'rxjs';
import { map } from 'rxjs/operators';

interface User {
  firstName?: string;
  lastName?: string;
}

interface DailyProgressResponse {
  ok: boolean;
  data: {
    totalPoint: number;
    monthlyTotalPoint: number;
    rank: number;
    monthlyRank: number;
  };
}

interface AttendanceRecord {
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
}

interface AttendanceReport {
  totalHours: number;
  week: {
    day: string;
    date: string;
    hours: number;
    breakHours: number;
  }[];
  today: {
    hours: number;
  };
}

interface NotificationItem {
  createdAt: string;
  id: string;
  read: boolean;
  metadata: {
    action: string;
    taskId: string;
  };
  imageUrl: string | null;
  body: string;
  type: string;
  title: string;
}

interface NotificationGroup {
  category: string;
  icon: string;
  tasks: {
    title: string;
    description: string;
    priority: string;
    badge: string;
    icon: string;
    due: string;
  }[];
}

interface DisplayAttendance {
  day: string;
  short: string;
  clockIn: string;
  clockOut: string;
  hours: string;
  percentage: number;
  status: 'success' | 'warning' | 'danger';
}

@Component({
  selector: 'app-dashboard-employee',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-employee.html',
  styleUrls: ['./dashboard-employee.scss'],
})
export class DashboardEmployeeComponent implements OnInit, OnDestroy {
  private apiUrl = 'https://pixels-office-server.azurewebsites.net/v1';

  userName = 'User';
  summary = {
    pointToday: 0,
    monthPoint: 0,
    dailyRank: 0,
    monthlyRank: 0,
  };
  progress = {
    attendanceRate: 0,
    daysPresent: 0,
    daysTotal: 0,
  };
  taskStats = {
    completed: 0,
    inProgress: 0,
    overdue: 0,
  };
  notifications: NotificationGroup[] = [];
  attendance: DisplayAttendance[] = [];

  hours = '00';
  minutes = '00';
  seconds = '00';

  totalWeeklyHours = '0h 00m';
  totalTarget = '40h';
  weeklyPercentage = 0;

  currentYear = new Date().getFullYear();

  private timerInterval: any;

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit(): void {
    this.fetchUser();
    this.fetchDailyProgress();
    this.fetchTaskStats();
    this.fetchNotifications();
    this.fetchAttendanceData();
  }

  ngOnDestroy(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  private handleError(err: any, context: string) {
    console.error(`API Error [${context}]:`, err);
    if (err.status === 401) {
      this.logout();
    }
  }

  fetchUser() {
    this.http.get<any>(`${this.apiUrl}/user`)
      .pipe(catchError(err => {
        this.handleError(err, 'fetchUser');
        return of({ ok: false });
      }))
      .subscribe(res => {
        if (res.ok && res.data) {
          this.userName = `${res.data.firstName || ''} ${res.data.lastName || ''}`.trim() || 'User';
        }
      });
  }

  fetchDailyProgress() {
    this.http.get<DailyProgressResponse>(`${this.apiUrl}/user/daily-progress`)
      .pipe(catchError(err => {
        this.handleError(err, 'fetchDailyProgress');
        return of({ ok: false, data: { totalPoint: 0, monthlyTotalPoint: 0, rank: 0, monthlyRank: 0 } });
      }))
      .subscribe(res => {
        if (res.ok && res.data) {
          this.summary = {
            pointToday: Math.floor(res.data.totalPoint) ?? 0,
            monthPoint: Math.round(res.data.monthlyTotalPoint) ?? 0,
            dailyRank: res.data.rank ?? 0,
            monthlyRank: res.data.monthlyRank ?? 0,
          };
        }
      });
  }

  fetchTaskStats() {
    this.http.get<any>(`${this.apiUrl}/user/task/stats`)
      .pipe(catchError(err => {
        this.handleError(err, 'fetchTaskStats');
        return of({ ok: false });
      }))
      .subscribe(res => {
        if (res.ok && res.data?.stats) {
          this.taskStats = {
            completed: res.data.stats.Completed ?? 0,
            inProgress: res.data.stats.InProgress ?? 0,
            overdue: res.data.stats.Overdue ?? 0,
          };
        }
      });
  }

  fetchNotifications() {
    this.http.get<any>(`${this.apiUrl}/user/notification?type=Task`)
      .pipe(catchError(err => {
        this.handleError(err, 'fetchNotifications');
        return of({ ok: false });
      }))
      .subscribe(res => {
        if (res.ok && res.data?.pageData) {
          this.notifications = this.groupNotifications(res.data.pageData);
        }
      });
  }

  private groupNotifications(notifs: NotificationItem[]): NotificationGroup[] {
    const groups: { [key: string]: NotificationGroup } = {};

    notifs.forEach(n => {
      const date = new Date(n.createdAt);
      const today = new Date();
      let category: string;

      if (date.toDateString() === today.toDateString()) {
        category = 'Today';
      } else if (date.getDate() === today.getDate() - 1) {
        category = 'Yesterday';
      } else {
        category = 'Older';
      }

      if (!groups[category]) {
        groups[category] = {
          category,
          icon: category === 'Today' ? 'bi bi-clock' : category === 'Yesterday' ? 'bi bi-calendar-event' : 'bi bi-archive',
          tasks: [],
        };
      }

      const isStatusChange = n.metadata.action === 'StatusChange';
      const isCollaborated = n.metadata.action === 'Collaborated';
      const isComment = n.metadata.action === 'Comment';

      groups[category].tasks.push({
        title: n.title,
        description: n.body,
        priority: isStatusChange ? 'Status Update' : isCollaborated ? 'New Collaboration' : isComment ? 'New Comment' : 'Update',
        badge: isStatusChange ? 'success' : isCollaborated ? 'primary' : isComment ? 'info' : 'secondary',
        icon: isStatusChange ? 'bi bi-check-circle' : isCollaborated ? 'bi bi-people' : isComment ? 'bi bi-chat-dots' : 'bi bi-bell',
        due: this.formatDate(n.createdAt),
      });
    });

    return Object.values(groups).sort((a, b) => {
      if (a.category === 'Today') return -1;
      if (b.category === 'Today') return 1;
      if (a.category === 'Yesterday') return -1;
      if (b.category === 'Yesterday') return 1;
      return 0;
    });
  }

  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  fetchAttendanceData() {
    forkJoin({
      attendance: this.http.get<any>(`${this.apiUrl}/user/attendance?period=Week`)
        .pipe(catchError(err => {
          this.handleError(err, 'fetchAttendance');
          return of({ ok: false, data: { pageData: [] } });
        })),
      report: this.http.get<any>(`${this.apiUrl}/user/attendance/report`)
        .pipe(catchError(err => {
          this.handleError(err, 'fetchAttendanceReport');
          return of({ ok: false, data: { week: [], today: { hours: 0 } } });
        })),
    }).subscribe(({ attendance, report }) => {
      if (attendance.ok && report.ok) {
        const attendanceMap = new Map(attendance.data.pageData.map((rec: AttendanceRecord) => [rec.date.split('T')[0], rec]));

        this.attendance = report.data.week
        .filter((w: any) => ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'].includes(w.day))
        .map((w: any) => {
          const dateKey = w.date.split('T')[0];
          const attRec = attendanceMap.get(dateKey) as AttendanceRecord | undefined;
        
          // Safely get checkIn and checkOut
          const checkIn = attRec?.checkIn ?? null;
          const checkOut = attRec?.checkOut ?? null;
        
          const hoursNum = w.hours || 0;
          const hoursFormatted = this.formatHours(hoursNum);
        
          let status: 'success' | 'warning' | 'danger' = 'danger';
          let percentage = 0;
        
          if (hoursNum >= 8) {
            status = 'success';
            percentage = 100;
          } else if (hoursNum >= 6) {
            status = 'warning';
            percentage = (hoursNum / 8) * 100;
          } else {
            percentage = (hoursNum / 8) * 100;
          }
        
          return {
            day: w.day,
            short: w.day.substring(0, 3).toUpperCase(),
            clockIn: checkIn ? new Date(checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--:--',
            clockOut: checkOut ? new Date(checkOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--:--',
            hours: hoursFormatted,
            percentage: Math.min(100, Math.round(percentage)),
            status,
          };
        });
        // Calculate totals
        const totalHoursNum = report.data.week.reduce((sum: number, w: any) => sum + (w.hours || 0), 0);
        this.totalWeeklyHours = this.formatHours(totalHoursNum);
        this.totalTarget = '40h';
        this.weeklyPercentage = Math.min(100, Math.round((totalHoursNum / 40) * 100));

        // Attendance rate calculation
        const workingDays = report.data.week.filter((w: any) => ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'].includes(w.day)).length;
        const daysPresent = this.attendance.filter(a => a.hours !== '0h 00m').length;
        this.progress = {
          attendanceRate: Math.round((daysPresent / workingDays) * 100),
          daysPresent,
          daysTotal: workingDays,
        };

        // Timer from today.hours
        const todayHours = report.data.today?.hours || 0;
        const [h, m, s] = this.decimalToHMS(todayHours);
        this.hours = h.toString().padStart(2, '0');
        this.minutes = m.toString().padStart(2, '0');
        this.seconds = s.toString().padStart(2, '0');
        this.startTimer();
      }
    });
  }

  private decimalToHMS(decimalHours: number): [number, number, number] {
    const hours = Math.floor(decimalHours);
    const minutes = Math.floor((decimalHours - hours) * 60);
    const seconds = Math.floor((((decimalHours - hours) * 60) - minutes) * 60);
    return [hours, minutes, seconds];
  }

  private formatHours(decimalHours: number): string {
    const hours = Math.floor(decimalHours);
    const minutes = Math.floor((decimalHours - hours) * 60);
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  }

  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      let s = parseInt(this.seconds) + 1;
      let m = parseInt(this.minutes);
      let h = parseInt(this.hours);

      if (s >= 60) { s = 0; m++; }
      if (m >= 60) { m = 0; h++; }

      this.seconds = s.toString().padStart(2, '0');
      this.minutes = m.toString().padStart(2, '0');
      this.hours = h.toString().padStart(2, '0');
    }, 1000);
  }

  logout() {
    localStorage.clear();
    sessionStorage.clear();
    this.router.navigate(['/signin']);
  }
}