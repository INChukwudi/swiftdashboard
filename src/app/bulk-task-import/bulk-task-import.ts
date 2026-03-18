// src/app/bulk-task-import/bulk-task-import.ts
import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, from, EMPTY } from 'rxjs';
import { takeUntil, concatMap, bufferCount, catchError } from 'rxjs/operators';
import { TaskService } from '../services/task.service';

export interface BulkTaskItem {
  project: string;
  title: string;
  description: string;
  department: string;
  category: string;
  startDate: string;
  dueDate: string;
  priority?: 'Low' | 'Medium' | 'High';
  recurrence?: 'OneTime' | 'Daily' | 'Weekly' | 'BiWeekly' | 'Monthly' | 'Quarterly';
  collaborators?: string[];
  subtasks?: { title: string }[];
}

export type TaskStatus = 'pending' | 'running' | 'success' | 'failed';

export interface TaskRow {
  index: number;
  raw: BulkTaskItem;
  status: TaskStatus;
  error?: string;
  resolvedProjectId?: string;
  resolvedCategoryId?: string;
  resolvedCollaboratorIds?: string[];
}

interface ApiDepartment { id: string; name: string; }
interface ApiCategory   { id: string; title: string; department: string; }
interface ApiEmployee   { id: string; firstName: string; lastName: string; email: string; }
interface ApiProject    { id: string; title?: string; name?: string; }

const BATCH_SIZE = 5;

@Component({
  selector: 'app-bulk-task-import',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bulk-task-import.html',
  styleUrls: ['./bulk-task-import.scss']
})
export class BulkTaskImportComponent implements OnInit, OnDestroy {

  @Output() importComplete = new EventEmitter<{ success: number; failed: number }>();

  step: 'input' | 'preview' | 'running' | 'done' = 'input';
  jsonInput   = '';
  jsonError   = '';
  taskRows: TaskRow[] = [];
  isRunning   = false;

  totalTasks     = 0;
  completedCount = 0;
  successCount   = 0;
  failedCount    = 0;

  projects:    ApiProject[]    = [];
  departments: ApiDepartment[] = [];
  categories:  ApiCategory[]   = [];
  employees:   ApiEmployee[]   = [];
  isLoadingMeta = false;
  metaError     = '';

  private destroy$ = new Subject<void>();

  readonly sampleJson = JSON.stringify([
    {
      project: "Project Alpha",
      title: "Design landing page",
      description: "Create mockup and responsive design for the landing page",
      department: "Engineering",
      category: "Frontend",
      startDate: "2025-03-01",
      dueDate: "2025-03-15",
      priority: "High",
      recurrence: "OneTime",
      collaborators: ["jane.doe@company.com"],
      subtasks: [
        { title: "Create wireframes" },
        { title: "Build HTML/CSS layout" }
      ]
    },
    {
      project: "Project Beta",
      title: "Write API documentation",
      description: "Document all REST endpoints with request/response examples",
      department: "Engineering",
      category: "Backend",
      startDate: "2025-03-05",
      dueDate: "2025-03-20",
      priority: "Medium",
      recurrence: "OneTime",
      collaborators: []
    }
  ], null, 2);

  constructor(private taskService: TaskService) {}

