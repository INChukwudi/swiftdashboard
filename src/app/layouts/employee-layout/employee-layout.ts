import { Component } from '@angular/core';
import { RouterModule, RouterOutlet, } from '@angular/router';
import { EmployeeSidebar } from '../../employee-sidebar/employee-sidebar';

@Component({
  selector: 'app-employee-layout',
  standalone: true,
  imports: [
    EmployeeSidebar,
    RouterOutlet,
    RouterModule, 
   
  ],
  templateUrl: './employee-layout.html',
  styleUrls: ['./employee-layout.scss']
})
export class EmployeeLayout {}
