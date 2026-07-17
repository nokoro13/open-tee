"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, UserMinus } from "lucide-react";

import {
  inviteCourseEditor,
  revokeCourseEditor,
} from "@/actions/course-access";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { CourseAccess } from "@/db/schema";
import { courseAccessLabel } from "@/lib/course-access-utils";

type CourseAccessPanelProps = {
  courseId: string;
  grants: CourseAccess[];
};

export function CourseAccessPanel({ courseId, grants }: CourseAccessPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div>
        <h2 className="text-base font-semibold">Course editor access</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Invite golf course staff to manage this course. They sign in with Clerk
          using the invited email and will see this course in their dashboard.
        </p>
      </div>

      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          setMessage(null);
          startTransition(async () => {
            const result = await inviteCourseEditor(courseId, email);
            if (!result.success) {
              setError(result.error ?? "Could not send invite.");
              return;
            }
            setEmail("");
            setMessage(
              result.activatedImmediately
                ? "Access granted. They can edit this course now."
                : "Invite saved. Access activates when they sign up with that email."
            );
            router.refresh();
          });
        }}
      >
        <Field className="flex-1">
          <FieldLabel htmlFor="courseEditorEmail">Editor email</FieldLabel>
          <Input
            id="courseEditorEmail"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="proshop@example.com"
            required
          />
          <FieldDescription>
            Uses their Clerk account email once they sign up or sign in.
          </FieldDescription>
        </Field>
        <Button type="submit" disabled={isPending || email.trim().length === 0}>
          <Mail />
          {isPending ? "Inviting..." : "Grant access"}
        </Button>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {message && <p className="text-sm text-primary">{message}</p>}

      {grants.length > 0 && (
        <ul className="divide-y rounded-md border">
          {grants.map((grant) => (
            <li
              key={grant.id}
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-3"
            >
              <div className="space-y-1">
                <p className="text-sm font-medium">{courseAccessLabel(grant)}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="capitalize">
                    {grant.role.replace("_", " ")}
                  </Badge>
                  <Badge
                    variant={grant.status === "active" ? "default" : "secondary"}
                    className="capitalize"
                  >
                    {grant.status}
                  </Badge>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => {
                  setError(null);
                  setMessage(null);
                  startTransition(async () => {
                    const result = await revokeCourseEditor(grant.id, courseId);
                    if (!result.success) {
                      setError(result.error ?? "Could not revoke access.");
                      return;
                    }
                    setMessage("Access revoked.");
                    router.refresh();
                  });
                }}
              >
                <UserMinus />
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
