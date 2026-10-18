"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/i18n/context";
import { Badge } from "@/components/ui/Badge";
import { AssignmentItem, SubmissionItem } from "@/types";
import {
  CheckSquare,
  Clock,
  Calendar,
  Send,
  Plus,
  FileCheck,
  Award,
  MessageSquare,
  Sparkles,
  CheckCircle2
} from "lucide-react";

export function AssignmentsModule() {
  const { user, role } = useAuth();
  const { t } = useI18n();

  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentItem | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [studentSubmission, setStudentSubmission] = useState<SubmissionItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Student Submit State
  const [submitContent, setSubmitContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState("");

  // Teacher Create State
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSubject, setNewSubject] = useState("Kengaytirilgan Matematika");
  const [newInstructions, setNewInstructions] = useState("");
  const [newDueDate, setNewDueDate] = useState("2026-10-30T23:59:00");
  const [newMinutes, setNewMinutes] = useState(60);

  // Teacher Grading State
  const [gradingSubId, setGradingSubId] = useState<string | null>(null);
  const [gradeScore, setGradeScore] = useState<number>(95);
  const [gradeFeedback, setGradeFeedback] = useState<string>("");
  const [isGrading, setIsGrading] = useState(false);

  const fetchAssignments = async () => {
    setIsLoading(true);
    try {
      let url = "/api/assignments";
      if (role === "student" && user?.gradeLevel && user?.section) {
        url += `?gradeLevel=${user.gradeLevel}&section=${user.section}`;
      } else if (role === "teacher") {
        url += `?teacherId=${user?.id}`;
      } else {
        url += `?gradeLevel=10&section=A`;
      }

      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setAssignments(data.assignments || []);
        if (data.assignments && data.assignments.length > 0 && !selectedAssignment) {
          setSelectedAssignment(data.assignments[0]);
        }
      }
    } catch (err) {
      console.error("Assignments fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, [role, user]);

  // Load submissions for selected assignment
  useEffect(() => {
    async function loadSubmissions() {
      if (!selectedAssignment) return;
      try {
        const res = await fetch(`/api/assignments/submit?assignmentId=${selectedAssignment.id}`);
        if (!res.ok) {
          setStudentSubmission(null);
          setSubmissions([]);
        } else {
          const data = await res.json();
          if (role === "student") setStudentSubmission(data.submissions?.[0] ?? null);
          else setSubmissions(data.submissions ?? []);
        }
      } catch (err) {
        console.error("Submissions load error:", err);
      }
    }

    loadSubmissions();
  }, [selectedAssignment, role, user]);

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment || !user) return;
    setIsSubmitting(true);
    setSubmitSuccess("");

    try {
      const res = await fetch("/api/assignments/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: selectedAssignment.id,
          studentId: user.id,
          studentName: user.fullName,
          content: submitContent,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setStudentSubmission(data.submission);
        setSubmitSuccess("Topshiriq muvaffaqiyatli qabul qilindi!");
        setSubmitContent("");
      }
    } catch (err) {
      console.error("Submit error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTeacherCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: "crs-10a-math",
          subjectName: newSubject,
          teacherId: user.id,
          teacherName: user.fullName,
          title: newTitle,
          instructions: newInstructions,
          dueDate: newDueDate,
          estimatedMinutes: newMinutes,
          gradeLevel: 10,
          section: "A",
        }),
      });

      if (res.ok) {
        setIsCreating(false);
        setNewTitle("");
        setNewInstructions("");
        fetchAssignments();
      }
    } catch (err) {
      console.error("Create assignment error:", err);
    }
  };

  const handleGradeSubmission = async (subId: string) => {
    setIsGrading(true);
    try {
      const res = await fetch("/api/assignments/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: subId,
          grade: gradeScore,
          feedback: gradeFeedback,
        }),
      });

      if (res.ok) {
        setGradingSubId(null);
        alert("Baho va fikr muvaffaqiyatli saqlandi!");
      }
    } catch (err) {
      console.error("Grading error:", err);
    } finally {
      setIsGrading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 text-xs font-semibold mb-2">
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Topshiriqlar va Baholash</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {t.assignments.title}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Dars vazifalari, muddatlar, yuklama va yozma tavsiyalar
          </p>
        </div>

        {role === "teacher" && (
          <button
            onClick={() => setIsCreating(!isCreating)}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs transition-colors shadow-sm self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>{t.assignments.createAssignment}</span>
          </button>
        )}
      </div>

      {/* Teacher Create Modal / Card */}
      {isCreating && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-sky-200 dark:border-sky-800 p-6 shadow-md animate-in fade-in space-y-4">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">
            Yangi vazifa e'lon qilish (10-A Sinf)
          </h3>
          <form onSubmit={handleTeacherCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Vazifa sarlavhasi
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Masalan: Logarifmik tenglamalar"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Topshirish muddati
                </label>
                <input
                  type="datetime-local"
                  required
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Fan nomi
                </label>
                <input
                  type="text"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Kutilayotgan bajarish vaqti (daqiqa)
                </label>
                <input
                  type="number"
                  min={15}
                  max={240}
                  value={newMinutes}
                  onChange={(e) => setNewMinutes(parseInt(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Ko'rsatmalar va talablar
              </label>
              <textarea
                rows={3}
                required
                value={newInstructions}
                onChange={(e) => setNewInstructions(e.target.value)}
                placeholder="Vazifa bo'yicha ko'rsatmalarni yozing..."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                {t.common.cancel}
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-sm"
              >
                E'lon qilish
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left List of Assignments */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Vazifalar ro'yxati ({assignments.length})
            </span>
            <span className="text-[11px] text-slate-400">10-A Sinf</span>
          </div>

          {isLoading ? (
            <p className="text-xs text-slate-400 p-4">{t.common.loading}</p>
          ) : (
            <div className="space-y-2">
              {assignments.map((asg) => (
                <div
                  key={asg.id}
                  onClick={() => setSelectedAssignment(asg)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                    selectedAssignment?.id === asg.id
                      ? "border-sky-500 bg-sky-50/40 dark:bg-sky-950/20 shadow-sm"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sky-600 dark:text-sky-400 text-[11px]">
                      {asg.subjectName}
                    </span>
                    <Badge variant={asg.status === "published" ? "success" : "neutral"}>
                      {asg.status === "published" ? "Faol" : "Yopilgan"}
                    </Badge>
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white line-clamp-1 mb-1">
                    {asg.title}
                  </h4>
                  <div className="flex items-center space-x-3 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>~{asg.estimatedMinutes} daqiqa</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(asg.dueDate).toLocaleDateString()}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Details & Submission / Grading Queue */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          {selectedAssignment ? (
            <div className="space-y-6">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <span className="text-xs font-semibold text-sky-600 dark:text-sky-400">
                  {selectedAssignment.subjectName}
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                  {selectedAssignment.title}
                </h3>
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center space-x-1.5">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span>Muddati: <strong>{new Date(selectedAssignment.dueDate).toLocaleString()}</strong></span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>Taxminiy vaqt: <strong>{selectedAssignment.estimatedMinutes} daqiqa</strong></span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span>O'qituvchi: <strong>{selectedAssignment.teacherName}</strong></span>
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/60 text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                <span className="font-semibold text-slate-500 block mb-1">Ko'rsatmalar:</span>
                {selectedAssignment.instructions}
              </div>

              {/* Student View: Submission Status or Submit Form */}
              {role === "student" && (
                <div className="space-y-4 pt-2">
                  {studentSubmission ? (
                    /* Display Already Submitted Work & Published Grade */
                    <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Vazifa topshirilgan</span>
                        </div>
                        {studentSubmission.grade !== undefined && (
                          <div className="flex items-center space-x-1 px-3 py-1 rounded-full bg-emerald-600 text-white font-bold text-xs">
                            <Award className="w-3.5 h-3.5" />
                            <span>Baho: {studentSubmission.grade} / {studentSubmission.maxScore}</span>
                          </div>
                        )}
                      </div>

                      <div className="text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/40">
                        <span className="font-semibold text-slate-400 block mb-1">Sizning javobingiz:</span>
                        {studentSubmission.content}
                      </div>

                      {studentSubmission.feedback && (
                        <div className="text-xs text-slate-700 dark:text-slate-200 bg-emerald-100/50 dark:bg-emerald-900/30 p-3 rounded-lg space-y-1">
                          <span className="font-semibold text-emerald-900 dark:text-emerald-300 block">
                            O'qituvchi fikri:
                          </span>
                          <p>{studentSubmission.feedback}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Submission Form */
                    <form onSubmit={handleStudentSubmit} className="space-y-3">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                        Topshiriqni yuborish
                      </h4>
                      {submitSuccess && (
                        <div className="p-3 rounded-lg bg-emerald-50 text-emerald-800 text-xs">
                          {submitSuccess}
                        </div>
                      )}
                      <div>
                        <textarea
                          required
                          rows={4}
                          value={submitContent}
                          onChange={(e) => setSubmitContent(e.target.value)}
                          placeholder="Javob matningizni yoki Google Drive / GitHub havolasini kiriting..."
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                        />
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs shadow-sm transition-colors"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{isSubmitting ? t.common.loading : t.assignments.submitWork}</span>
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* Teacher View: Student Submissions Queue & Grading */}
              {role === "teacher" && (
                <div className="space-y-4 pt-2">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    O'quvchilar topshiriqlari navbati ({submissions.length})
                  </h4>

                  {submissions.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Hozircha topshiriqlar mavjud emas.</p>
                  ) : (
                    <div className="space-y-3">
                      {submissions.map((sub) => (
                        <div
                          key={sub.id}
                          className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {sub.studentName}
                            </span>
                            {sub.grade !== undefined ? (
                              <Badge variant="success">Baholandi: {sub.grade}/{sub.maxScore}</Badge>
                            ) : (
                              <Badge variant="warning">Baholanmagan</Badge>
                            )}
                          </div>

                          <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                            {sub.content}
                          </div>

                          {gradingSubId === sub.id ? (
                            <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    Baho (0 - 100)
                                  </label>
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={gradeScore}
                                    onChange={(e) => setGradeScore(parseInt(e.target.value))}
                                    className="w-full px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 text-xs"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                  Tavsiya va izoh
                                </label>
                                <textarea
                                  rows={2}
                                  value={gradeFeedback}
                                  onChange={(e) => setGradeFeedback(e.target.value)}
                                  placeholder="Yozma tavsiya qoldiring..."
                                  className="w-full px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 text-xs"
                                />
                              </div>
                              <div className="flex justify-end space-x-2">
                                <button
                                  type="button"
                                  onClick={() => setGradingSubId(null)}
                                  className="px-3 py-1.5 rounded text-xs text-slate-600 hover:bg-slate-100"
                                >
                                  Bekor qilish
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleGradeSubmission(sub.id)}
                                  disabled={isGrading}
                                  className="px-4 py-1.5 rounded bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700"
                                >
                                  Saqlash va e'lon qilish
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setGradingSubId(sub.id);
                                setGradeScore(sub.grade || 95);
                                setGradeFeedback(sub.feedback || "");
                              }}
                              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold"
                            >
                              {sub.grade !== undefined ? "Bahoni tahrirlash" : "Baholash"}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-400 text-xs">
              Vazifani tanlang
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
