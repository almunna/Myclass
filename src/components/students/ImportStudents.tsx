"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { collection, doc, setDoc } from "firebase/firestore";
import { db } from "@/firebase/firebase";
import { useAuth } from "@/hooks/useAuth";

interface ImportStudentsProps {
  periods: { id: string; name: string; }[];
  onImportComplete: () => void;
}

interface StudentRow {
  firstName: string;
  lastName: string;
  classPeriod: string;
  grade?: string;
  studentId?: string;
  row: number;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export function ImportStudents({ periods, onImportComplete }: ImportStudentsProps) {
  const { currentUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [previewData, setPreviewData] = useState<StudentRow[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const downloadTemplate = () => {
    // Create template data with sample row
    const templateData = [
      {
        'First Name': 'John',
        'Last Name': 'Doe',
        'Class Period': periods.length > 0 ? periods[0].name : 'Period 1',
        'Grade': '10',
        'Student ID': 'S001'
      },
      {
        'First Name': '',
        'Last Name': '',
        'Class Period': '',
        'Grade': '',
        'Student ID': ''
      }
    ];

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(templateData);
    
    // Set column widths
    const colWidths = [
      { wch: 15 }, // First Name
      { wch: 15 }, // Last Name  
      { wch: 20 }, // Class Period
      { wch: 10 }, // Grade
      { wch: 15 }  // Student ID
    ];
    ws['!cols'] = colWidths;

    // Add instructions as comments/notes
    const instructions = [
      '',
      'INSTRUCTIONS:',
      '• First Name: Required - Student\'s first name',
      '• Last Name: Required - Student\'s last name', 
      '• Class Period: Required - Must match existing period name exactly',
      '• Grade: Optional - Student\'s grade level',
      '• Student ID: Optional - Unique identifier for student',
      '',
      'Available Class Periods:',
      ...periods.map(p => `• ${p.name}`)
    ];

    // Add instructions starting from row 5
    instructions.forEach((instruction, index) => {
      const cellRef = XLSX.utils.encode_cell({ r: index + 4, c: 6 }); // Column G
      ws[cellRef] = { t: 's', v: instruction };
    });

    // Create workbook and save
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students Template");
    
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    saveAs(blob, 'students_import_template.xlsx');
    toast.success("Template downloaded successfully!");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      processFile(selectedFile);
    }
  };

  const processFile = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (jsonData.length < 2) {
        toast.error("File must contain at least a header row and one data row");
        return;
      }

      // Get headers (first row)
      const headers = jsonData[0] as string[];
      
      // Find column indices
      const firstNameCol = headers.findIndex(h => h?.toLowerCase().includes('first name'));
      const lastNameCol = headers.findIndex(h => h?.toLowerCase().includes('last name'));
      const classPeriodCol = headers.findIndex(h => h?.toLowerCase().includes('class period') || h?.toLowerCase().includes('period'));
      const gradeCol = headers.findIndex(h => h?.toLowerCase().includes('grade'));
      const studentIdCol = headers.findIndex(h => h?.toLowerCase().includes('student id') || h?.toLowerCase().includes('id'));

      if (firstNameCol === -1 || lastNameCol === -1 || classPeriodCol === -1) {
        toast.error("Required columns not found. Please ensure your file has 'First Name', 'Last Name', and 'Class Period' columns.");
        return;
      }

      // Process data rows
      const students: StudentRow[] = [];
      const errors: ValidationError[] = [];

      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as string[];
        const rowNumber = i + 1;

        // Skip empty rows
        if (!row.some(cell => cell && cell.toString().trim())) {
          continue;
        }

        const firstName = row[firstNameCol]?.toString().trim() || '';
        const lastName = row[lastNameCol]?.toString().trim() || '';
        const classPeriod = row[classPeriodCol]?.toString().trim() || '';
        const grade = gradeCol !== -1 ? row[gradeCol]?.toString().trim() || '' : '';
        const studentId = studentIdCol !== -1 ? row[studentIdCol]?.toString().trim() || '' : '';

        // Validate required fields
        if (!firstName) {
          errors.push({ row: rowNumber, field: 'First Name', message: 'First Name is required' });
        }
        if (!lastName) {
          errors.push({ row: rowNumber, field: 'Last Name', message: 'Last Name is required' });
        }
        if (!classPeriod) {
          errors.push({ row: rowNumber, field: 'Class Period', message: 'Class Period is required' });
        } else {
          // Validate class period exists
          const periodExists = periods.some(p => p.name.toLowerCase() === classPeriod.toLowerCase());
          if (!periodExists) {
            errors.push({ 
              row: rowNumber, 
              field: 'Class Period', 
              message: `Class Period "${classPeriod}" does not exist. Available periods: ${periods.map(p => p.name).join(', ')}` 
            });
          }
        }

        students.push({
          firstName,
          lastName,
          classPeriod,
          grade,
          studentId,
          row: rowNumber
        });
      }

      setPreviewData(students);
      setValidationErrors(errors);
      setShowPreview(true);

      if (errors.length > 0) {
        toast.error(`Found ${errors.length} validation error(s). Please review and fix them.`);
      } else {
        toast.success(`${students.length} students ready to import!`);
      }

    } catch (error) {
      console.error("Error processing file:", error);
      toast.error("Error reading file. Please ensure it's a valid Excel file.");
    }
  };

  const handleImport = async () => {
    if (validationErrors.length > 0) {
      toast.error("Please fix validation errors before importing");
      return;
    }

    if (previewData.length === 0) {
      toast.error("No students to import");
      return;
    }

    setImporting(true);

    try {
      let successCount = 0;
      let errorCount = 0;

      for (const student of previewData) {
        try {
          // Find the matching period
          const period = periods.find(p => p.name.toLowerCase() === student.classPeriod.toLowerCase());
          
          if (!period) {
            errorCount++;
            continue;
          }

          // Create student document
          const studentRef = doc(collection(db, "students"));
          await setDoc(studentRef, {
            name: `${student.firstName} ${student.lastName}`.trim(),
            studentId: student.studentId || `AUTO_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            grade: student.grade || '',
            periods: [{
              id: period.id,
              name: period.name
            }],
            teacherId: currentUser?.uid,
            createdAt: new Date(),
            importedAt: new Date()
          });

          successCount++;
        } catch (error) {
          console.error(`Error importing student ${student.firstName} ${student.lastName}:`, error);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully imported ${successCount} student(s)!`);
        onImportComplete();
        setIsOpen(false);
        resetForm();
      }

      if (errorCount > 0) {
        toast.error(`Failed to import ${errorCount} student(s). Please check the console for details.`);
      }

    } catch (error) {
      console.error("Error during import:", error);
      toast.error("An error occurred during import");
    } finally {
      setImporting(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setPreviewData([]);
    setValidationErrors([]);
    setShowPreview(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Upload className="h-4 w-4" />
          Import Students
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Students from Excel
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Step 1: Download Template */}
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-2">Step 1: Download Template</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Download the Excel template with the correct column format and instructions.
            </p>
            <Button onClick={downloadTemplate} variant="outline" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Download Template
            </Button>
          </div>

          {/* Step 2: Upload File */}
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-2">Step 2: Upload Your File</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Upload your completed Excel file with student information.
            </p>
            <div className="space-y-2">
              <Label htmlFor="file-upload">Select Excel File</Label>
              <Input
                id="file-upload"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className=""
              />
              {file && (
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle className="h-4 w-4" />
                  File selected: {file.name}
                </p>
              )}
            </div>
          </div>

          {/* Step 3: Preview and Validation */}
          {showPreview && (
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-2">Step 3: Review and Import</h3>
              
              {/* Validation Errors */}
              {validationErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <span className="font-medium text-red-700">Validation Errors</span>
                  </div>
                  <ul className="text-sm text-red-600 space-y-1">
                    {validationErrors.map((error, index) => (
                      <li key={index}>
                        Row {error.row}: {error.field} - {error.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Preview Data */}
              <div className="mb-4">
                <h4 className="font-medium mb-2">Preview ({previewData.length} students)</h4>
                <div className="max-h-60 overflow-y-auto border rounded">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="p-2 text-left">Name</th>
                        <th className="p-2 text-left">Class Period</th>
                        <th className="p-2 text-left">Grade</th>
                        <th className="p-2 text-left">Student ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.slice(0, 10).map((student, index) => (
                        <tr key={index} className="border-t">
                          <td className="p-2">{student.firstName} {student.lastName}</td>
                          <td className="p-2">{student.classPeriod}</td>
                          <td className="p-2">{student.grade || '-'}</td>
                          <td className="p-2">{student.studentId || 'Auto-generated'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {previewData.length > 10 && (
                    <div className="p-2 text-center text-sm text-muted-foreground border-t">
                      ... and {previewData.length - 10} more students
                    </div>
                  )}
                </div>
              </div>

              {/* Import Button */}
              <div className="flex justify-between items-center">
                <Button variant="outline" onClick={resetForm}>
                  Start Over
                </Button>
                <Button 
                  onClick={handleImport} 
                  disabled={validationErrors.length > 0 || importing}
                  className="flex items-center gap-2"
                >
                  {importing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Import {previewData.length} Students
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <h4 className="font-medium text-blue-800 mb-2">Requirements:</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• <strong>First Name</strong> and <strong>Last Name</strong> are required</li>
              <li>• <strong>Class Period</strong> must match exactly with existing periods</li>
              <li>• <strong>Grade</strong> and <strong>Student ID</strong> are optional</li>
              <li>• File must be in Excel format (.xlsx or .xls)</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 