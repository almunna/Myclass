"use client";

import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/firebase/firebase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  Shield,
  Database,
  Activity,
  Trash2,
  Eye,
  Crown,
  UserCheck,
  Calendar,
  BookOpen,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { hasAdminAccess } from "@/lib/admin";
import { toast } from "sonner";
import { getUserSubscription } from "@/lib/db/users";

// ✅ NEW: modal component import
import TutorialVideosModal from "@/components/admin/TutorialVideosModal";

interface AdminStats {
  totalUsers: number;
  activeSubscriptions: number;
  totalStudents: number;
  totalPeriods: number;
  totalRoomExits: number;
}

interface UserData {
  uid: string;
  email: string;
  displayName?: string;
  createdAt?: any;
  lastSignIn?: any;
  subscription?: any;
}

export default function AdminPage() {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    activeSubscriptions: 0,
    totalStudents: 0,
    totalPeriods: 0,
    totalRoomExits: 0,
  });
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // ✅ NEW: modal open state
  const [showTutorialsModal, setShowTutorialsModal] = useState(false);

  // Check if current user is admin
  const isAdmin = currentUser ? hasAdminAccess(currentUser) : false;

  useEffect(() => {
    if (isAdmin) {
      fetchAdminData();
    }
  }, [isAdmin]);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchStats(), fetchUsers()]);
    } catch (error) {
      console.error("Error fetching admin data:", error);
      toast.error("Failed to load admin data");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      console.log("🔍 Admin: Fetching stats...");

      // Get all users
      const usersSnapshot = await getDocs(collection(db, "users"));
      const totalUsers = usersSnapshot.size;
      console.log("👥 Users found:", totalUsers);

      // Count active subscriptions
      let activeSubscriptions = 0;
      usersSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        console.log("User data:", {
          email: data.email,
          status: data.subscriptionStatus,
        });
        if (data.subscriptionStatus === "active") {
          activeSubscriptions++;
        }
      });
      console.log("💳 Active subscriptions:", activeSubscriptions);

      // Get total students
      const studentsSnapshot = await getDocs(collection(db, "students"));
      const totalStudents = studentsSnapshot.size;
      console.log("👨‍🎓 Students found:", totalStudents);

      // Get total periods
      const periodsSnapshot = await getDocs(collection(db, "periods"));
      const totalPeriods = periodsSnapshot.size;
      console.log("📚 Periods found:", totalPeriods);

      // Get total room exits
      const roomExitsSnapshot = await getDocs(collection(db, "roomExits"));
      const totalRoomExits = roomExitsSnapshot.size;
      console.log("🚪 Room exits found:", totalRoomExits);

      setStats({
        totalUsers,
        activeSubscriptions,
        totalStudents,
        totalPeriods,
        totalRoomExits,
      });

      console.log("✅ Stats updated successfully");
    } catch (error) {
      console.error("❌ Error fetching stats:", error);
      toast.error(
        "Failed to fetch statistics: " +
          (error instanceof Error ? error.message : String(error))
      );
    }
  };

  const fetchUsers = async () => {
    try {
      console.log("🔍 Admin: Fetching users...");
      const usersSnapshot = await getDocs(collection(db, "users"));
      console.log("📄 User documents found:", usersSnapshot.size);

      const usersData: UserData[] = [];

      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        console.log("👤 Processing user:", userData.email);
        usersData.push({
          uid: userDoc.id,
          email: userData.email || "",
          displayName: userData.displayName,
          createdAt: userData.createdAt,
          subscription: userData,
        });
      }

      console.log("✅ Processed users:", usersData.length);
      setUsers(usersData.sort((a, b) => a.email.localeCompare(b.email)));
    } catch (error) {
      console.error("❌ Error fetching users:", error);
      toast.error(
        "Failed to fetch users: " +
          (error instanceof Error ? error.message : String(error))
      );
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      // Delete user document from Firestore
      await deleteDoc(doc(db, "users", selectedUser.uid));

      // Remove from local state
      setUsers(users.filter((u) => u.uid !== selectedUser.uid));

      // 🔧 tiny fix: proper template string
      toast.success(`User ${selectedUser.email} deleted successfully`);
      setShowDeleteDialog(false);
      setSelectedUser(null);

      // Refresh stats
      fetchStats();
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Failed to delete user");
    }
  };

  const getSubscriptionStatus = (subscription: any) => {
    if (!subscription) return "No Data";

    switch (subscription.subscriptionStatus) {
      case "active":
        return subscription.subscriptionPlan === "admin" ? "Admin" : "Active";
      case "cancelled":
        return "Cancelled";
      case "past_due":
        return "Past Due";
      default:
        return "Inactive";
    }
  };

  const getStatusColor = (subscription: any) => {
    if (!subscription) return "secondary";

    switch (subscription.subscriptionStatus) {
      case "active":
        return subscription.subscriptionPlan === "admin"
          ? "destructive"
          : "default";
      case "cancelled":
        return "secondary";
      case "past_due":
        return "destructive";
      default:
        return "outline";
    }
  };

  // Redirect non-admin users
  if (!isAdmin) {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center min-h-screen">
          <Card className="w-full max-w-md text-center">
            <CardHeader>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <Shield className="h-6 w-6 text-red-600" />
              </div>
              <CardTitle className="text-xl text-red-600">
                Access Denied
              </CardTitle>
              <CardDescription className="text-base">
                This page is restricted to administrators only.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => (window.location.href = "/dashboard")}
                className="w-full"
              >
                Return to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </ProtectedRoute>
    );
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Crown className="h-8 w-8 text-yellow-500" />
          <div>
            <h1 className="text-3xl font-bold">System Administration</h1>
            <p className="text-muted-foreground">
              Welcome {currentUser?.email} • Admin Control Panel
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground pt-1">
                Registered users
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">
                Active Subscriptions
              </CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.activeSubscriptions}
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                Paying customers
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">
                Total Students
              </CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalStudents}</div>
              <p className="text-xs text-muted-foreground pt-1">All students</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">
                Class Periods
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalPeriods}</div>
              <p className="text-xs text-muted-foreground pt-1">
                Created periods
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Room Exits</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalRoomExits}</div>
              <p className="text-xs text-muted-foreground pt-1">
                Total tracked exits
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Admin Tabs */}
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="database" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Database
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>
                  Manage all registered users and their subscriptions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Subscription</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.uid}>
                          <TableCell className="font-medium">
                            {user.email}
                            {user.email === currentUser?.email && (
                              <Badge variant="outline" className="ml-2">
                                You
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusColor(user.subscription)}>
                              {getSubscriptionStatus(user.subscription)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {user.subscription?.subscriptionPlan || "Free"}
                          </TableCell>
                          <TableCell>
                            {user.createdAt?.toDate
                              ? user.createdAt.toDate().toLocaleDateString()
                              : "Unknown"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => {
                                  /* View user details */
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {user.email !== currentUser?.email && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-red-500 hover:text-red-500"
                                  onClick={() => {
                                    setSelectedUser(user);
                                    setShowDeleteDialog(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Database Tab */}
          <TabsContent value="database">
            <Card>
              <CardHeader>
                <CardTitle>Database Management</CardTitle>
                <CardDescription>
                  Database statistics and management tools
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Collections</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between">
                        <span>Users:</span>
                        <span className="font-mono">{stats.totalUsers}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Students:</span>
                        <span className="font-mono">{stats.totalStudents}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Periods:</span>
                        <span className="font-mono">{stats.totalPeriods}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Room Exits:</span>
                        <span className="font-mono">
                          {stats.totalRoomExits}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={fetchAdminData}
                      >
                        Refresh Data
                      </Button>
                      <Button variant="outline" className="w-full">
                        Export Data
                      </Button>
                      <Button variant="outline" className="w-full">
                        Backup Database
                      </Button>
                      {/* ✅ NEW: open tutorials modal */}
                      <Button
                        className="w-full"
                        onClick={() => setShowTutorialsModal(true)}
                      >
                        Manage Tutorial Videos
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Delete User Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the user "{selectedUser?.email}"
                and all their data. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteUser}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete User
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ✅ NEW: Tutorials Modal */}
        <TutorialVideosModal
          open={showTutorialsModal}
          onOpenChange={setShowTutorialsModal}
          currentUserEmail={currentUser?.email ?? ""}
          currentUserId={currentUser?.uid ?? ""}
        />
      </div>
    </ProtectedRoute>
  );
}
