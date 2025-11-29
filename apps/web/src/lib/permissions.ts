import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, ownerAc, adminAc, memberAc } from "better-auth/plugins/organization/access";

const statement = {
  ...defaultStatements,
  project: ["create", "read", "update", "delete", "assign", "comment"],
  // Merge our custom organization permissions with defaults
  organization: [...(defaultStatements.organization || []), "invite", "remove", "read"] as const,
} as const;

export const ac = createAccessControl(statement);

export const owner = ac.newRole({
  project: ["create", "read", "update", "delete", "assign", "comment"],
  // Merge default owner permissions with our custom organization permissions
  ...ownerAc.statements,
  organization: ["invite", "remove", "update", "read"],
});

export const admin = ac.newRole({
  project: ["create", "read", "update", "assign", "comment"],
  // Merge default admin permissions with our custom organization permissions
  ...adminAc.statements,
  organization: ["invite", "remove", "update", "read"],
});

export const member = ac.newRole({
  project: ["read", "assign", "comment"],
  // Merge default member permissions with our custom organization permissions
  ...memberAc.statements,
  organization: ["read"],
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


