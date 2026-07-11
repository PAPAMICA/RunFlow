"use client";

import { useEffect, useState } from "react";
import { Building2, User } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, Organization, User as UserType } from "@/lib/api";

export default function SettingsPage() {
  const [user, setUser] = useState<UserType | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getMe(), api.getOrganization()])
      .then(([u, o]) => {
        setUser(u);
        setOrg(o);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <PageHeader
        title="Paramètres"
        description="Compte et organisation"
      />

      <div className="grid gap-6 md:grid-cols-2 max-w-3xl">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Compte</CardTitle>
                <CardDescription>Votre profil utilisateur</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-20 w-full" />
            ) : user ? (
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Email</dt>
                  <dd className="font-medium mt-0.5">{user.email}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Statut</dt>
                  <dd className="font-medium mt-0.5">{user.enabled ? "Actif" : "Désactivé"}</dd>
                </div>
              </dl>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-accent/10 p-2">
                <Building2 className="h-5 w-5 text-accent" />
              </div>
              <div>
                <CardTitle>Organisation</CardTitle>
                <CardDescription>Espace de travail partagé</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-20 w-full" />
            ) : org ? (
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Nom</dt>
                  <dd className="font-medium mt-0.5">{org.name}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Slug</dt>
                  <dd className="font-mono text-xs mt-0.5">{org.slug}</dd>
                </div>
              </dl>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
