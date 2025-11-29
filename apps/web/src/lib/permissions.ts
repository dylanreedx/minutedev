import { createAccessControl } from "better-auth/plugins/access";

const statement = {
  project: ["create", "read", "update", "delete", "assign", "comment"],
} as const;

export const ac = createAccessControl(statement);

export const owner = ac.newRole({
  project: ["create", "read", "update", "delete", "assign", "comment"],
});

export const admin = ac.newRole({
  project: ["create", "read", "update", "assign", "comment"],
});

export const member = ac.newRole({
  project: ["read", "assign", "comment"],
});

// Team permission helpers
export type TeamRole = 'owner' | 'admin' | 'member';

/**
 * Check if a role can update team member roles
 */
export function canUpdateMemberRoles(role: TeamRole): boolean {
  return role === 'owner' || role === 'admin';
}

/**
 * Check if a role can remove team members
 */
export function canRemoveMembers(role: TeamRole): boolean {
  return role === 'owner' || role === 'admin';
}

/**
 * Check if a role can delete the team
 */
export function canDeleteTeam(role: TeamRole): boolean {
  return role === 'owner';
}

/**
 * Check if a role can update team settings (name, slug)
 */
export function canUpdateTeamSettings(role: TeamRole): boolean {
  return role === 'owner' || role === 'admin';
}

/**
 * Check if a role can invite team members
 */
export function canInviteMembers(role: TeamRole): boolean {
  return role === 'owner' || role === 'admin';
}

/**
 * Get permission description for a role
 */
export function getRolePermissions(role: TeamRole): string[] {
  switch (role) {
    case 'owner':
      return [
        'Full control over team',
        'Can delete team',
        'Can update team settings',
        'Can manage all members',
        'Can invite members',
        'Can update member roles',
        'Can remove members',
      ];
    case 'admin':
      return [
        'Can update team settings',
        'Can manage members',
        'Can invite members',
        'Can update member roles',
        'Can remove members',
        'Cannot delete team',
      ];
    case 'member':
      return [
        'Can view team and projects',
        'Can comment on tickets',
        'Can be assigned to tickets',
        'Cannot manage team settings',
        'Cannot manage members',
      ];
    default:
      return [];
  }
}


