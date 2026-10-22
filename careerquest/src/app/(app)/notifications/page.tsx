import type { Metadata } from "next";
import Link from "next/link";
import { BellOff, Check } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { generateDueNotifications, getPrefs, listNotifications } from "@/lib/notifications/service";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/lib/notifications/actions";
import { pushConfig } from "@/lib/notifications/push";
import { formatRelative } from "@/lib/format";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, PageHeader, Badge } from "@/components/ui";
import { NotificationPrefsForm } from "@/components/notifications/prefs-form";
import { PushToggle } from "@/components/notifications/push-toggle";
import { InstallAppCard } from "@/components/notifications/install-app-card";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser("/notifications");
  await generateDueNotifications(user.id, { force: true });
  const [items, prefs] = await Promise.all([listNotifications(user.id), getPrefs(user.id)]);
  const push = pushConfig();
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Reminders come from your own data: follow-up dates, scheduled interviews, renewal dates you entered, and weekly reports."
        actions={
          unread > 0 ? (
            <form action={markAllNotificationsReadAction}>
              <Button type="submit" variant="secondary" size="sm">
                <Check className="h-4 w-4" aria-hidden /> Mark all read
              </Button>
            </form>
          ) : undefined
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section aria-label="Notification list" className="min-w-0">
          {items.length === 0 ? (
            <EmptyState
              icon={<BellOff className="h-6 w-6" aria-hidden />}
              title="No notifications yet"
              description="Set follow-up dates on applications or schedule interviews and reminders will appear here."
              action={
                <Link href="/applications" className="text-accent text-sm hover:underline">
                  Go to your applications
                </Link>
              }
            />
          ) : (
            <ul className="space-y-2">
              {items.map((n) => (
                <li key={n.id} className={`glass rounded-card p-4 flex items-start gap-3 ${n.readAt ? "opacity-70" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {!n.readAt && <Badge tone="accent">New</Badge>}
                      <p className="font-medium text-sm">{n.link ? <Link href={n.link} className="hover:underline">{n.title}</Link> : n.title}</p>
                    </div>
                    {n.body && <p className="text-sm text-fg-muted mt-1">{n.body}</p>}
                    <p className="text-xs text-fg-subtle mt-1">{formatRelative(n.createdAt)}</p>
                  </div>
                  {!n.readAt && (
                    <form action={markNotificationReadAction}>
                      <input type="hidden" name="id" value={n.id} />
                      <Button type="submit" variant="ghost" size="sm" aria-label={`Mark “${n.title}” as read`}>
                        Mark read
                      </Button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Reminder preferences</CardTitle>
                <CardDescription>Choose what CareerQuest reminds you about. Nothing is ever sent to employers.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <NotificationPrefsForm prefs={prefs} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Push reminders</CardTitle>
                <CardDescription>Get reminders on your phone or desktop even when CareerQuest is closed.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {push.enabled ? (
                <PushToggle publicKey={push.publicKey} />
              ) : (
                <p className="text-sm text-fg-muted">
                  Push delivery isn&apos;t configured on this server (VAPID keys missing). Reminders still appear here and on the bell icon.
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Install the app</CardTitle>
            </CardHeader>
            <CardContent>
              <InstallAppCard />
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}
