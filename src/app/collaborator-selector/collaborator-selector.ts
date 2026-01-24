// src/app/collaborator-selector/collaborator-selector.ts
import { 
  Component, 
  Input, 
  Output, 
  EventEmitter, 
  OnInit, 
  OnDestroy, 
  forwardRef,
  ElementRef,
  HostListener,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';

// Interface for employee/collaborator data
export interface Collaborator {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string | null;
  job?: string | null;
  department?: string | null;
  phoneNumber?: string;
}

@Component({
  selector: 'app-collaborator-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './collaborator-selector.html',
  styleUrl: './collaborator-selector.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CollaboratorSelector),
      multi: true
    }
  ]
})
export class CollaboratorSelector implements OnInit, OnDestroy, ControlValueAccessor {
  
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;
  
  // Input properties
  @Input() employees: Collaborator[] = [];
  @Input() placeholder: string = 'Search and select collaborators...';
  @Input() maxSelections: number = 0; // 0 = unlimited
  @Input() disabled: boolean = false;
  
  // Output events
  @Output() selectionChange = new EventEmitter<string[]>();
  
  // Component state
  isDropdownOpen: boolean = false;
  searchTerm: string = '';
  filteredEmployees: Collaborator[] = [];
  selectedIds: string[] = [];
  selectedCollaborators: Collaborator[] = [];
  highlightedIndex: number = -1;
  
  // RxJS
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();
  
