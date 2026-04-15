import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

/**
 * Program Data from API response.
 */
export interface ProgramData {
  parentId: number;
  currentId: number;
  typeId: number;
  programId: number;
  residents: number;
  assigned: number;
  assignedCaseLoad: number;
  hasResidents: boolean;
  isOutSideAgency: boolean;
  allowQrCodeAttendance: boolean;
  hasAccess: boolean;
  caseLoadId: number;
  cL_TypeId: number | null;
  cL_OhId: number | null;
  assignedStaffId: number | null;
  inUse: boolean | null;
  isActive: boolean;
  serviceCategoryId: number | null;
}

/**
 * API Response type for Program (without legacy properties).
 */
interface ProgramApiResponse {
  id: number;
  parentId: number;
  label: string;
  data: ProgramData;
  children?: ProgramApiResponse[];
}

/**
 * Program model with legacy properties for compatibility.
 */
export interface Program {
  id: number;
  parentId: number;
  label: string;
  data: ProgramData;
  children?: Program[];
  name: string; // Always set to label value
}

/**
 * Flattened program for dropdown display with level information.
 */
export interface FlattenedProgram extends Program {
  level: number; // Nesting level for indentation (0 = root, 1 = child, etc.)
}

/**
 * API Response type for Role (without legacy properties).
 */
interface RoleApiResponse {
  id: number;
  text: string;
  isActive: boolean;
  isArchived: boolean;
}

/**
 * Role model with legacy properties for compatibility.
 */
export interface Role {
  id: number;
  text: string;
  isActive: boolean;
  isArchived: boolean;
  name: string; // Always set to text value
  programId?: number;
}

/**
 * API Response type for Staff (without legacy properties).
 */
interface StaffApiResponse {
  id: number;
  firstName: string;
  middleName: string | null;
  lastName: string;
  fullName: string;
  imagePath: string | null;
  jobTitle: string | null;
  classificationId: number | null;
  classificationText: string;
  facilityId: number;
  facilityName: string | null;
  roleId: number;
  roleName: string;
  programId: number;
}

/**
 * Staff model with legacy properties for compatibility.
 */
export interface Staff {
  id: number;
  firstName: string;
  middleName: string | null;
  lastName: string;
  fullName: string;
  imagePath: string | null;
  jobTitle: string | null;
  classificationId: number | null;
  classificationText: string;
  facilityId: number;
  facilityName: string | null;
  roleId: number;
  roleName: string;
  programId: number;
  name: string; // Always set to fullName value
  email?: string;
}

/**
 * Request body for get-staffs API.
 */
interface GetStaffsRequest {
  programIds: string;
  roleIds: string;
}

/**
 * Service for managing Programs, Roles, and Staff.
 * Uses real APIs from staging-api.icm.care.
 * Note: Authorization headers are automatically added by authInterceptor.
 */
@Injectable({
  providedIn: 'root'
})
export class ProgramRoleStaffService {
  private readonly baseUrl = 'https://qa-api.icm.care/api';
  
  // Cache for loaded data
  private programsCache: Program[] | null = null;
  private rolesCache: Role[] | null = null;

  constructor(private http: HttpClient) {}

