// src/app/tagify-input/tagify-input.ts
import {
  Component,
  ElementRef,
  ViewChild,
  Input,
  forwardRef,
  OnDestroy,
  AfterViewInit,
  OnChanges,
  SimpleChanges,
  NgZone
} from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR
} from '@angular/forms';
import { CommonModule } from '@angular/common';

declare var Tagify: any;

export interface TagifyWhitelistItem {
  value: string;
  id: string;
  email?: string | null;
  avatarUrl?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  [key: string]: any;
}

@Component({
  selector: 'app-tagify-input',
  standalone: true,
  imports: [CommonModule],
  template: `
    <input
      #tagifyInput
      type="text"
      class="form-control form-control-solid"
      [placeholder]="placeholder"
      [disabled]="isDisabled"
      name="tags"
    />
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    :host ::ng-deep .tagify {
      --tag-bg: #009ef7;
      --tag-hover: #0095e8;
      --tag-text-color: #ffffff;
      --tag-remove-bg: rgba(255, 255, 255, 0.3);
      --tag-remove-btn-bg--hover: rgba(255, 255, 255, 0.5);
      --tag-pad: 0.5rem 0.75rem;
      --tag-inset-shadow-size: 1.3em;
      border: 1px solid #e4e6ef;
      border-radius: 0.475rem;
    }

    :host ::ng-deep .tagify__tag {
      margin: 0.25rem;
    }

    :host ::ng-deep .tagify__input {
      min-width: 150px;
      padding: 0.5rem;
      margin: 0.25rem;
    }

    :host ::ng-deep .tagify__dropdown {
      max-height: 300px;
      overflow-y: auto;
      box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
      border-radius: 0.475rem;
      z-index: 1050;
    }

    :host ::ng-deep .tagify__dropdown__item {
      cursor: pointer;
      transition: background-color 0.15s ease;
      padding: 0.5rem 0.75rem;
    }

    :host ::ng-deep .tagify__dropdown__item:hover,
    :host ::ng-deep .tagify__dropdown__item--active {
      background-color: #f5f8fa !important;
    }

    :host ::ng-deep .tagify.tagify--focus {
      border-color: #009ef7;
    }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TagifyInputComponent),
      multi: true
    }
  ]
})
export class TagifyInputComponent implements ControlValueAccessor, AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('tagifyInput', { static: true }) inputElement!: ElementRef<HTMLInputElement>;
  
  @Input() placeholder: string = 'Type to search...';
  @Input() whitelist: TagifyWhitelistItem[] = [];
  @Input() maxTags: number = 20; // Changed from 10 to 20
  @Input() dropdownMaxItems: number = 20;

  private tagify: any = null;
  public isDisabled = false;
  
  private onChange: (value: string[]) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private ngZone: NgZone) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['whitelist'] && this.tagify) {
      const newWhitelist = changes['whitelist'].currentValue;
      if (newWhitelist && newWhitelist.length > 0) {
        console.log('📝 Updating whitelist:', newWhitelist.length, 'items');
        this.ngZone.runOutsideAngular(() => {
          this.tagify.whitelist = newWhitelist;
        });
      }
    }
  }

  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        this.initializeTagify();
      }, 100);
    });
  }

  ngOnDestroy(): void {
    if (this.tagify) {
      this.tagify.destroy();
      this.tagify = null;
    }
  }

  private initializeTagify(): void {
    const inputEl = this.inputElement?.nativeElement;
    
    if (!inputEl) {
      console.error('❌ Input element not found');
      return;
    }

    if (typeof Tagify === 'undefined') {
      console.error('❌ Tagify library not loaded');
      return;
    }

    if (this.tagify) {
      console.warn('⚠️ Tagify already exists, destroying first');
      this.tagify.destroy();
    }

    console.log('🚀 Initializing Tagify with whitelist:', this.whitelist.length);
    console.log('🏷️ Max tags allowed:', this.maxTags);

    try {
      this.tagify = new Tagify(inputEl, {
       
        whitelist: this.whitelist,
        enforceWhitelist: true,
        maxTags: this.maxTags,
        dropdown: {
          enabled: 0,
          maxItems: this.dropdownMaxItems,
          closeOnSelect: false,
          highlightFirst: true,
          classname: 'tagify__dropdown',
          position: 'manual'
        },
        editTags: false
      });

      // Show dropdown on focus
      this.tagify.on('focus', () => {
        console.log('🔍 Focus - showing dropdown');
        this.tagify.dropdown.show();
      });

      // Handle clicking on the tagify container
      this.tagify.DOM.scope.addEventListener('click', (e: Event) => {
        const target = e.target as HTMLElement;
        // Only show dropdown if clicking on input area, not on tags
        if (!target.closest('.tagify__tag')) {
          console.log('🖱️ Click on input area');
          this.tagify.dropdown.show();
        }
      });

      // Handle add/remove events
      this.tagify.on('add', (e: any) => {
        console.log('✅ Tag added:', e.detail.data);
        console.log('📊 Current tag count:', this.tagify.value.length, '/', this.maxTags);
        this.ngZone.run(() => {
          this.notifyChange();
        });
      });
      
      this.tagify.on('remove', (e: any) => {
        console.log('❌ Tag removed:', e.detail.data);
        console.log('📊 Current tag count:', this.tagify.value.length, '/', this.maxTags);
        this.ngZone.run(() => {
          this.notifyChange();
        });
      });

      // Debug dropdown events
      this.tagify.on('dropdown:show', () => {
        console.log('📋 Dropdown shown');
      });

      this.tagify.on('dropdown:hide', () => {
        console.log('📋 Dropdown hidden');
      });

      // Position dropdown manually
      if (this.tagify.dropdown) {
        this.tagify.dropdown.position = () => {
          const rect = this.tagify.DOM.scope.getBoundingClientRect();
          if (this.tagify.DOM.dropdown) {
            this.tagify.DOM.dropdown.style.cssText = `
              position: absolute;
              top: ${rect.bottom + window.scrollY}px;
              left: ${rect.left + window.scrollX}px;
              width: ${rect.width}px;
            `;
          }
        };
      }

      console.log('✅ Tagify initialized successfully');
      console.log('Tagify instance:', this.tagify);
      console.log('Dropdown:', this.tagify.dropdown);

    } catch (error) {
      console.error('❌ Error initializing Tagify:', error);
    }
  }

  private notifyChange(): void {
    if (!this.tagify) return;
    
    const tags = this.tagify.value || [];
    const ids: string[] = tags
      .map((tag: any) => tag.id)
      .filter((id: string) => !!id);

    console.log('📢 Value changed:', ids);
    
    this.onChange(ids);
    this.onTouched();
  }

  writeValue(ids: string[]): void {
    console.log('📝 writeValue:', ids);
    
    if (!this.tagify) {
      setTimeout(() => this.writeValue(ids), 100);
      return;
    }

    if (!ids || ids.length === 0) {
      this.tagify.removeAllTags();
      return;
    }

    const tagsToAdd = this.whitelist.filter(item => ids.includes(item.id));
    console.log('Adding tags:', tagsToAdd);
    
    this.tagify.removeAllTags();
    if (tagsToAdd.length > 0) {
      this.tagify.addTags(tagsToAdd);
    }
  }

  registerOnChange(fn: (value: string[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
    if (this.tagify) {
      this.tagify.setDisabled(isDisabled);
    }
  }
}