  ngOnInit(): void {
    this.loadMetadata();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadMetadata(): void {
    this.isLoadingMeta = true;
    this.metaError = '';

    const flatten = (r: any): any[] => r?.data?.pageData ?? r?.data ?? [];

    Promise.all([
      this.taskService.getProjects().toPromise(),
      this.taskService.getDepartments().toPromise(),
      this.taskService.getCategories().toPromise(),
      this.taskService.getEmployees().toPromise(),
    ]).then(([p, d, c, e]) => {
      this.projects    = flatten(p);
      this.departments = flatten(d);
      this.categories  = flatten(c);
      this.employees   = flatten(e);
      this.isLoadingMeta = false;
      console.log(`Metadata loaded — projects:${this.projects.length} depts:${this.departments.length} cats:${this.categories.length} employees:${this.employees.length}`);
    }).catch(err => {
      console.error('Failed to load metadata', err);
      this.metaError = 'Could not load lookup data. Check your connection or auth token.';
      this.isLoadingMeta = false;
    });
  }

  private resolveProjectId(val: string): string | undefined {
    if (!val) return undefined;
    return this.projects.find(p =>
      p.id === val ||
      (p.title || p.name || '').toLowerCase() === val.toLowerCase()
    )?.id;
  }

  private resolveCategoryId(catVal: string, deptVal: string): string | undefined {
    if (!catVal) return undefined;
    const dept = this.departments.find(d =>
      d.id === deptVal || d.name.toLowerCase() === deptVal.toLowerCase()
    );
    const deptName = dept?.name;
    return this.categories.find(c => {
      const titleMatch = c.title.toLowerCase() === catVal.toLowerCase() || c.id === catVal;
      const deptMatch  = deptName ? c.department === deptName : true;
      return titleMatch && deptMatch;
    })?.id;
  }

  private resolveEmployeeId(val: string): string | undefined {
    if (!val) return undefined;
    return this.employees.find(e =>
      e.id === val ||
      e.email.toLowerCase() === val.toLowerCase() ||
      `${e.firstName} ${e.lastName}`.toLowerCase() === val.toLowerCase()
    )?.id;
  }

  resolveCollabResolved(row: TaskRow, collab: string): boolean {
    const id = this.resolveEmployeeId(collab);
    return !!id && (row.resolvedCollaboratorIds || []).includes(id);
  }

  parseAndPreview(): void {
    this.jsonError = '';

    if (!this.jsonInput.trim()) {
      this.jsonError = 'Please paste your JSON array of tasks.';
      return;
    }

    let parsed: any[];
    try {
      parsed = JSON.parse(this.jsonInput);
    } catch (e: any) {
      this.jsonError = `Invalid JSON — ${e.message}`;
      return;
    }

    if (!Array.isArray(parsed)) {
      this.jsonError = 'JSON must be an array: [ {...}, {...} ]';
      return;
    }

    if (parsed.length === 0) {
      this.jsonError = 'The array is empty — add at least one task.';
      return;
    }

    const validationErrors: string[] = [];
    const rows: TaskRow[] = [];

    parsed.forEach((raw, i) => {
      const rowNum = i + 1;
      const missing: string[] = [];

      // project is optional
      if (!raw.title)       missing.push('title');
      if (!raw.description) missing.push('description');
      if (!raw.department)  missing.push('department');
      if (!raw.category)    missing.push('category');
      if (!raw.startDate)   missing.push('startDate');
      if (!raw.dueDate)     missing.push('dueDate');

      if (missing.length) {
        validationErrors.push(`Row ${rowNum} — missing: ${missing.join(', ')}`);
      }

      const resolvedProjectId       = raw.project ? this.resolveProjectId(raw.project) : undefined;
      const resolvedCategoryId      = this.resolveCategoryId(raw.category, raw.department);
      const resolvedCollaboratorIds = (raw.collaborators || [])
        .map((c: string) => this.resolveEmployeeId(c))
        .filter(Boolean) as string[];

      if (!resolvedProjectId && raw.project) {
        validationErrors.push(`Row ${rowNum} — project "${raw.project}" not found`);
      }
      if (!resolvedCategoryId && raw.category) {
        validationErrors.push(`Row ${rowNum} — category "${raw.category}" not found for dept "${raw.department}"`);
      }

      rows.push({
        index: rowNum,
        raw,
        status: 'pending',
        resolvedProjectId,
        resolvedCategoryId,
        resolvedCollaboratorIds
      });
    });

    if (validationErrors.length) {
      this.jsonError = validationErrors.join('\n');
      this.taskRows = [];
      return;
    }

    this.taskRows   = rows;
    this.totalTasks = rows.length;
    this.step = 'preview';
  }

  startImport(): void {
    if (this.isRunning || !this.taskRows.length) return;

    this.isRunning      = true;
    this.completedCount = 0;
    this.successCount   = 0;
    this.failedCount    = 0;
    this.step = 'running';

    from(this.taskRows)
      .pipe(
        bufferCount(BATCH_SIZE),
        concatMap(batch =>
          from(batch).pipe(
            concatMap(row => this.submitRow(row))
          )
        ),
        takeUntil(this.destroy$)
      )
      .subscribe({
        complete: () => {
          this.isRunning = false;
          this.step = 'done';
          this.importComplete.emit({ success: this.successCount, failed: this.failedCount });
        }
      });
  }

  private submitRow(row: TaskRow) {
    row.status = 'running';
    const payload = this.buildPayload(row);

    if (!row.resolvedProjectId) {
      row.status = 'failed';
      row.error  = 'No project ID — please set a project name in your JSON or select a default project';
      this.failedCount++;
      this.completedCount++;
      return EMPTY;
    }
    return this.taskService.createTask(row.resolvedProjectId, payload)
      .pipe(
        takeUntil(this.destroy$),
        concatMap((response: any) => {
          if (response?.ok || response?.success || response?.data?.id) {
            row.status = 'success';
            this.successCount++;
          } else {
            row.status = 'failed';
            row.error  = 'Unexpected response from server';
            this.failedCount++;
          }
          this.completedCount++;
          return EMPTY;
        }),
        catchError(err => {
          row.status = 'failed';
          row.error  = err?.error?.message || err?.message || 'Unknown error';
          this.failedCount++;
          this.completedCount++;
          return EMPTY;
        })
      );
  }

  private buildPayload(row: TaskRow): any {
    const r = row.raw;
    const payload: any = {
      title:           r.title,
      description:     r.description,
      status:          'NotStarted',
      priority:        r.priority   || '',
      recurrence:      r.recurrence || 'OneTime',
      startDate:       new Date(r.startDate).toISOString(),
      dueDate:         new Date(r.dueDate).toISOString(),
      categoryId:      row.resolvedCategoryId,
      collaboratorsId: row.resolvedCollaboratorIds || []
    };

    if (r.subtasks?.length) {
      payload.subtasks = r.subtasks.map(s => ({ title: s.title, completed: false }));
    }

    return payload;
  }

  get progressPercent(): number {
    if (!this.totalTasks) return 0;
    return Math.round((this.completedCount / this.totalTasks) * 100);
  }

  removeRow(index: number): void {
    this.taskRows.splice(index, 1);
    this.taskRows.forEach((r, i) => r.index = i + 1);
    this.totalTasks = this.taskRows.length;
  }

  resetAll(): void {
    this.step           = 'input';
    this.jsonInput      = '';
    this.jsonError      = '';
    this.taskRows       = [];
    this.totalTasks     = 0;
    this.completedCount = 0;
    this.successCount   = 0;
    this.failedCount    = 0;
    this.isRunning      = false;
  }

  loadSample(): void {
    this.jsonInput = this.sampleJson;
    this.jsonError = '';
  }

  copyTemplate(): void {
    navigator.clipboard?.writeText(this.sampleJson);
  }

  getSubtaskTitles(subtasks: { title: string }[] | undefined): string {
    return subtasks?.map((s, i) => `${i + 1}. ${s.title}`).join('\n') || '';
  }

  statusClass(status: TaskStatus): string {
    const map: Record<TaskStatus, string> = {
      pending: 'badge-secondary',
      running: 'badge-primary',
      success: 'badge-success',
      failed:  'badge-danger'
    };
    return map[status];
  }

  trackByIndex(_: number, row: TaskRow): number {
    return row.index;
  }
}