  /**
   * Gets the current user ID from localStorage.
   * Falls back to a default if not found.
   */
  private getUserId(): number {
    // Try to get user object from localStorage
    const userStr = localStorage.getItem('user') || localStorage.getItem('currentUser');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        return user.id || user.userId || user.staffId || 6002;
      } catch {
        // If parsing fails, try other keys
      }
    }
    // Try direct userId keys
    const userId = localStorage.getItem('userId') || localStorage.getItem('user_id') || localStorage.getItem('staffId');
    return userId ? parseInt(userId, 10) : 6002;
  }

  /**
   * Converts API response to Program with name property.
   */
  private mapApiProgram(apiProgram: ProgramApiResponse): Program {
    return {
      id: apiProgram.id,
      parentId: apiProgram.parentId,
      label: apiProgram.label,
      data: apiProgram.data,
      name: apiProgram.label,
      children: apiProgram.children ? apiProgram.children.map(c => this.mapApiProgram(c)) : []
    };
  }

  /**
   * Converts API response to Role with name property.
   */
  private mapApiRole(apiRole: RoleApiResponse): Role {
    return {
      id: apiRole.id,
      text: apiRole.text,
      isActive: apiRole.isActive,
      isArchived: apiRole.isArchived,
      name: apiRole.text
    };
  }

  /**
   * Converts API response to Staff with name property.
   */
  private mapApiStaff(apiStaff: StaffApiResponse): Staff {
    return {
      id: apiStaff.id,
      firstName: apiStaff.firstName,
      middleName: apiStaff.middleName,
      lastName: apiStaff.lastName,
      fullName: apiStaff.fullName,
      imagePath: apiStaff.imagePath,
      jobTitle: apiStaff.jobTitle,
      classificationId: apiStaff.classificationId,
      classificationText: apiStaff.classificationText,
      facilityId: apiStaff.facilityId,
      facilityName: apiStaff.facilityName,
      roleId: apiStaff.roleId,
      roleName: apiStaff.roleName,
      programId: apiStaff.programId,
      name: apiStaff.fullName || `${apiStaff.firstName} ${apiStaff.lastName}`.trim()
    };
  }

  /**
   * Gets all programs (organizational hierarchy).
   * API: GET /api/user/get-assigned-oh/{userId}
   */
  getPrograms(): Observable<Program[]> {
    // Return cached data if available
    if (this.programsCache) {
      return of(this.programsCache);
    }

    const userId = this.getUserId();
    const url = `${this.baseUrl}/user/get-assigned-oh/${userId}`;
    
    return this.http.get<ProgramApiResponse[]>(url).pipe(
      map(programs => {
        this.programsCache = programs.map(p => this.mapApiProgram(p));
        return this.programsCache;
      }),
      catchError(error => {
        console.error('Error loading programs from API:', error);
        return of([]);
      })
    );
  }

  /**
   * Gets all roles.
   * API: GET /api/user/roles
   */
  getRoles(): Observable<Role[]> {
    // Return cached data if available
    if (this.rolesCache) {
      return of(this.rolesCache);
    }

    const url = `${this.baseUrl}/user/roles`;
    
    return this.http.get<RoleApiResponse[]>(url).pipe(
      map(roles => {
        this.rolesCache = roles.map(r => this.mapApiRole(r));
        return this.rolesCache;
      }),
      catchError(error => {
        console.error('Error loading roles from API:', error);
        return of([]);
      })
    );
  }

  /**
   * Gets roles for a specific program.
   * Since API doesn't support filtering by program, we return all roles.
   */
  getRolesByProgram(programId: number | null): Observable<Role[]> {
    return this.getRoles();
  }

  /**
   * Gets staff based on program and role filters.
   * API: POST /api/staff-scheduler/shift/get-staffs
   */
  getStaff(programId: number | null, roleId: number | null): Observable<Staff[]> {
    const url = `${this.baseUrl}/staff-scheduler/shift/get-staffs`;
    
    const requestBody: GetStaffsRequest = {
      programIds: programId ? programId.toString() : '',
      roleIds: roleId ? roleId.toString() : ''
    };

    return this.http.post<StaffApiResponse[]>(url, requestBody).pipe(
      map(staffList => staffList.map(s => this.mapApiStaff(s))),
      catchError(error => {
        console.error('Error loading staff from API:', error);
        return of([]);
      })
    );
  }

  /**
   * Gets all staff without filters.
   */
  getAllStaff(): Observable<Staff[]> {
    return this.getStaff(null, null);
  }

  /**
   * Gets a staff member by ID.
   */
  getStaffById(staffId: number): Observable<Staff | null> {
    return this.getStaff(null, null).pipe(
      map(staffList => staffList.find(s => s.id === staffId) || null)
    );
  }

  /**
   * Flattens hierarchical programs into a single array with level information.
   * Used for dropdown display with proper indentation.
   * Uses Unicode non-breaking spaces for indentation (most reliable across browsers).
   * @param programs Array of programs (hierarchical)
   * @param level Current nesting level (starts at 0 for root)
   * @returns Flattened array with level property and indented displayLabel
   */
  flattenPrograms(programs: Program[], level: number = 0): FlattenedProgram[] {
    const result: FlattenedProgram[] = [];
    // Use Unicode non-breaking space (U+00A0) repeated for each level
    const indentUnit = '\u00A0\u00A0\u00A0\u00A0'; // 4 non-breaking spaces per level
    
    for (const program of programs) {
      const indent = indentUnit.repeat(level);
      // Add the program with its level and indented label
      result.push({
        ...program,
        level: level,
        label: indent + program.label // Prepend indent to label for display
      });
      
      // Recursively add children with incremented level
      if (program.children && program.children.length > 0) {
        result.push(...this.flattenPrograms(program.children, level + 1));
      }
    }
    
    return result;
  }
}

