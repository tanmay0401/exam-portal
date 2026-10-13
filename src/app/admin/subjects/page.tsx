"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  Search,
  MoreHorizontal,
  AlertCircle,
  Loader2,
  ArrowRight,
  Calendar,
  Layers,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface SubjectItem {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  question_count: number;
}

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Form States
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [editingSubject, setEditingSubject] = useState<SubjectItem | null>(null);
  const [deletingSubject, setDeletingSubject] = useState<SubjectItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch subjects
  const fetchSubjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/subjects");
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch subjects");
      }
      const data = await res.json();
      setSubjects(Array.isArray(data) ? data : data.subjects || []);
    } catch (err: any) {
      const msg = err.message || "Failed to load subjects";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  // Filtered subjects
  const filteredSubjects = useMemo(() => {
    if (!searchQuery.trim()) return subjects;
    const query = searchQuery.toLowerCase();
    return subjects.filter(
      (sub) =>
        sub.name.toLowerCase().includes(query) ||
        (sub.description && sub.description.toLowerCase().includes(query))
    );
  }, [subjects, searchQuery]);

  // Open Create Dialog
  const handleOpenAdd = () => {
    setFormData({ name: "", description: "" });
    setIsAddOpen(true);
  };

  // Open Edit Dialog
  const handleOpenEdit = (subject: SubjectItem) => {
    setEditingSubject(subject);
    setFormData({
      name: subject.name,
      description: subject.description || "",
    });
    setIsEditOpen(true);
  };

  // Open Delete Confirmation Dialog
  const handleOpenDelete = (subject: SubjectItem) => {
    setDeletingSubject(subject);
    setIsDeleteOpen(true);
  };

  // Submit Create Subject
  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Please enter a subject name");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create subject");
      }

      toast.success("Subject created successfully!");
      setIsAddOpen(false);
      setFormData({ name: "", description: "" });
      fetchSubjects();
    } catch (err: any) {
      toast.error(err.message || "Failed to create subject");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Edit Subject
  const handleUpdateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubject) return;
    if (!formData.name.trim()) {
      toast.error("Please enter a subject name");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/subjects/${editingSubject.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update subject");
      }

      toast.success("Subject updated successfully!");
      setIsEditOpen(false);
      setEditingSubject(null);
      fetchSubjects();
    } catch (err: any) {
      toast.error(err.message || "Failed to update subject");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Delete Subject
  const handleDeleteSubject = async () => {
    if (!deletingSubject) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/subjects/${deletingSubject.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete subject");
      }

      toast.success("Subject deleted successfully!");
      setIsDeleteOpen(false);
      setDeletingSubject(null);
      fetchSubjects();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete subject");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
            <BookOpen className="size-7 text-indigo-400" />
            <span>Subject Management</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Organize academic courses, syllabi, and question bank repositories.
          </p>
        </div>

        <Button
          onClick={handleOpenAdd}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md shadow-indigo-600/25 text-sm h-10 self-start sm:self-auto"
        >
          <Plus className="size-4 mr-1.5" />
          <span>Add Subject</span>
        </Button>
      </div>

      {/* Error alert */}
      {error && (
        <Alert variant="destructive" className="border-rose-500/30 bg-rose-500/10 text-rose-300">
          <AlertCircle className="size-4 text-rose-400" />
          <AlertDescription className="text-xs sm:text-sm">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Main Card with search and table */}
      <Card className="border-slate-800/80 bg-slate-900/50 backdrop-blur-md shadow-xl overflow-hidden">
        <CardHeader className="p-4 sm:p-6 border-b border-slate-800/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base sm:text-lg font-semibold text-white">
                All Subjects ({subjects.length})
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 mt-0.5">
                Manage subject definitions and access associated question banks.
              </CardDescription>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
              <Input
                type="text"
                placeholder="Search subjects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 bg-slate-950/60 border-slate-800 text-slate-200 text-xs placeholder:text-slate-500 focus-visible:ring-indigo-500/30"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            /* Loading Skeleton */
            <div className="p-4 sm:p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between gap-4 py-3">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-48 bg-slate-800" />
                    <Skeleton className="h-4 w-72 bg-slate-800/60" />
                  </div>
                  <Skeleton className="h-6 w-24 bg-slate-800/80 rounded-full hidden sm:block" />
                  <Skeleton className="h-5 w-20 bg-slate-800/50 hidden md:block" />
                  <Skeleton className="h-8 w-8 bg-slate-800 rounded-lg" />
                </div>
              ))}
            </div>
          ) : filteredSubjects.length === 0 ? (
            /* Empty State */
            <div className="py-16 px-4 text-center">
              <div className="size-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-4">
                <BookOpen className="size-7" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1">
                {searchQuery ? "No matching subjects found" : "No subjects yet"}
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto mb-6">
                {searchQuery
                  ? "Try adjusting your search terms or clear the filter."
                  : "Get started by adding your first subject to create examinations and organize questions."}
              </p>
              {searchQuery ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchQuery("")}
                  className="border-slate-800 text-slate-300 hover:text-white"
                >
                  Clear Search
                </Button>
              ) : (
                <Button
                  onClick={handleOpenAdd}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-9"
                >
                  <Plus className="size-3.5 mr-1.5" />
                  <span>Create Subject</span>
                </Button>
              )}
            </div>
          ) : (
            /* Subjects Table */
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-950/40 border-b border-slate-800">
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-400 text-xs font-semibold py-3 px-4 sm:px-6">
                      Subject Name
                    </TableHead>
                    <TableHead className="text-slate-400 text-xs font-semibold py-3 px-4 hidden md:table-cell">
                      Description
                    </TableHead>
                    <TableHead className="text-slate-400 text-xs font-semibold py-3 px-4 text-center">
                      Questions
                    </TableHead>
                    <TableHead className="text-slate-400 text-xs font-semibold py-3 px-4 hidden lg:table-cell">
                      Created Date
                    </TableHead>
                    <TableHead className="text-slate-400 text-xs font-semibold py-3 px-4 text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubjects.map((subject) => (
                    <TableRow
                      key={subject.id}
                      className="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Name & Quick Link */}
                      <TableCell className="py-4 px-4 sm:px-6">
                        <div className="flex flex-col">
                          <Link
                            href={`/admin/subjects/${subject.id}/questions`}
                            className="font-semibold text-sm text-slate-100 hover:text-indigo-400 transition-colors inline-flex items-center gap-1.5 group"
                          >
                            <span>{subject.name}</span>
                            <ArrowRight className="size-3 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
                          </Link>
                          {subject.description && (
                            <span className="text-xs text-slate-400 line-clamp-1 mt-0.5 md:hidden">
                              {subject.description}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Description (desktop) */}
                      <TableCell className="py-4 px-4 text-slate-300 text-xs hidden md:table-cell max-w-xs truncate">
                        {subject.description || (
                          <span className="text-slate-500 italic">No description</span>
                        )}
                      </TableCell>

                      {/* Questions count badge */}
                      <TableCell className="py-4 px-4 text-center">
                        <Link href={`/admin/subjects/${subject.id}/questions`}>
                          <Badge
                            variant="secondary"
                            className="bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 hover:bg-indigo-500/20 transition cursor-pointer text-xs font-medium px-2.5 py-0.5 inline-flex items-center gap-1.5"
                          >
                            <HelpCircle className="size-3 text-indigo-400" />
                            <span>{subject.question_count} {subject.question_count === 1 ? "question" : "questions"}</span>
                          </Badge>
                        </Link>
                      </TableCell>

                      {/* Created date */}
                      <TableCell className="py-4 px-4 text-slate-400 text-xs hidden lg:table-cell">
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Calendar className="size-3 text-slate-500" />
                          <span>{formatDate(subject.created_at)}</span>
                        </div>
                      </TableCell>

                      {/* Actions dropdown */}
                      <TableCell className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/admin/subjects/${subject.id}/questions`} className="hidden sm:inline-flex">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10"
                            >
                              <span>Questions</span>
                            </Button>
                          </Link>

                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 text-slate-400 hover:text-white hover:bg-slate-800"
                                >
                                  <MoreHorizontal className="size-4" />
                                  <span className="sr-only">Subject options</span>
                                </Button>
                              }
                            />
                            <DropdownMenuContent
                              align="end"
                              className="w-48 bg-slate-900 border-slate-800 text-slate-200"
                            >
                              <DropdownMenuItem
                                className="cursor-pointer text-xs focus:bg-slate-800 focus:text-white"
                                onClick={() =>
                                  (window.location.href = `/admin/subjects/${subject.id}/questions`)
                                }
                              >
                                <Layers className="size-3.5 mr-2 text-indigo-400" />
                                <span>Question Bank</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="cursor-pointer text-xs focus:bg-slate-800 focus:text-white"
                                onClick={() => handleOpenEdit(subject)}
                              >
                                <Pencil className="size-3.5 mr-2 text-amber-400" />
                                <span>Edit Subject</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-slate-800" />
                              <DropdownMenuItem
                                className="cursor-pointer text-xs text-rose-400 focus:bg-rose-500/10 focus:text-rose-300"
                                onClick={() => handleOpenDelete(subject)}
                              >
                                <Trash2 className="size-3.5 mr-2 text-rose-400" />
                                <span>Delete Subject</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CREATE SUBJECT DIALOG */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="bg-slate-900 border border-slate-800 text-slate-100 sm:max-w-md">
          <form onSubmit={handleCreateSubject}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                <BookOpen className="size-5 text-indigo-400" />
                <span>Create New Subject</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Add an academic subject or topic to group examination questions.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="create-name" className="text-xs font-semibold text-slate-300">
                  Subject Name <span className="text-rose-400">*</span>
                </Label>
                <Input
                  id="create-name"
                  placeholder="e.g. Mathematics, Data Structures"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-slate-950 border-slate-800 text-slate-100 text-sm focus-visible:ring-indigo-500/30"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-desc" className="text-xs font-semibold text-slate-300">
                  Description <span className="text-slate-500">(Optional)</span>
                </Label>
                <Textarea
                  id="create-desc"
                  placeholder="Brief overview or curriculum scope for this subject..."
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                  className="bg-slate-950 border-slate-800 text-slate-100 text-sm focus-visible:ring-indigo-500/30"
                />
              </div>
            </div>

            <DialogFooter className="bg-slate-950/60 border-t border-slate-800/80 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddOpen(false)}
                disabled={isSubmitting}
                className="border-slate-800 text-slate-300 hover:text-white text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Create Subject</span>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT SUBJECT DIALOG */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-slate-900 border border-slate-800 text-slate-100 sm:max-w-md">
          <form onSubmit={handleUpdateSubject}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                <Pencil className="size-5 text-amber-400" />
                <span>Edit Subject</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Modify title or description for &quot;{editingSubject?.name}&quot;.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-name" className="text-xs font-semibold text-slate-300">
                  Subject Name <span className="text-rose-400">*</span>
                </Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-slate-950 border-slate-800 text-slate-100 text-sm focus-visible:ring-indigo-500/30"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-desc" className="text-xs font-semibold text-slate-300">
                  Description <span className="text-slate-500">(Optional)</span>
                </Label>
                <Textarea
                  id="edit-desc"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                  className="bg-slate-950 border-slate-800 text-slate-100 text-sm focus-visible:ring-indigo-500/30"
                />
              </div>
            </div>

            <DialogFooter className="bg-slate-950/60 border-t border-slate-800/80 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditOpen(false)}
                disabled={isSubmitting}
                className="border-slate-800 text-slate-300 hover:text-white text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION DIALOG */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="bg-slate-900 border border-slate-800 text-slate-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-rose-400 flex items-center gap-2">
              <Trash2 className="size-5" />
              <span>Delete Subject</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-300">
              Are you sure you want to delete{" "}
              <strong className="text-white">&quot;{deletingSubject?.name}&quot;</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 text-xs text-slate-400 bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg flex items-start gap-2.5">
            <AlertCircle className="size-4 text-rose-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              This action cannot be undone. Associated questions ({deletingSubject?.question_count || 0}) will also be affected or deleted according to database constraints.
            </p>
          </div>

          <DialogFooter className="bg-slate-950/60 border-t border-slate-800/80 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteOpen(false)}
              disabled={isSubmitting}
              className="border-slate-800 text-slate-300 hover:text-white text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleDeleteSubject}
              disabled={isSubmitting}
              className="bg-rose-600 hover:bg-rose-500 text-white text-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <span>Delete Subject</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
