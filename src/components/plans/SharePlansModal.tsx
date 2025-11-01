"use client";

import * as React from "react";
import { db } from "@/firebase/firebase";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { useToast } from "@/components/ui/use-toast";
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
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Share = {
  email: string;
  createdAt?: any;
};

export function SharePlansModal({
  open,
  onOpenChange,
  ownerId,
  schoolYearId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ownerId: string | undefined;
  schoolYearId: string | undefined;
}) {
  const { toast } = useToast();
  const [email, setEmail] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [loadingList, setLoadingList] = React.useState(false);
  const [shares, setShares] = React.useState<Share[]>([]);

  // NEW: share window controls
  const [limitType, setLimitType] = React.useState<"none" | "single" | "range">(
    "none"
  );
  const [singleDate, setSingleDate] = React.useState("");
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");

  const rangeError =
    limitType === "range" && fromDate && toDate && fromDate > toDate
      ? "From date must be on or before To date."
      : "";

  const windowValid =
    limitType === "none" ||
    (limitType === "single" && !!singleDate) ||
    (limitType === "range" && !!fromDate && !!toDate && !rangeError);

  // Use exact email (no lowercasing) for doc IDs to match rules
  const emailId = email.trim();
  const validEmail =
    !!emailId &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailId) &&
    ownerId &&
    schoolYearId;

  const canShare = !!validEmail && windowValid && !saving;

  const pathOk = !!ownerId && !!schoolYearId;

  // ===== Share URL helpers (updated) =====
  function getOrigin() {
    if (typeof window !== "undefined" && window.location?.origin) {
      return window.location.origin;
    }
    return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "";
  }

  function buildShareUrl() {
    if (!pathOk) return "";
    const origin = getOrigin();
    if (!origin) return "";
    const url = new URL("/share", origin);
    url.searchParams.set("ownerId", ownerId!);
    url.searchParams.set("schoolYearId", schoolYearId!);

    if (limitType === "single" && singleDate) {
      url.searchParams.set("date", singleDate);
    } else if (limitType === "range") {
      if (fromDate) url.searchParams.set("from", fromDate);
      if (toDate) url.searchParams.set("to", toDate);
    }

    return url.toString();
  }

  async function copyShareUrl() {
    const link = buildShareUrl();
    if (!link || rangeError) return;
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: "Share link copied", description: link });
    } catch (err) {
      toast({
        title: "Couldn’t copy link",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  }
  // =====================================

  const loadShares = React.useCallback(async () => {
    if (!pathOk) {
      setShares([]);
      return;
    }
    setLoadingList(true);
    try {
      const snap = await getDocs(
        collection(db, "planShares", ownerId!, schoolYearId!)
      );
      const items: Share[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        items.push({ email: data.email ?? d.id, createdAt: data.createdAt });
      });
      items.sort((a, b) => (a.email || "").localeCompare(b.email || ""));
      setShares(items);
    } finally {
      setLoadingList(false);
    }
  }, [ownerId, schoolYearId, pathOk]);

  React.useEffect(() => {
    if (open) loadShares();
  }, [open, loadShares]);

  async function addShare() {
    if (!validEmail || !windowValid) return;
    setSaving(true);
    try {
      const docRef = doc(db, "planShares", ownerId!, schoolYearId!, emailId);

      // NEW: persist date window in the share doc
      await setDoc(
        docRef,
        {
          ownerId,
          schoolYearId,
          email: emailId,
          createdAt: serverTimestamp(),
          limitType, // "none" | "single" | "range"
          singleDate: limitType === "single" ? singleDate : null,
          from: limitType === "range" ? fromDate : null,
          to: limitType === "range" ? toDate : null,
        },
        { merge: true }
      );

      toast({
        title: "Access granted",
        description: `Read-only access for ${emailId}`,
      });
      setEmail("");
      await loadShares();
    } catch (err) {
      toast({
        title: "Could not grant access",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function revokeShare(targetEmail: string) {
    if (!pathOk) return;
    try {
      await deleteDoc(
        doc(db, "planShares", ownerId!, schoolYearId!, targetEmail)
      );
      toast({
        title: "Access revoked",
        description: targetEmail,
      });
      await loadShares();
    } catch (err) {
      toast({
        title: "Could not revoke access",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  }

  const shareUrl = buildShareUrl();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Share your plans</DialogTitle>
          <DialogDescription>
            Grant <span className="font-medium">read-only</span> access to your
            lesson plans for the currently selected school year by entering the
            recipient’s email.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!pathOk && (
            <div className="text-sm text-destructive">
              Select a School Year before sharing.
            </div>
          )}

          {/* Limit selector (NEW) */}
          {pathOk && (
            <div className="space-y-2">
              <Label className="text-sm">Limit shared window</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant={limitType === "none" ? "default" : "outline"}
                  onClick={() => setLimitType("none")}
                >
                  Entire year
                </Button>
                <Button
                  type="button"
                  variant={limitType === "single" ? "default" : "outline"}
                  onClick={() => setLimitType("single")}
                >
                  Single day
                </Button>
                <Button
                  type="button"
                  variant={limitType === "range" ? "default" : "outline"}
                  onClick={() => setLimitType("range")}
                >
                  Date range
                </Button>
              </div>

              {limitType === "single" && (
                <div className="grid gap-2 mt-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={singleDate}
                    onChange={(e) => setSingleDate(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Appends <code>?date=YYYY-MM-DD</code> to the link.
                  </p>
                </div>
              )}

              {limitType === "range" && (
                <div className="grid md:grid-cols-2 gap-3 mt-2">
                  <div className="grid gap-2">
                    <Label>From</Label>
                    <Input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>To</Label>
                    <Input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                    />
                  </div>
                  {!!rangeError && (
                    <div className="md:col-span-2 text-xs text-destructive">
                      {rangeError}
                    </div>
                  )}
                  <div className="md:col-span-2 text-xs text-muted-foreground">
                    Appends <code>?from=YYYY-MM-DD</code> and{" "}
                    <code>?to=YYYY-MM-DD</code>.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Share link */}
          {pathOk && shareUrl && (
            <div className="space-y-2">
              <Label>Share link</Label>
              <div className="flex gap-2">
                <Input value={shareUrl} readOnly />
                <Button
                  type="button"
                  onClick={copyShareUrl}
                  disabled={!!rangeError}
                >
                  Copy link
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Send this link to invited users. They must be signed in with the
                email you added to view read-only plans.
              </p>
            </div>
          )}

          {/* Add email */}
          <div className="space-y-2">
            <Label htmlFor="share-email">Recipient email</Label>
            <div className="flex gap-2">
              <Input
                id="share-email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!pathOk || saving}
                autoComplete="email"
              />
              <Button onClick={addShare} disabled={!canShare}>
                {saving ? "Adding..." : "Share"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              They will be able to view your plans (read-only) for this School
              Year.
            </p>
          </div>

          {/* People with access */}
          <div className="space-y-2">
            <Label>People with access</Label>
            <div
              className={cn(
                "rounded-md border",
                shares.length ? "divide-y" : "p-3 text-sm text-muted-foreground"
              )}
            >
              {loadingList ? (
                <div className="p-3 text-sm">Loading…</div>
              ) : shares.length ? (
                shares.map((s) => (
                  <div
                    key={s.email}
                    className="flex items-center justify-between p-3"
                  >
                    <div className="text-sm">{s.email}</div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => revokeShare(s.email)}
                      title="Revoke access"
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> Revoke
                    </Button>
                  </div>
                ))
              ) : (
                "No one yet"
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
