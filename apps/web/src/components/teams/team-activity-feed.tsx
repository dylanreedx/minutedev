"use client";

import { useTeamActivity } from "@/hooks/use-team-activity";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { 
  UserPlus, 
  UserMinus, 
  UserCog, 
  Users, 
  Settings, 
  Trash2, 
  FolderKanban,
  Mail,
  MailCheck,
  X,
  Link
} from "lucide-react";
import type { TeamActivityAction } from "@/hooks/use-team-activity";

interface TeamActivityFeedProps {
  teamId: string;
}

function getActivityIcon(action: TeamActivityAction) {
  switch (action) {
    case 'member_joined':
      return <UserPlus className="h-4 w-4" />;
    case 'member_left':
      return <UserMinus className="h-4 w-4" />;
    case 'role_changed':
      return <UserCog className="h-4 w-4" />;
    case 'team_created':
      return <Users className="h-4 w-4" />;
    case 'team_updated':
      return <Settings className="h-4 w-4" />;
    case 'team_deleted':
      return <Trash2 className="h-4 w-4" />;
    case 'project_created':
      return <FolderKanban className="h-4 w-4" />;
    case 'invitation_sent':
      return <Mail className="h-4 w-4" />;
    case 'invitation_accepted':
      return <MailCheck className="h-4 w-4" />;
    case 'invitation_cancelled':
      return <X className="h-4 w-4" />;
    case 'invitation_link_generated':
      return <Link className="h-4 w-4" />;
    default:
      return <Users className="h-4 w-4" />;
  }
}

function getActivityMessage(action: TeamActivityAction, details: Record<string, unknown> | null, userName: string | null) {
  const name = userName || 'Someone';
  
  switch (action) {
    case 'member_joined':
      return `${name} joined the team`;
    case 'member_left':
      return `${name} left the team`;
    case 'role_changed':
      const oldRole = details?.oldRole as string;
      const newRole = details?.newRole as string;
      const targetUser = details?.targetUserName as string || 'a member';
      return `${name} changed ${targetUser}'s role from ${oldRole} to ${newRole}`;
    case 'team_created':
      return `${name} created the team`;
    case 'team_updated':
      return `${name} updated team settings`;
    case 'team_deleted':
      return `${name} deleted the team`;
    case 'project_created':
      const projectName = details?.projectName as string || 'a project';
      return `${name} created project "${projectName}"`;
    case 'invitation_sent':
      const email = details?.email as string || 'a user';
      return `${name} invited ${email} to the team`;
    case 'invitation_accepted':
      return `${name} accepted the team invitation`;
    case 'invitation_cancelled':
      return `${name} cancelled an invitation`;
    case 'invitation_link_generated':
      const role = details?.role as string || 'member';
      return `${name} generated an invite link for ${role} role`;
    default:
      return `${name} performed an action`;
  }
}

export function TeamActivityFeed({ teamId }: TeamActivityFeedProps) {
  const { data: activities = [], isLoading } = useTeamActivity(teamId, { limit: 20 });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        No activity yet. Team activity will appear here.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activities.map((activity) => {
        const userName = activity.user?.name || activity.user?.email || 'Unknown';
        const userInitials = userName
          .split(' ')
          .map((n: string) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);

        return (
          <div key={activity.id} className="flex items-start gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={activity.user?.image || undefined} />
              <AvatarFallback>{userInitials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="text-muted-foreground">
                  {getActivityIcon(activity.action)}
                </div>
                <p className="text-sm">
                  {getActivityMessage(activity.action, activity.details, userName)}
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {activity.createdAt
                  ? formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })
                  : 'Just now'}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

