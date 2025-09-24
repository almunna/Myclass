"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/firebase/firebase";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  serverTimestamp,
  orderBy,
  query,
} from "firebase/firestore";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Trash2, ExternalLink } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserEmail?: string;
  currentUserId?: string;
};

interface TutorialVideo {
  id: string;
  title: string;
  url: string; // original url or just ID
  videoId: string; // extracted YouTube video id
  createdAt?: any;
  createdBy?: string;
  createdByEmail?: string;
}

function extractYouTubeId(input: string): string | null {
  const trimmed = input.trim();

  // If it's already a short ID-like string
  if (/^[a-zA-Z0-9_-]{6,}$/.test(trimmed) && !trimmed.includes("http")) {
    return trimmed;
  }

  // Try URL patterns
  try {
    const u = new URL(trimmed);
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v");
      if (id) return id;
    }
    if (u.hostname.includes("youtu.be")) {
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0]) return parts[0];
    }
  } catch {
    // not a URL, ignore
  }

  // Fallback regexes
  const regexes = [
    /v=([a-zA-Z0-9_-]{6,})/,
    /youtu\.be\/([a-zA-Z0-9_-]{6,})/,
    /embed\/([a-zA-Z0-9_-]{6,})/,
  ];

  for (const r of regexes) {
    const m = trimmed.match(r);
    if (m?.[1]) return m[1];
  }

  return null;
}

export default function TutorialVideosModal({
  open,
  onOpenChange,
  currentUserEmail,
  currentUserId,
}: Props) {
  const [videos, setVideos] = useState<TutorialVideo[]>([]);
  const [title, setTitle] = useState("");
  const [urlOrId, setUrlOrId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingList, setLoadingList] = useState(false);

  const thumbUrl = useMemo(() => {
    const id = extractYouTubeId(urlOrId || "");
    return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : "";
  }, [urlOrId]);

  const loadVideos = async () => {
    setLoadingList(true);
    try {
      const q = query(
        collection(db, "tutorialVideos"),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      const list: TutorialVideo[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          title: data.title || "",
          url: data.url || "",
          videoId: data.videoId || "",
          createdAt: data.createdAt,
          createdBy: data.createdBy,
          createdByEmail: data.createdByEmail,
        };
      });
      setVideos(list);
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to load tutorial videos");
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadVideos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onAdd = async () => {
    const id = extractYouTubeId(urlOrId || "");
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }
    if (!id) {
      toast.error("Please provide a valid YouTube URL or video ID");
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, "tutorialVideos"), {
        title: title.trim(),
        url: urlOrId.trim(),
        videoId: id,
        createdAt: serverTimestamp(),
        createdBy: currentUserId || null,
        createdByEmail: currentUserEmail || null,
      });
      toast.success("Tutorial added");
      setTitle("");
      setUrlOrId("");
      await loadVideos();
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to add tutorial");
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "tutorialVideos", id));
      toast.success("Deleted");
      setVideos((prev) => prev.filter((v) => v.id !== id));
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to delete");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Responsive, scrollable modal:
         - w-[95vw] on small screens, cap width on larger
         - max-h-[85vh] with internal scrolling
         - overflow handling for the table (x-scroll) */}
      <DialogContent className="w-[95vw] max-w-4xl md:max-w-5xl lg:max-w-6xl p-4 md:p-6 overflow-hidden">
        <div className="max-h-[85vh] overflow-y-auto">
          <DialogHeader className="sticky top-0 bg-background z-10 pb-4">
            <DialogTitle>Manage Tutorial Videos</DialogTitle>
            <DialogDescription>
              Add YouTube tutorials (paste full URL or just the video ID), and
              manage the list.
            </DialogDescription>
          </DialogHeader>

          {/* Add form */}
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 items-end">
              <div className="md:col-span-1">
                <Label htmlFor="tutorial-title">Title</Label>
                <Input
                  id="tutorial-title"
                  placeholder="e.g., Getting Started with My Class Log"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="md:col-span-1">
                <Label htmlFor="tutorial-url">YouTube URL or ID</Label>
                <Input
                  id="tutorial-url"
                  placeholder="https://youtu.be/VIDEO_ID or VIDEO_ID"
                  value={urlOrId}
                  onChange={(e) => setUrlOrId(e.target.value)}
                />
              </div>
              <div className="md:col-span-1 flex gap-2">
                <Button
                  className="w-full"
                  onClick={onAdd}
                  disabled={submitting}
                >
                  {submitting ? "Adding..." : "Add Tutorial"}
                </Button>
                <Button
                  variant="outline"
                  className="hidden md:inline-flex w-full"
                  onClick={loadVideos}
                  disabled={loadingList}
                >
                  {loadingList ? "Refreshing..." : "Refresh"}
                </Button>
              </div>
              {/* Show refresh button on small screens below inputs */}
              <div className="md:hidden">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={loadVideos}
                  disabled={loadingList}
                >
                  {loadingList ? "Refreshing..." : "Refresh"}
                </Button>
              </div>
            </div>

            {/* Preview */}
            {thumbUrl ? (
              <div className="flex items-center gap-3">
                <img
                  src={thumbUrl}
                  alt="thumbnail"
                  className="h-20 w-32 rounded-md border object-cover"
                />
                <div className="text-sm text-muted-foreground">
                  Thumbnail preview
                </div>
              </div>
            ) : null}
          </div>

          {/* List */}
          <div className="rounded-md border mt-6 overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="min-w-[120px]">Thumbnail</TableHead>
                  <TableHead className="min-w-[220px]">Title</TableHead>
                  <TableHead className="min-w-[160px]">Video ID</TableHead>
                  <TableHead className="min-w-[160px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {videos.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-muted-foreground"
                    >
                      No tutorials yet.
                    </TableCell>
                  </TableRow>
                )}
                {videos.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="align-middle">
                      <img
                        src={`https://img.youtube.com/vi/${v.videoId}/mqdefault.jpg`}
                        alt={v.title}
                        className="h-14 w-24 rounded border object-cover"
                      />
                    </TableCell>
                    <TableCell className="font-medium">{v.title}</TableCell>
                    <TableCell className="font-mono">{v.videoId}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <a
                          href={`https://www.youtube.com/watch?v=${v.videoId}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Button variant="outline" size="sm" className="gap-1">
                            <ExternalLink className="h-4 w-4" />
                            Watch
                          </Button>
                        </a>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-500 hover:text-red-500"
                          onClick={() => onDelete(v.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
