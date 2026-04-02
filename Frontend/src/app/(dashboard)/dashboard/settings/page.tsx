"use client";

import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileForm } from "@/components/settings/profile-form";
import { SubscriptionCard } from "@/components/settings/subscription-card";
import { PlanUpgradeCard } from "@/components/settings/plan-upgrade-card";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your account and subscription" />

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="bg-brand-800">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <ProfileForm />
        </TabsContent>

        <TabsContent value="billing" className="mt-6 space-y-6">
          <SubscriptionCard />
          <PlanUpgradeCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
