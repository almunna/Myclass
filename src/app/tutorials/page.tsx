"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/firebase/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ExternalLink, Play } from "lucide-react";
import WatchModal from "@/components/WatchModal"; // ✅ added

type TutorialVideo = {
  id: string;
  title: string;
  url: string;
  videoId: string;
  createdAt?: any;
  createdBy?: string;
  createdByEmail?: string;
};

export default function TutorialsPage() {
  const [allVideos, setAllVideos] = useState<TutorialVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [qText, setQText] = useState("");
  const [activeVideo, setActiveVideo] = useState<TutorialVideo | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const qRef = query(
          collection(db, "tutorialVideos"),
          orderBy("createdAt", "desc")
        );
        const snap = await getDocs(qRef);
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
        setAllVideos(list);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const t = qText.trim().toLowerCase();
    if (!t) return allVideos;
    return allVideos.filter((v) =>
      [v.title, v.videoId, v.createdByEmail]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(t))
    );
  }, [qText, allVideos]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Tutorials</h1>
          <p className="text-muted-foreground">
            Watch step-by-step videos to get the most out of My Class Log.
          </p>
        </div>
        <div className="w-full md:w-80">
          <Input
            placeholder="Search tutorials..."
            value={qText}
            onChange={(e) => setQText(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-56 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <CardTitle className="mb-2">No tutorials found</CardTitle>
          <CardDescription>
            Try a different search term, or check back later for new videos.
          </CardDescription>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filtered.map((v) => (
            <Card
              key={v.id}
              className="group overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className="relative aspect-video overflow-hidden">
                <img
                  src={`https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`}
                  alt={v.title}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <button
                  onClick={() => setActiveVideo(v)}
                  className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={`Play ${v.title}`}
                >
                  <div className="flex items-center gap-2 rounded-full bg-background/90 px-4 py-2 text-sm font-medium shadow">
                    <Play className="h-4 w-4" />
                    Play
                  </div>
                </button>
              </div>

              {/* Header with title at left and YouTube button at top-right */}
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base line-clamp-2">
                      {v.title}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {v.createdAt?.toDate
                        ? v.createdAt.toDate().toLocaleDateString()
                        : ""}
                    </CardDescription>
                  </div>

                  <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    title="Open on YouTube"
                    aria-label={`Open ${v.title} on YouTube`}
                    className="shrink-0"
                  >
                    <a
                      href={`https://www.youtube.com/watch?v=${v.videoId}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setActiveVideo(v)}
                    className="w-full"
                    size="sm"
                  >
                    Watch
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Video Modal (using WatchModal) */}
      <WatchModal
        open={!!activeVideo}
        onOpenChange={(o) => !o && setActiveVideo(null)}
        title={activeVideo?.title || "Tutorial"}
        description={
          activeVideo?.createdAt?.toDate
            ? activeVideo.createdAt.toDate().toLocaleString()
            : undefined
        }
        videoUrl={
          activeVideo
            ? `https://www.youtube.com/embed/${activeVideo.videoId}?autoplay=1&rel=0`
            : ""
        }
        size="xl"
        rounded="2xl"
        blurBackdrop
        disableOutsideClose={false}
        showFooter={false}
      />
    </div>
  );
}
