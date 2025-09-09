"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, doc, deleteDoc, query, where } from "firebase/firestore";
import { db } from "@/firebase/firebase";
import { useAuth } from "@/hooks/useAuth";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
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

interface Period {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  dayOfWeek?: string;
  createdAt: any;
}

interface PeriodListProps {
  onEditPeriod: (period: Period) => void;
}

export function PeriodList({ onEditPeriod }: PeriodListProps) {
  const { currentUser } = useAuth();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [periodToDelete, setPeriodToDelete] = useState<Period | null>(null);

  // Fetch periods on component mount
  useEffect(() => {
    fetchPeriods();
  }, []);

  const fetchPeriods = async () => {
    setLoading(true);
    try {
      const periodsQuery = query(
        collection(db, "periods"),
        where("teacherId", "==", currentUser?.uid)
      );
      const periodsSnapshot = await getDocs(periodsQuery);
      const periodsList = periodsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Period[];
      
      // Sort by name for better UX
      setPeriods(periodsList.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error("Error fetching periods:", error);
      toast.error("Failed to load periods");
    } finally {
      setLoading(false);
    }
  };

  const openDeleteDialog = (period: Period) => {
    setPeriodToDelete(period);
    setDeleteDialogOpen(true);
  };

  const handleDeletePeriod = async () => {
    if (!periodToDelete) return;
    
    try {
      await deleteDoc(doc(db, "periods", periodToDelete.id));
      setPeriods(periods.filter((p) => p.id !== periodToDelete.id));
      toast.success("Period deleted successfully");
    } catch (error) {
      console.error("Error deleting period:", error);
      toast.error("Failed to delete period");
    } finally {
      setDeleteDialogOpen(false);
      setPeriodToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
        <p className="mt-2 text-muted-foreground">Loading periods...</p>
      </div>
    );
  }

  return (
    <>
      {periods.length === 0 ? (
        <div className="text-center py-8 border rounded-lg">
          <p className="text-muted-foreground">No periods found</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period Name</TableHead>
                <TableHead>Start Time</TableHead>
                <TableHead>End Time</TableHead>
                <TableHead>Day</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {periods.map((period) => (
                <TableRow key={period.id}>
                  <TableCell className="font-medium">{period.name}</TableCell>
                  <TableCell>{period.startTime}</TableCell>
                  <TableCell>{period.endTime}</TableCell>
                  <TableCell>{period.dayOfWeek || "All days"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => onEditPeriod(period)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-500 border-red-200 hover:text-red-500 hover:bg-red-50 hover:border-red-300"
                        onClick={() => openDeleteDialog(period)}
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
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the period
              {periodToDelete && ` "${periodToDelete.name}"`} and may affect students assigned to it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeletePeriod}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
} 