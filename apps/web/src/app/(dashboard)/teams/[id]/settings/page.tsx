'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Trash2, UserPlus, Users, X, Info } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSession } from '@/lib/auth-client';
import {
  useTeam,
  useTeamMembers,
  useTeamInvitations,
  useUpdateTeam,
  useDeleteTeam,
  useUpdateTeamMemberRole,
  useRemoveTeamMember,
  useCancelTeamInvitation,
} from '@/hooks/use-teams';
import { InviteTeamMemberDialog } from '@/components/teams/invite-team-member-dialog';
import { useProjectsByTeam } from '@/hooks/use-projects';
import {
  canUpdateMemberRoles,
  canRemoveMembers,
  canDeleteTeam,
  canUpdateTeamSettings,
  canInviteMembers,
  type TeamRole,
} from '@/lib/permissions';

export default function TeamSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = params.id as string;
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;
  const { data: team, isLoading: teamLoading, error: teamError } = useTeam(teamId);
  const { data: members = [], isLoading: membersLoading } = useTeamMembers(teamId);
  const { data: invitations = [] } = useTeamInvitations(teamId);
  const { data: projects = [] } = useProjectsByTeam(teamId);
  const updateTeam = useUpdateTeam();
  const deleteTeam = useDeleteTeam();
  const updateMemberRole = useUpdateTeamMemberRole();
  const removeMember = useRemoveTeamMember();
  const cancelInvitation = useCancelTeamInvitation();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRemoveMemberConfirm, setShowRemoveMemberConfirm] = useState<string | null>(null);
  const [showCancelInviteConfirm, setShowCancelInviteConfirm] = useState<string | null>(null);
  const [showRoleChangeConfirm, setShowRoleChangeConfirm] = useState<{
    memberId: string;
    newRole: 'owner' | 'admin' | 'member';
    oldRole: 'owner' | 'admin' | 'member';
  } | null>(null);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');

  // Initialize form when team data loads
  useEffect(() => {
    if (team) {
      setName(team.name);
      setSlug(team.slug || '');
    }
  }, [team]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!team?.id || !name.trim()) {
      return;
    }

    try {
      await updateTeam.mutateAsync({
        teamId: team.id,
        name: name.trim(),
        slug: slug.trim() || undefined,
      });
    } catch (error) {
      console.error('Error updating team:', error);
    }
  };

  const handleDelete = async () => {
    if (!team?.id) return;

    try {
      await deleteTeam.mutateAsync(team.id);
      router.push('/teams');
    } catch (error) {
      console.error('Error deleting team:', error);
    }
  };

  const handleUpdateMemberRole = async (memberId: string, newRole: 'owner' | 'admin' | 'member', oldRole: 'owner' | 'admin' | 'member') => {
    if (!team?.id) return;

    // Show confirmation for downgrades (owner → admin/member, admin → member)
    const isDowngrade = 
      (oldRole === 'owner' && (newRole === 'admin' || newRole === 'member')) ||
      (oldRole === 'admin' && newRole === 'member');

    if (isDowngrade) {
      setShowRoleChangeConfirm({ memberId, newRole, oldRole });
      return;
    }

    // Proceed with update
    setUpdatingMemberId(memberId);
    try {
      await updateMemberRole.mutateAsync({
        teamId: team.id,
        memberId,
        role: newRole,
      });
    } catch (error) {
      console.error('Error updating member role:', error);
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const confirmRoleChange = async () => {
    if (!showRoleChangeConfirm || !team?.id) return;

    const { memberId, newRole } = showRoleChangeConfirm;
    setUpdatingMemberId(memberId);
    try {
      await updateMemberRole.mutateAsync({
        teamId: team.id,
        memberId,
        role: newRole,
      });
      setShowRoleChangeConfirm(null);
    } catch (error) {
      console.error('Error updating member role:', error);
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!team?.id) return;

    try {
      await removeMember.mutateAsync({
        teamId: team.id,
        memberIdOrEmail: memberId,
      });
      setShowRemoveMemberConfirm(null);
    } catch (error) {
      console.error('Error removing member:', error);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!team?.id) return;

    try {
      await cancelInvitation.mutateAsync({
        invitationId,
        teamId: team.id,
      });
      setShowCancelInviteConfirm(null);
    } catch (error) {
      console.error('Error canceling invitation:', error);
    }
  };

  const isLoading = updateTeam.isPending || deleteTeam.isPending;
  const isFormLoading = teamLoading || isLoading;

  // Get current user's role in the team
  const currentUserMember = members.find((m: any) => m.userId === currentUserId);
  const currentUserRole: TeamRole | null = (currentUserMember?.role as TeamRole) || null;

  // Permission checks
  const canUpdateSettings = currentUserRole ? canUpdateTeamSettings(currentUserRole) : false;
  const canManageMembers = currentUserRole ? canUpdateMemberRoles(currentUserRole) : false;
  const canRemoveTeamMembers = currentUserRole ? canRemoveMembers(currentUserRole) : false;
  const canDelete = currentUserRole ? canDeleteTeam(currentUserRole) : false;
  const canInvite = currentUserRole ? canInviteMembers(currentUserRole) : false;

  if (teamLoading) {
    return (
      <>
        <Header title="Team Settings">
          <Skeleton className="h-10 w-32" />
        </Header>
        <div className="p-6 space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </>
    );
  }

  if (teamError || !team) {
    return (
      <>
        <Header title="Team Settings">
          <Button variant="outline" asChild>
            <Link href="/teams">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Teams
            </Link>
          </Button>
        </Header>
        <div className="p-6">
          <EmptyState
            icon={Users}
            title="Team not found"
            description="The team you're looking for doesn't exist or you don't have access to it."
            action={
              <Button variant="outline" asChild>
                <Link href="/teams">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Teams
                </Link>
              </Button>
            }
          />
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Team Settings">
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/teams/${teamId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Team
            </Link>
          </Button>
        </div>
      </Header>

      <div className="p-6 space-y-6">
        {/* Team Information Form */}
        <Card>
          <CardHeader>
            <CardTitle>Team Information</CardTitle>
            <CardDescription>
              Update your team's name and slug.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="team-name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="team-name"
                  placeholder="Enter team name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={isFormLoading}
                  maxLength={100}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="team-slug">Slug (optional)</Label>
                <Input
                  id="team-slug"
                  placeholder="team-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  disabled={isFormLoading}
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground">
                  A URL-friendly identifier for your team
                </p>
              </div>

              <div className="flex justify-end">
                <Button 
                  type="submit" 
                  disabled={isFormLoading || !name.trim() || !canUpdateSettings}
                  title={!canUpdateSettings ? 'You do not have permission to update team settings' : ''}
                >
                  {isFormLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Team Members */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Team Members</CardTitle>
                <CardDescription>
                  Manage team members and their roles.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInviteDialogOpen(true)}
                disabled={!canInvite}
                title={!canInvite ? 'You do not have permission to invite members' : ''}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Invite Member
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {membersLoading ? (
              <div className="space-y-2">
                <div className="h-12 w-full bg-muted animate-pulse rounded" />
                <div className="h-12 w-full bg-muted animate-pulse rounded" />
              </div>
            ) : members.length > 0 ? (
              <div className="space-y-2">
                {members.map((member: any) => {
                  const isCurrentUser = member.userId === currentUserId;
                  const isUpdating = updatingMemberId === member.id;
                  const currentRole = member.role || 'member';
                  
                  return (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 py-2 px-3 rounded-lg border"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.user?.image || undefined} />
                        <AvatarFallback>
                          {member.user?.name
                            ? member.user.name
                                .split(' ')
                                .map((n: string) => n[0])
                                .join('')
                                .toUpperCase()
                                .slice(0, 2)
                            : member.user?.email?.[0]?.toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">
                            {member.user?.name || 'Unknown'}
                          </p>
                          {isCurrentUser && (
                            <Badge variant="secondary" className="text-xs">
                              You
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {member.user?.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <Select
                            value={currentRole}
                            onValueChange={(value: 'owner' | 'admin' | 'member') =>
                              handleUpdateMemberRole(member.id, value, currentRole)
                            }
                            disabled={updateMemberRole.isPending || isUpdating || !canManageMembers}
                          >
                            <SelectTrigger className="w-32">
                              {isUpdating ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <SelectValue />
                              )}
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="owner">Owner</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="member">Member</SelectItem>
                            </SelectContent>
                          </Select>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                disabled
                              >
                                <Info className="h-3 w-3 text-muted-foreground" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="space-y-1 text-xs">
                                <p><strong>Owner:</strong> Full control, can delete team</p>
                                <p><strong>Admin:</strong> Manage members and projects</p>
                                <p><strong>Member:</strong> View and comment on projects</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setShowRemoveMemberConfirm(member.id)}
                          disabled={removeMember.isPending || isCurrentUser || !canRemoveTeamMembers}
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          title={
                            isCurrentUser 
                              ? "You cannot remove yourself" 
                              : !canRemoveTeamMembers 
                              ? "You do not have permission to remove members"
                              : "Remove member"
                          }
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  No members yet. Invite team members to collaborate.
                </p>
              </div>
            )}

            {/* Pending Invitations */}
            {invitations.length > 0 && (
              <div className="mt-6 pt-6 border-t">
                <h3 className="text-sm font-medium mb-3">Pending Invitations</h3>
                <div className="space-y-2">
                  {invitations
                    .filter((inv: any) => inv.status === 'pending')
                    .map((inv: any) => (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between py-2 px-3 rounded-lg border"
                      >
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="text-sm font-medium">{inv.email}</p>
                            <p className="text-xs text-muted-foreground">
                              Invited as {inv.role}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="capitalize">
                            {inv.role}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setShowCancelInviteConfirm(inv.id)}
                            disabled={cancelInvitation.isPending}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>
              Irreversible and destructive actions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-destructive/50 p-4">
                <div>
                  <p className="text-sm font-medium">Delete Team</p>
                  <p className="text-xs text-muted-foreground">
                    This will permanently delete the team and all {projects.length} project{projects.length !== 1 ? 's' : ''} associated with it.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isLoading || !canDelete}
                  title={!canDelete ? 'Only team owners can delete the team' : ''}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Team
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Team Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the team
              &quot;{team?.name}&quot; and all {projects.length} project{projects.length !== 1 ? 's' : ''} associated with it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Team'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Member Confirmation */}
      {showRemoveMemberConfirm && (
        <AlertDialog
          open={!!showRemoveMemberConfirm}
          onOpenChange={(open) => !open && setShowRemoveMemberConfirm(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Member?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove the member from the team. They will lose access to all team projects.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={removeMember.isPending}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => showRemoveMemberConfirm && handleRemoveMember(showRemoveMemberConfirm)}
                disabled={removeMember.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {removeMember.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Removing...
                  </>
                ) : (
                  'Remove Member'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Cancel Invitation Confirmation */}
      {showCancelInviteConfirm && (
        <AlertDialog
          open={!!showCancelInviteConfirm}
          onOpenChange={(open) => !open && setShowCancelInviteConfirm(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel Invitation?</AlertDialogTitle>
              <AlertDialogDescription>
                This will cancel the pending invitation. The user will not be able to join the team using this invitation.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={cancelInvitation.isPending}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => showCancelInviteConfirm && handleCancelInvitation(showCancelInviteConfirm)}
                disabled={cancelInvitation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {cancelInvitation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Canceling...
                  </>
                ) : (
                  'Cancel Invitation'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Role Change Confirmation */}
      {showRoleChangeConfirm && (
        <AlertDialog
          open={!!showRoleChangeConfirm}
          onOpenChange={(open) => !open && setShowRoleChangeConfirm(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Change Member Role?</AlertDialogTitle>
              <AlertDialogDescription>
                You are about to change this member's role from <strong>{showRoleChangeConfirm.oldRole}</strong> to <strong>{showRoleChangeConfirm.newRole}</strong>.
                {showRoleChangeConfirm.oldRole === 'owner' && showRoleChangeConfirm.newRole !== 'owner' && (
                  <span className="block mt-2 text-destructive">
                    Warning: Removing owner status will reduce this member's permissions significantly.
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={updateMemberRole.isPending}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmRoleChange}
                disabled={updateMemberRole.isPending}
              >
                {updateMemberRole.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Confirm Change'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Invite Dialog */}
      <InviteTeamMemberDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        teamId={teamId}
      />
    </>
  );
}

