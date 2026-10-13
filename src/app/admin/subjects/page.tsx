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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load subjects";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  const filteredSubjects = useMemo(() => {
    if (!searchQuery.trim()) return subjects;
    const query = searchQuery.toLowerCase();
    return subjects.filter(
      (sub) =>
        sub.name.toLowerCase().includes(query) ||
        (sub.description && sub.description.toLowerCase().includes(query))
    );
  }, [subjects, searchQuery]);

  const handleOpenAdd = () => {
    setFormData({ name: "", description: "" });
    setIsAddOpen(true);
  };

  const handleOpenEdit = (subject: SubjectItem) => {
    setEditingSubject(subject);
    setFormData({
      name: subject.name,
      description: subject.description || "",
    });
    setIsEditOpen(true);
  };

  const handleOpenDelete = (subject: SubjectItem) => {
    setDeletingSubject(subject);
    setIsDeleteOpen(true);
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Subject name is required");
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create subject";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubject || !formData.name.trim()) return;

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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update subject";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete subject";
      toast.error(msg);
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1D1D1F]">
            Subjects & Question Banks
          </h1>
          <p className="text-[13px] text-[#6E6E73] mt-0.5">
            Organize academic curriculum domains and author question pools for randomized batch papers.
          </p>
        </div>

        <Button
          onClick={handleOpenAdd}
          className="bg-[#0071E3] hover:bg-[#0077ED] text-white font-medium text-[13px] h-9 px-4 rounded-xl shadow-xs self-start sm:self-auto"
        >
          <Plus className="size-4 mr-1.5" />
          <span>Add Subject</span>
        </Button>
      </div>

      {/* Error alert */}
      {error && (
        <div className="rounded-xl border border-[#FF3B30]/30 bg-[#FF3B30]/10 p-4 text-[#D70015] flex items-center justify-between text-[13px]">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="size-4.5 shrink-0" />
            <span>{error}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchSubjects}
            className="text-[#D70015] hover:bg-[#FF3B30]/20 text-[12px] h-7 px-2"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Main Table Container */}
      <div className="bg-white border border-[#D2D2D7] rounded-2xl shadow-xs overflow-hidden">
        {/* Table Header / Search Bar */}
        <div className="p-4 sm:p-5 border-b border-[#E5E5EA] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-[#1D1D1F]">
              All Subjects ({subjects.length})
            </h2>
            <p className="text-[12px] text-[#6E6E73]">
              Click a subject to manage and author its question items.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 size-3.5 text-[#86868B] pointer-events-none" />
            <Input
              type="text"
              placeholder="Search subjects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-8.5 bg-[#F5F5F7] border-[#D2D2D7] text-[#1D1D1F] text-[13px] placeholder:text-[#86868B] rounded-xl focus-visible:bg-white focus-visible:border-[#0071E3]"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between gap-4 py-3">
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-44 bg-[#E8E8ED]" />
                  <Skeleton className="h-3 w-64 bg-[#E8E8ED]/70" />
                </div>
                <Skeleton className="h-6 w-20 bg-[#E8E8ED] rounded-full" />
                <Skeleton className="h-8 w-8 bg-[#E8E8ED] rounded-lg" />
              </div>
            ))}
          </div>
        ) : filteredSubjects.length === 0 ? (
          <div className="py-20 px-4 text-center max-w-md mx-auto space-y-3">
            <div className="size-11 rounded-2xl bg-[#F5F5F7] border border-[#E5E5EA] text-[#6E6E73] flex items-center justify-center mx-auto">
              <BookOpen className="size-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-[15px] font-semibold text-[#1D1D1F]">
                {searchQuery ? "No matching subjects found" : "No subjects yet"}
              </h3>
              <p className="text-[12px] text-[#6E6E73]">
                {searchQuery
                  ? "Try adjusting your search terms or clear the filter."
                  : "Add your first subject to begin building an accredited question bank."}
              </p>
            </div>
            {searchQuery ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchQuery("")}
                className="border-[#D2D2D7] bg-white text-[#1D1D1F] rounded-xl text-[12px]"
              >
                Clear Search
              </Button>
            ) : (
              <Button
                onClick={handleOpenAdd}
                className="bg-[#0071E3] hover:bg-[#0077ED] text-white text-[12px] rounded-xl mt-1"
              >
                <Plus className="size-3.5 mr-1" />
                <span>Create Subject</span>
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-[#F5F5F7]/80 border-b border-[#D2D2D7]">
                <TableRow className="border-[#D2D2D7] hover:bg-transparent">
                  <TableHead className="text-[12px] font-medium text-[#6E6E73] py-3 px-4 sm:px-6">
                    Subject Name
                  </TableHead>
                  <TableHead className="text-[12px] font-medium text-[#6E6E73] py-3 px-4 hidden md:table-cell">
                    Description
                  </TableHead>
                  <TableHead className="text-[12px] font-medium text-[#6E6E73] py-3 px-4 text-center">
                    Questions
                  </TableHead>
                  <TableHead className="text-[12px] font-medium text-[#6E6E73] py-3 px-4 hidden lg:table-cell">
                    Created
                  </TableHead>
                  <TableHead className="text-[12px] font-medium text-[#6E6E73] py-3 px-4 text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubjects.map((subject) => (
                  <TableRow
                    key={subject.id}
                    className="border-b border-[#E5E5EA] hover:bg-[#F5F5F7]/50 transition-colors"
                  >
                    <TableCell className="py-4 px-4 sm:px-6">
                      <div className="flex flex-col">
                        <Link
                          href={`/admin/subjects/${subject.id}/questions`}
                          className="font-semibold text-[14px] text-[#1D1D1F] hover:text-[#0071E3] transition-colors inline-flex items-center gap-1.5 group"
                        >
                          <span>{subject.name}</span>
                          <ArrowRight className="size-3 text-[#86868B] group-hover:text-[#0071E3] group-hover:translate-x-0.5 transition-all" />
                        </Link>
                        {subject.description && (
                          <span className="text-[12px] text-[#6E6E73] line-clamp-1 mt-0.5 md:hidden">
                            {subject.description}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="py-4 px-4 text-[#6E6E73] text-[13px] hidden md:table-cell max-w-xs truncate">
                      {subject.description || (
                        <span className="text-[#86868B] italic">No description</span>
                      )}
                    </TableCell>

                    <TableCell className="py-4 px-4 text-center">
                      <Link href={`/admin/subjects/${subject.id}/questions`}>
                        <span className="px-2.5 py-0.5 rounded-full bg-[#0071E3]/10 text-[#0071E3] border border-[#0071E3]/20 hover:bg-[#0071E3]/20 transition text-[11px] font-medium inline-flex items-center gap-1">
                          <HelpCircle className="size-3" />
                          <span>{subject.question_count} {subject.question_count === 1 ? "question" : "questions"}</span>
                        </span>
                      </Link>
                    </TableCell>

                    <TableCell className="py-4 px-4 text-[#6E6E73] text-[12px] hidden lg:table-cell">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="size-3 text-[#86868B]" />
                        <span>{formatDate(subject.created_at)}</span>
                      </div>
                    </TableCell>

                    <TableCell className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={`/admin/subjects/${subject.id}/questions`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2.5 text-[12px] text-[#0071E3] hover:bg-[#0071E3]/10 rounded-lg"
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
                                className="size-7 text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#E8E8ED]/60 rounded-lg"
                              >
                                <MoreHorizontal className="size-4" />
                                <span className="sr-only">Options</span>
                              </Button>
                            }
                          />
                          <DropdownMenuContent
                            align="end"
                            className="w-44 bg-white border-[#D2D2D7] text-[#1D1D1F] rounded-xl shadow-lg"
                          >
                            <DropdownMenuItem
                              className="cursor-pointer text-[12px] focus:bg-[#F5F5F7] rounded-lg"
                              onClick={() =>
                                (window.location.href = `/admin/subjects/${subject.id}/questions`)
                              }
                            >
                              <Layers className="size-3.5 mr-2 text-[#0071E3]" />
                              <span>Question Bank</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="cursor-pointer text-[12px] focus:bg-[#F5F5F7] rounded-lg"
                              onClick={() => handleOpenEdit(subject)}
                            >
                              <Pencil className="size-3.5 mr-2 text-[#B25E00]" />
                              <span>Edit Subject</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-[#E5E5EA]" />
                            <DropdownMenuItem
                              className="cursor-pointer text-[12px] text-[#D70015] focus:bg-[#FF3B30]/10 rounded-lg"
                              onClick={() => handleOpenDelete(subject)}
                            >
                              <Trash2 className="size-3.5 mr-2" />
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
      </div>

      {/* CREATE SUBJECT DIALOG */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="bg-white border-[#D2D2D7] text-[#1D1D1F] sm:max-w-md rounded-2xl p-6 shadow-lg">
          <form onSubmit={handleCreateSubject}>
            <DialogHeader>
              <DialogTitle className="text-[17px] font-semibold text-[#1D1D1F] flex items-center gap-2">
                <BookOpen className="size-5 text-[#0071E3]" />
                <span>Create New Subject</span>
              </DialogTitle>
              <DialogDescription className="text-[12px] text-[#6E6E73] pt-0.5">
                Add an academic subject or topic to group examination questions.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="create-name" className="text-[12px] font-medium text-[#1D1D1F]">
                  Subject Name <span className="text-[#FF3B30]">*</span>
                </Label>
                <Input
                  id="create-name"
                  placeholder="e.g. Mathematics, Operating Systems"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-[#F5F5F7] border-[#D2D2D7] text-[#1D1D1F] text-[13px] rounded-xl focus-visible:bg-white focus-visible:border-[#0071E3]"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-desc" className="text-[12px] font-medium text-[#1D1D1F]">
                  Description <span className="text-[#86868B] font-normal">(Optional)</span>
                </Label>
                <Textarea
                  id="create-desc"
                  placeholder="Brief curriculum scope or syllabus overview..."
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                  className="bg-[#F5F5F7] border-[#D2D2D7] text-[#1D1D1F] text-[13px] rounded-xl focus-visible:bg-white focus-visible:border-[#0071E3]"
                />
              </div>
            </div>

            <DialogFooter className="border-t border-[#E5E5EA] pt-3 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddOpen(false)}
                disabled={isSubmitting}
                className="border-[#D2D2D7] bg-white text-[#1D1D1F] text-[12px] rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="bg-[#0071E3] hover:bg-[#0077ED] text-white text-[12px] rounded-xl font-medium"
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
        <DialogContent className="bg-white border-[#D2D2D7] text-[#1D1D1F] sm:max-w-md rounded-2xl p-6 shadow-lg">
          <form onSubmit={handleUpdateSubject}>
            <DialogHeader>
              <DialogTitle className="text-[17px] font-semibold text-[#1D1D1F] flex items-center gap-2">
                <Pencil className="size-4.5 text-[#B25E00]" />
                <span>Edit Subject</span>
              </DialogTitle>
              <DialogDescription className="text-[12px] text-[#6E6E73] pt-0.5">
                Modify title or description for &quot;{editingSubject?.name}&quot;.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-name" className="text-[12px] font-medium text-[#1D1D1F]">
                  Subject Name <span className="text-[#FF3B30]">*</span>
                </Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-[#F5F5F7] border-[#D2D2D7] text-[#1D1D1F] text-[13px] rounded-xl focus-visible:bg-white focus-visible:border-[#0071E3]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-desc" className="text-[12px] font-medium text-[#1D1D1F]">
                  Description <span className="text-[#86868B] font-normal">(Optional)</span>
                </Label>
                <Textarea
                  id="edit-desc"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                  className="bg-[#F5F5F7] border-[#D2D2D7] text-[#1D1D1F] text-[13px] rounded-xl focus-visible:bg-white focus-visible:border-[#0071E3]"
                />
              </div>
            </div>

            <DialogFooter className="border-t border-[#E5E5EA] pt-3 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditOpen(false)}
                disabled={isSubmitting}
                className="border-[#D2D2D7] bg-white text-[#1D1D1F] text-[12px] rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="bg-[#0071E3] hover:bg-[#0077ED] text-white text-[12px] rounded-xl font-medium"
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
        <DialogContent className="bg-white border-[#D2D2D7] text-[#1D1D1F] sm:max-w-md rounded-2xl p-6 shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-[17px] font-semibold text-[#D70015] flex items-center gap-2">
              <Trash2 className="size-5" />
              <span>Delete Subject</span>
            </DialogTitle>
            <DialogDescription className="text-[13px] text-[#6E6E73] pt-1 leading-relaxed">
              Are you sure you want to delete <strong className="text-[#1D1D1F]">&quot;{deletingSubject?.name}&quot;</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 text-[12px] text-[#D70015] bg-[#FF3B30]/10 border border-[#FF3B30]/20 p-3 rounded-xl flex items-start gap-2.5">
            <AlertCircle className="size-4 text-[#FF3B30] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              This action cannot be undone. Associated questions ({deletingSubject?.question_count || 0}) in this repository will also be affected.
            </p>
          </div>

          <DialogFooter className="border-t border-[#E5E5EA] pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteOpen(false)}
              disabled={isSubmitting}
              className="border-[#D2D2D7] bg-white text-[#1D1D1F] text-[12px] rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleDeleteSubject}
              disabled={isSubmitting}
              className="bg-[#FF3B30] hover:bg-[#E03126] text-white text-[12px] rounded-xl font-medium"
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
