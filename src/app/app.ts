import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TaskDrawer } from "./task-drawer/task-drawer";

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TaskDrawer],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('swiftdashboard');
}