  // ControlValueAccessor callbacks
  private onChange: (value: string[]) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private elementRef: ElementRef) {}

  ngOnInit(): void {
    this.setupSearch();
    this.filteredEmployees = [...this.employees];
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============= SEARCH SETUP =============

  private setupSearch(): void {
    this.searchSubject.pipe(
      debounceTime(200),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(term => {
      this.filterEmployees(term);
    });
  }

  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchTerm = target.value;
    this.searchSubject.next(this.searchTerm);
    
    if (!this.isDropdownOpen) {
      this.openDropdown();
    }
  }

  private filterEmployees(term: string): void {
    if (!term || term.trim() === '') {
      this.filteredEmployees = [...this.employees];
    } else {
      const searchLower = term.toLowerCase().trim();
      this.filteredEmployees = this.employees.filter(emp => {
        const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
        const email = emp.email?.toLowerCase() || '';
        const job = emp.job?.toLowerCase() || '';
        const department = emp.department?.toLowerCase() || '';
        
        return fullName.includes(searchLower) ||
               email.includes(searchLower) ||
               job.includes(searchLower) ||
               department.includes(searchLower);
      });
    }
    this.highlightedIndex = -1;
  }

  // ============= DROPDOWN MANAGEMENT =============

  toggleDropdown(): void {
    if (this.disabled) return;
    
    if (this.isDropdownOpen) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  }

  openDropdown(): void {
    if (this.disabled) return;
    
    this.isDropdownOpen = true;
    this.filteredEmployees = [...this.employees];
    this.highlightedIndex = -1;
    
    // Focus search input after dropdown opens
    setTimeout(() => {
      this.searchInput?.nativeElement?.focus();
    }, 50);
  }

  closeDropdown(): void {
    this.isDropdownOpen = false;
    this.searchTerm = '';
    this.highlightedIndex = -1;
  }

  // Close dropdown when clicking outside
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.closeDropdown();
    }
  }

  // Keyboard navigation
  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (!this.isDropdownOpen) {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
        event.preventDefault();
        this.openDropdown();
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.highlightedIndex = Math.min(
          this.highlightedIndex + 1, 
          this.filteredEmployees.length - 1
        );
        this.scrollToHighlighted();
        break;
        
      case 'ArrowUp':
        event.preventDefault();
        this.highlightedIndex = Math.max(this.highlightedIndex - 1, 0);
        this.scrollToHighlighted();
        break;
        
      case 'Enter':
        event.preventDefault();
        if (this.highlightedIndex >= 0 && this.highlightedIndex < this.filteredEmployees.length) {
          this.toggleSelection(this.filteredEmployees[this.highlightedIndex]);
        }
        break;
        
      case 'Escape':
        event.preventDefault();
        this.closeDropdown();
        break;
    }
  }

  private scrollToHighlighted(): void {
    setTimeout(() => {
      const highlighted = this.elementRef.nativeElement.querySelector('.dropdown-item.highlighted');
      if (highlighted) {
        highlighted.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }, 10);
  }

  // ============= SELECTION MANAGEMENT =============

  toggleSelection(employee: Collaborator): void {
    if (this.disabled) return;
    
    const index = this.selectedIds.indexOf(employee.id);
    
    if (index > -1) {
      // Remove from selection
      this.selectedIds.splice(index, 1);
      this.selectedCollaborators = this.selectedCollaborators.filter(c => c.id !== employee.id);
    } else {
      // Check max selections
      if (this.maxSelections > 0 && this.selectedIds.length >= this.maxSelections) {
        return;
      }
      
      // Add to selection
      this.selectedIds.push(employee.id);
      this.selectedCollaborators.push(employee);
    }
    
    this.emitChange();
  }

  removeCollaborator(collaborator: Collaborator, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    
    if (this.disabled) return;
    
    this.selectedIds = this.selectedIds.filter(id => id !== collaborator.id);
    this.selectedCollaborators = this.selectedCollaborators.filter(c => c.id !== collaborator.id);
    
    this.emitChange();
  }

  selectAll(): void {
    if (this.disabled) return;
    
    if (this.maxSelections > 0) {
      // Select up to max
      this.selectedIds = this.employees.slice(0, this.maxSelections).map(e => e.id);
      this.selectedCollaborators = this.employees.slice(0, this.maxSelections);
    } else {
      // Select all
      this.selectedIds = this.employees.map(e => e.id);
      this.selectedCollaborators = [...this.employees];
    }
    
    this.emitChange();
  }

  clearAll(): void {
    if (this.disabled) return;
    
    this.selectedIds = [];
    this.selectedCollaborators = [];
    
    this.emitChange();
  }

  isSelected(employee: Collaborator): boolean {
    return this.selectedIds.includes(employee.id);
  }

  get allSelected(): boolean {
    return this.employees.length > 0 && this.selectedIds.length === this.employees.length;
  }

  get someSelected(): boolean {
    return this.selectedIds.length > 0 && this.selectedIds.length < this.employees.length;
  }

  // ============= VALUE ACCESSOR =============

  writeValue(value: string[]): void {
    this.selectedIds = value || [];
    
    // Update selectedCollaborators based on IDs
    this.selectedCollaborators = this.employees.filter(
      emp => this.selectedIds.includes(emp.id)
    );
  }

  registerOnChange(fn: (value: string[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  private emitChange(): void {
    this.onChange(this.selectedIds);
    this.onTouched();
    this.selectionChange.emit(this.selectedIds);
  }

  // ============= HELPER METHODS =============

  getInitials(firstName: string, lastName?: string): string {
    if (!firstName) return '?';
    const firstInitial = firstName.charAt(0).toUpperCase();
    const lastInitial = lastName ? lastName.charAt(0).toUpperCase() : '';
    return firstInitial + lastInitial;
  }

  getFullName(collaborator: Collaborator): string {
    return `${collaborator.firstName} ${collaborator.lastName}`.trim();
  }

  getAvatarBgColor(id: string): string {
    // Generate consistent color based on ID
    const colors = [
      'bg-primary', 'bg-success', 'bg-info', 'bg-warning', 
      'bg-danger', 'bg-dark', 'bg-secondary'
    ];
    
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  }

  trackByEmployeeId(index: number, employee: Collaborator): string {
    return employee.id;
  }

  // Update employees list (call this when employees are loaded)
  updateEmployees(employees: Collaborator[]): void {
    this.employees = employees;
    this.filteredEmployees = [...employees];
    
    // Re-sync selected collaborators
    this.selectedCollaborators = this.employees.filter(
      emp => this.selectedIds.includes(emp.id)
    );
  }
}