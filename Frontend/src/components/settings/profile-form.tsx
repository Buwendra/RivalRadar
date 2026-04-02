"use client";

import { useState } from "react";
import { toast } from "sonner";
import { usersApi } from "@/lib/api/users";
import { useAuth } from "@/lib/auth/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/shared/loading-spinner";

export function ProfileForm() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await usersApi.updateProfile({ name: name.trim() });
      await refreshUser();
      toast.success("Profile updated");
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="border-brand-700 bg-brand-900">
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Manage your account information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={user?.email ?? ""} disabled className="opacity-60" />
          <p className="text-xs text-muted-foreground">Email cannot be changed</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </div>
        <Button
          onClick={handleSave}
          disabled={isSaving || name.trim() === user?.name}
        >
          {isSaving && <LoadingSpinner size="sm" className="mr-2" />}
          Save Changes
        </Button>
      </CardContent>
    </Card>
  );
}
