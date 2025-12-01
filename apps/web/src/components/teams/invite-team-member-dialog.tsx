"use client";

import { useState } from "react";
import { Loader2, Copy, Check, Mail, Link2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useInviteTeamMember, useGenerateTeamInviteLink } from "@/hooks/use-teams";

interface InviteTeamMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
}

export function InviteTeamMemberDialog({
  open,
  onOpenChange,
  teamId,
}: InviteTeamMemberDialogProps) {
  const [mode, setMode] = useState<"email" | "link">("email");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const inviteMember = useInviteTeamMember();
  const generateLink = useGenerateTeamInviteLink();

  const isLoading = inviteMember.isPending || generateLink.isPending;

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      return;
    }

    try {
      const result = await inviteMember.mutateAsync({
        teamId,
        email: email.trim(),
        role,
      });

      if (result?.inviteLink) {
        setInviteLink(result.inviteLink);
      } else {
        // Close dialog on success if no link to show
        onOpenChange(false);
        setEmail("");
        setRole("member");
      }
    } catch (error) {
      // Error is handled by the hook (toast)
    }
  };

  const handleGenerateLink = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const result = await generateLink.mutateAsync({
        teamId,
        role,
      });

      if (result?.inviteLink) {
        setInviteLink(result.inviteLink);
      }
    } catch (error) {
      // Error is handled by the hook (toast)
    }
  };

  const handleCopyLink = async () => {
    if (inviteLink) {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after a short delay to allow dialog to close
    setTimeout(() => {
      setMode("email");
      setEmail("");
      setRole("member");
      setInviteLink(null);
      setCopied(false);
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            {inviteLink
              ? "Share this link with the person you want to invite."
              : "Choose how you'd like to invite someone to join your team."}
          </DialogDescription>
        </DialogHeader>

        {inviteLink ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Invite Link</Label>
              <div className="flex gap-2">
                <Input
                  value={inviteLink}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCopyLink}
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Copy this link and share it with the person you want to invite. They&apos;ll be able to create an account and join your team.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={handleClose} variant="outline">
                Done
              </Button>
              <Button onClick={() => {
                setInviteLink(null);
                setMode("email");
              }}>
                Invite Another
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Mode Toggle */}
            <div className="flex gap-2 rounded-lg border p-1">
              <Button
                type="button"
                variant={mode === "email" ? "default" : "ghost"}
                className="flex-1"
                onClick={() => setMode("email")}
                disabled={isLoading}
              >
                <Mail className="mr-2 h-4 w-4" />
                Send Email
              </Button>
              <Button
                type="button"
                variant={mode === "link" ? "default" : "ghost"}
                className="flex-1"
                onClick={() => setMode("link")}
                disabled={isLoading}
              >
                <Link2 className="mr-2 h-4 w-4" />
                Generate Link
              </Button>
            </div>

            {mode === "email" ? (
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="colleague@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                  <p className="text-sm text-muted-foreground">
                    The invitee will receive an email with a link to accept the invitation.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role-email">Role</Label>
                  <Select
                    value={role}
                    onValueChange={(value: "member" | "admin") => setRole(value)}
                    disabled={isLoading}
                  >
                    <SelectTrigger id="role-email">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Members can view and edit projects. Admins can also manage team settings and members.
                  </p>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isLoading || !email.trim()}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Send Invitation
                  </Button>
                </DialogFooter>
              </form>
            ) : (
              <form onSubmit={handleGenerateLink} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="role-link">Role</Label>
                  <Select
                    value={role}
                    onValueChange={(value: "member" | "admin") => setRole(value)}
                    disabled={isLoading}
                  >
                    <SelectTrigger id="role-link">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Generate a shareable link. Anyone with the link can create an account and join your team as a {role}.
                  </p>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Generate Link
                  </Button>
                </DialogFooter>
              </form>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

