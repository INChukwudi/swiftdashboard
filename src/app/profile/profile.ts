import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../services/auth.service';

declare var toastr: any;

interface UserData {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  role: string;
  avatarUrl: string | null;
  email: string;
  phoneNumber: string;
  location: string;
  employeeId: string;
  job: string;
  department: string;
  joinedAt: string;
  birthday: string | null;
  skills: string[];
  notificationStats?: {
    total: number;
    stats: {
      read: number;
      unread: number;
    };
  };
  performanceStats?: {
    attendancePercentage: number;
    taskPercentage: number;
    rating: number;
    remark: string;
  };
}

interface ApiResponse<T> {
  ok: boolean;
  data: T;
  error: any;
}

interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile implements OnInit, OnDestroy {
  private apiUrl = 'https://pixels-office-server.azurewebsites.net/v1';
  private destroy$ = new Subject<void>();

  // User data
  user: UserData | null = null;
  loading = true;
  error: string | null = null;

  // Form data
  profileForm = {
    firstName: '',
    lastName: '',
    middleName: '',
    email: '',
    phoneNumber: '',
    location: ''
  };

  // Skills array
  skills: string[] = [];
  newSkill = '';

  // Avatar upload
  selectedFile: File | null = null;
  avatarPreview: string | null = null;
  uploadingAvatar = false;

  // Email change
  editingEmail = false;
  newEmail = '';
  confirmEmailPassword = '';

  // Password change
  editingPassword = false;
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  // Form submission states
  savingProfile = false;
  changingEmail = false;
  changingPassword = false;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    console.log('Profile component initialized');
    this.loadUserData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load user data from API
   */
  loadUserData(): void {
    console.log('Loading user data...');
    this.loading = true;
    this.error = null;

    const token = localStorage.getItem('access_token');
    console.log('Token exists:', !!token);

    if (!token) {
      this.error = 'No authentication token found';
      this.loading = false;
      this.showToast('error', 'Please log in again');
      return;
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    this.http.get<ApiResponse<UserData>>(`${this.apiUrl}/user`, { headers })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('User data response:', response);
          if (response.ok && response.data) {
            this.user = response.data;
            this.populateForm();
            this.skills = [...(response.data.skills || [])];
            console.log('User data loaded successfully:', this.user);
          } else {
            this.error = 'Failed to load user data';
            console.error('Invalid response:', response);
          }
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading user data:', err);
          this.error = err.error?.error || 'Failed to load user data';
          this.loading = false;
          this.showToast('error', this.error || 'Failed to load user data');
        }
      });
  }

  /**
   * Populate form with user data
   */
  populateForm(): void {
    if (this.user) {
      this.profileForm = {
        firstName: this.user.firstName || '',
        lastName: this.user.lastName || '',
        middleName: this.user.middleName || '',
        email: this.user.email || '',
        phoneNumber: this.user.phoneNumber || '',
        location: this.user.location || ''
      };
      this.avatarPreview = this.user.avatarUrl;
      console.log('Form populated:', this.profileForm);
    }
  }

  /**
   * Handle avatar file selection
   */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      
      // Validate file type
      if (!file.type.match(/image\/(png|jpg|jpeg)/)) {
        this.showToast('error', 'Only PNG, JPG, and JPEG files are allowed');
        return;
      }

      // Validate file size (2MB)
      if (file.size > 2 * 1024 * 1024) {
        this.showToast('error', 'File size must be less than 2MB');
        return;
      }

      this.selectedFile = file;

      // Preview
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.avatarPreview = e.target.result;
      };
      reader.readAsDataURL(file);

      // Auto-upload avatar
      this.uploadAvatar();
    }
  }

  /**
   * Upload avatar to server
   */
  uploadAvatar(): void {
    if (!this.selectedFile) {
      console.error('No file selected');
      return;
    }

    console.log('Uploading avatar...', {
      fileName: this.selectedFile.name,
      fileSize: this.selectedFile.size,
      fileType: this.selectedFile.type
    });
    this.uploadingAvatar = true;

    const formData = new FormData();
    formData.append('avatar', this.selectedFile, this.selectedFile.name);

    // Log FormData contents for debugging
    console.log('FormData entries:');
    formData.forEach((value, key) => {
      console.log(`  ${key}:`, value);
    });

    const token = localStorage.getItem('access_token');
    console.log('Token exists:', !!token);
    
    // Create headers WITHOUT Content-Type (browser will set it automatically)
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    console.log('Request headers:', headers.keys());
    console.log('Sending request to:', `${this.apiUrl}/user/upload-avatar`);

    // Use explicit request configuration
    this.http.post<ApiResponse<{ avatarUrl: string }>>(
      `${this.apiUrl}/user/upload-avatar`,
      formData,
      {
        headers: headers,
        // Explicitly tell Angular not to process the body
        // This prevents any automatic serialization
      }
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('Avatar upload response:', response);
          if (response.ok && response.data) {
            this.avatarPreview = response.data.avatarUrl;
            if (this.user) {
              this.user.avatarUrl = response.data.avatarUrl;
            }
            this.showToast('success', 'Profile picture updated successfully');
          } else {
            console.error('Upload succeeded but response is invalid:', response);
            this.showToast('error', 'Upload failed: Invalid response');
          }
          this.uploadingAvatar = false;
          this.selectedFile = null;
        },
        error: (err) => {
          console.error('Error uploading avatar:', err);
          console.error('Full error object:', JSON.stringify(err, null, 2));
          console.error('Error details:', {
            status: err.status,
            statusText: err.statusText,
            url: err.url,
            message: err.message,
            error: err.error
          });
          
          let errorMsg = 'Failed to upload profile picture';
          
          if (err.error?.error?.message) {
            errorMsg = err.error.error.message;
          } else if (err.error?.message) {
            errorMsg = err.error.message;
          } else if (err.message) {
            errorMsg = err.message;
          }
          
          this.showToast('error', errorMsg);
          this.uploadingAvatar = false;
        }
      });
  }

  /**
   * Remove avatar preview
   */
  removeAvatar(): void {
    this.selectedFile = null;
    this.avatarPreview = this.user?.avatarUrl || null;
  }

  /**
   * Add new skill
   */
  addSkill(): void {
    const skill = this.newSkill.trim();
    if (skill && !this.skills.includes(skill)) {
      this.skills.push(skill);
      this.newSkill = '';
      console.log('Skill added:', skill);
    } else if (this.skills.includes(skill)) {
      this.showToast('info', 'Skill already exists');
    }
  }

  /**
   * Remove skill
   */
  removeSkill(index: number): void {
    const removedSkill = this.skills[index];
    this.skills.splice(index, 1);
    console.log('Skill removed:', removedSkill);
  }

  /**
   * Update user profile
   */
  updateProfile(): void {
    console.log('Updating profile...');
    
    // Validation
    if (!this.profileForm.firstName || !this.profileForm.lastName) {
      this.showToast('error', 'First name and last name are required');
      return;
    }

    if (!this.profileForm.phoneNumber) {
      this.showToast('error', 'Phone number is required');
      return;
    }

    this.savingProfile = true;

    const token = localStorage.getItem('access_token');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    const updateData = {
      firstName: this.profileForm.firstName.trim(),
      lastName: this.profileForm.lastName.trim(),
      middleName: this.profileForm.middleName?.trim() || '',
      phoneNumber: this.profileForm.phoneNumber.trim(),
      location: this.profileForm.location.trim(),
      skills: this.skills
    };

    console.log('Update data:', updateData);

    this.http.patch<ApiResponse<UserData>>(
      `${this.apiUrl}/user`,
      updateData,
      { headers }
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('Update response:', response);
          if (response.ok && response.data) {
            this.user = response.data;
            this.populateForm();
            this.skills = [...(response.data.skills || [])];
            this.showToast('success', 'Profile updated successfully');
            
            // Update user in auth service
            this.authService.login(
              token!,
              {
                id: response.data.id,
                email: response.data.email,
                firstName: response.data.firstName,
                lastName: response.data.lastName,
                role: response.data.role
              }
            );
          }
          this.savingProfile = false;
        },
        error: (err) => {
          console.error('Error updating profile:', err);
          this.showToast('error', err.error?.error || 'Failed to update profile');
          this.savingProfile = false;
        }
      });
  }

  /**
   * Reset profile form
   */
  resetProfile(): void {
    this.populateForm();
    this.skills = [...(this.user?.skills || [])];
    this.selectedFile = null;
    this.newSkill = '';
    this.showToast('info', 'Changes reset');
  }

  /**
   * Toggle email editing
   */
  toggleEmailEdit(): void {
    this.editingEmail = !this.editingEmail;
    if (this.editingEmail) {
      this.newEmail = this.user?.email || '';
      this.confirmEmailPassword = '';
    }
  }

  /**
   * Cancel email edit
   */
  cancelEmailEdit(): void {
    this.editingEmail = false;
    this.newEmail = '';
    this.confirmEmailPassword = '';
  }

  /**
   * Update email
   */
  updateEmail(): void {
    if (!this.newEmail || !this.confirmEmailPassword) {
      this.showToast('error', 'Please fill all fields');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.newEmail)) {
      this.showToast('error', 'Please enter a valid email address');
      return;
    }

    if (this.newEmail === this.user?.email) {
      this.showToast('info', 'New email is the same as current email');
      return;
    }

    console.log('Updating email...');
    this.changingEmail = true;

    const token = localStorage.getItem('access_token');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    this.http.patch<ApiResponse<UserData>>(
      `${this.apiUrl}/user`,
      { email: this.newEmail },
      { headers }
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('Email update response:', response);
          if (response.ok && response.data) {
            this.user = response.data;
            this.profileForm.email = response.data.email;
            this.showToast('success', 'Email updated successfully');
            this.cancelEmailEdit();
            
            // Update auth service
            const currentToken = localStorage.getItem('access_token');
            this.authService.login(
              currentToken!,
              {
                id: response.data.id,
                email: response.data.email,
                firstName: response.data.firstName,
                lastName: response.data.lastName,
                role: response.data.role
              }
            );
          }
          this.changingEmail = false;
        },
        error: (err) => {
          console.error('Error updating email:', err);
          this.showToast('error', err.error?.error || 'Failed to update email');
          this.changingEmail = false;
        }
      });
  }

  /**
   * Toggle password editing
   */
  togglePasswordEdit(): void {
    this.editingPassword = !this.editingPassword;
    if (!this.editingPassword) {
      this.currentPassword = '';
      this.newPassword = '';
      this.confirmPassword = '';
    }
  }

  /**
   * Cancel password edit
   */
  cancelPasswordEdit(): void {
    this.editingPassword = false;
    this.currentPassword = '';
    this.newPassword = '';
    this.confirmPassword = '';
  }

  /**
   * Change password
   */
  changePassword(): void {
    if (!this.currentPassword || !this.newPassword || !this.confirmPassword) {
      this.showToast('error', 'Please fill all fields');
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.showToast('error', 'New passwords do not match');
      return;
    }

    if (this.newPassword.length < 8) {
      this.showToast('error', 'Password must be at least 8 characters');
      return;
    }

    // Check for symbols
    const symbolRegex = /[!@#$%^&*(),.?":{}|<>]/;
    if (!symbolRegex.test(this.newPassword)) {
      this.showToast('error', 'Password must contain at least one symbol');
      return;
    }

    console.log('Changing password...');
    this.changingPassword = true;

    const token = localStorage.getItem('access_token');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    const passwordData: ChangePasswordRequest = {
      oldPassword: this.currentPassword,
      newPassword: this.newPassword
    };

    this.http.post<ApiResponse<any>>(
      `${this.apiUrl}/user/change-password`,
      passwordData,
      { headers }
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('Password change response:', response);
          if (response.ok) {
            this.showToast('success', 'Password changed successfully');
            this.cancelPasswordEdit();
          }
          this.changingPassword = false;
        },
        error: (err) => {
          console.error('Error changing password:', err);
          const errorMsg = err.error?.error || 'Failed to change password';
          this.showToast('error', errorMsg);
          this.changingPassword = false;
        }
      });
  }

  /**
   * Format date
   */
  formatDate(dateString: string | null | undefined): string {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (e) {
      console.error('Error formatting date:', e);
      return 'N/A';
    }
  }

  /**
   * Show toast notification
   */
  private showToast(type: 'success' | 'error' | 'info', message: string): void {
    if (typeof toastr !== 'undefined') {
      toastr[type](message);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }
}