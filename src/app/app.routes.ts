import { Routes } from '@angular/router';

// Auth
import { SigninComponent } from './signin/signin';

// Layouts
import { AdminLayout } from './layouts/admin-layout/admin-layout';
import { EmployeeLayout } from './layouts/employee-layout/employee-layout';

// Admin pages
import { AdminDashboard } from './admin-dashboard/admin-dashboard';
import { AllEmployees } from './all-employees/all-employees';
import { Ranking } from './ranking/ranking';
import { Staffprofile } from './staffprofile/staffprofile';
import { Alltask } from './alltask/alltask';
import { Attendance } from './attendance/attendance';
import { Attenreport } from './attenreport/attenreport';
import { Department } from './department/department';
import { Adminproject } from './adminproject/adminproject';
import { Adminviewproject } from './adminviewproject/adminviewproject';
import { InnovationComponent } from './innovation/innovation';
import { Adminsettings } from './adminsettings/adminsettings';

// Employee pages
import { DashboardEmployeeComponent } from './dashboard-employee/dashboard-employee';
import { Task } from './task/task';
import { Project } from './project/project';
import { Viewproject } from './viewproject/viewproject';
import { Myattendance } from './myattendance/myattendance';
import { Profile } from './profile/profile';

export const routes: Routes = [
  // ================= AUTH =================
  { path: '', component: SigninComponent },
  { path: 'signin', component: SigninComponent },

  // ================= ADMIN =================
  {
    path: 'admin',
    component: AdminLayout,
    children: [
      { path: '', component: AdminDashboard },
      { path: 'allemployees', component: AllEmployees },
      { path: 'alltasks', component: Alltask },
      { path: 'ranking', component: Ranking },
      { path: 'staffprofile', component: Staffprofile },
      { path: 'attendance', component: Attendance },
      { path: 'attenreport/:employeeId', component: Attenreport },
      { path: 'department', component: Department },
      { path: 'projects', component: Adminproject },
      { path: 'projects/:projectId', component: Adminviewproject },
      { path: 'innovation', component: InnovationComponent },
      { path: 'settings', component: Adminsettings },
    ],
  },

  // ================= EMPLOYEE =================
  {
    path: 'employee',
    component: EmployeeLayout,
    children: [
      { path: '', component: DashboardEmployeeComponent },
      { path: 'task', component: Task },
      { path: 'projects', component: Project },
      { path: 'projects/:projectId', component: Viewproject },
      { path: 'innovation', component: InnovationComponent },
      { path: 'myattendance', component: Myattendance},
      { path: 'profile', component: Profile}
    ],
  },

  { path: '**', redirectTo: '' },
];

