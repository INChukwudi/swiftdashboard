import { AfterViewInit, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterModule,  RouterLinkActive, } from '@angular/router';

declare const KTMenu: any;

@Component({
  selector: 'app-admin-sidebar',
  imports: [CommonModule, RouterModule, RouterLink, RouterLinkActive ],
  templateUrl: './admin-sidebar.html',
  styleUrls: ['./admin-sidebar.scss'],
})
export class AdminSidebar implements AfterViewInit {
  isEmployeesOpen = false;
  isDepartmentOpen = false;

  toggleEmployees(event: Event) {
    event.preventDefault();
    this.isEmployeesOpen = !this.isEmployeesOpen;
  }

  toggleDepartment(event: Event) {
    event.preventDefault();
    this.isDepartmentOpen = !this.isDepartmentOpen;
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      const menuEl = document.getElementById('kt_app_sidebar_menu');
      if (menuEl && typeof KTMenu !== 'undefined') {
        const existingMenu = KTMenu.getInstance(menuEl);
        if (existingMenu) existingMenu.destroy();

        KTMenu.createInstances(menuEl);
      }
    }, 0);
  }
}

