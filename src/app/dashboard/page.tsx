"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/firebase/firebase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, BookOpen, Clock, Check } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useSubscriptionAccess } from "@/hooks/useSubscriptionAccess";
import { NoAccess } from "@/components/NoAccess";

interface Stats {
  students: number;
  schoolYears: number;
  periods: number;
  roomExits: number;
  activeExits: number;
}

export default function DashboardPage() {
  const { currentUser } = useAuth();
  // const { hasAccess, loading: subscriptionLoading } = useSubscriptionAccess();
  const [stats, setStats] = useState<Stats>({
    students: 0,
    schoolYears: 0,
    periods: 0,
    roomExits: 0,
    activeExits: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser) {
      fetchStats();
    }
  }, [currentUser]);

  const fetchStats = async () => {
    try {
      // Fetch students count
      const studentsQuery = query(
        collection(db, "students"),
        where("teacherId", "==", currentUser?.uid)
      );
      const studentsSnapshot = await getDocs(studentsQuery);
      
      // Fetch school years count
      const schoolYearsQuery = query(
        collection(db, "schoolYears"),
        where("teacherId", "==", currentUser?.uid)
      );
      const schoolYearsSnapshot = await getDocs(schoolYearsQuery);
      
      // Fetch periods count
      const periodsQuery = query(
        collection(db, "periods"),
        where("teacherId", "==", currentUser?.uid)
      );
      const periodsSnapshot = await getDocs(periodsQuery);
      
      // Fetch room exits count (total and active)
      const roomExitsQuery = query(
        collection(db, "roomExits"),
        where("teacherId", "==", currentUser?.uid)
      );
      const roomExitsSnapshot = await getDocs(roomExitsQuery);
      
      // Count active exits (status = "out")
      let activeCount = 0;
      roomExitsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.status === "out") {
          activeCount++;
        }
      });
      
      setStats({
        students: studentsSnapshot.size,
        schoolYears: schoolYearsSnapshot.size,
        periods: periodsSnapshot.size,
        roomExits: roomExitsSnapshot.size,
        activeExits: activeCount,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking subscription
  // if (subscriptionLoading) {
  //   return (
  //     <ProtectedRoute>
  //       <div className="flex justify-center items-center h-screen">
  //         <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  //       </div>
  //     </ProtectedRoute>
  //   );
  // }

  // // Show no access if user doesn't have subscription
  // if (!hasAccess) {
  //   return (
  //     <ProtectedRoute>
  //       <NoAccess 
  //         title="Dashboard" 
  //         description="Access to the dashboard requires an active subscription." 
  //       />
  //     </ProtectedRoute>
  //   );
  // }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.students}</div>
              <p className="text-xs text-muted-foreground pt-1">
                Students being tracked
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">School Years</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.schoolYears}</div>
              <p className="text-xs text-muted-foreground pt-1">
                Academic years
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Class Periods</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.periods}</div>
              <p className="text-xs text-muted-foreground pt-1">
                Active class periods
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Total Room Exits</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.roomExits}</div>
              <p className="text-xs text-muted-foreground pt-1">
                All time student room exits
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Students Out</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeExits}</div>
              <p className="text-xs text-muted-foreground pt-1">
                Students currently out
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Common tasks you might want to perform
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Link href="/students" className="w-full cursor-pointer">
            <Button variant="outline" className="w-full justify-start">
                  <Users className="mr-2 h-4 w-4" />
                  Manage Students
                </Button>
              </Link>
              <Link href="/periods" className="w-full cursor-pointer">
            <Button variant="outline" className="w-full justify-start">
                  <BookOpen className="mr-2 h-4 w-4" />
                  Manage School Years & Periods
                </Button>
              </Link>
              <Link href="/attendance" className="w-full cursor-pointer">
            <Button variant="outline" className="w-full justify-start">
                  <Check className="mr-2 h-4 w-4" />
                  Take Attendance
                </Button>
              </Link>
              <Link href="/tracking" className="w-full cursor-pointer">
            <Button variant="outline" className="w-full justify-start">
                  <Clock className="mr-2 h-4 w-4" />
                  Track Room Exits
                </Button>
              </Link>
              <Link href="/reports" className="w-full cursor-pointer">
            <Button variant="outline" className="w-full justify-start">
                  <Clock className="mr-2 h-4 w-4" />
                  View Reports
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Getting Started</CardTitle>
              <CardDescription>
                Follow these steps to set up your hierarchical tracking system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="rounded-full bg-primary/10 p-2 text-primary">
                  <span className="font-bold">1</span>
                </div>
                <div>
                  <h3 className="font-medium">Create school years</h3>
                  <p className="text-sm text-muted-foreground">
                    Set up academic years (e.g., "2024-2025")
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="rounded-full bg-primary/10 p-2 text-primary">
                  <span className="font-bold">2</span>
                </div>
                <div>
                  <h3 className="font-medium">Add class periods</h3>
                  <p className="text-sm text-muted-foreground">
                    Create periods within each school year
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="rounded-full bg-primary/10 p-2 text-primary">
                  <span className="font-bold">3</span>
                </div>
                <div>
                  <h3 className="font-medium">Add students</h3>
                  <p className="text-sm text-muted-foreground">
                    Add students and assign them to periods
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="rounded-full bg-primary/10 p-2 text-primary">
                  <span className="font-bold">4</span>
                </div>
                <div>
                  <h3 className="font-medium">Track & filter</h3>
                  <p className="text-sm text-muted-foreground">
                    Use advanced filtering by school year and period
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  );
} 