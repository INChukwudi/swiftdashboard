import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink, RouterModule,  RouterLinkActive, } from '@angular/router';

@Component({
  selector: 'app-employee-sidebar',
  imports: [CommonModule, RouterModule, RouterLink, RouterLinkActive ],
  templateUrl: './employee-sidebar.html',
  styleUrl: './employee-sidebar.scss',
})
export class EmployeeSidebar {

}
