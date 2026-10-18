"use client";

import React, { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/i18n/context";
import { AccountModule } from "@/components/modules/AccountModule";
import { HomeworkModule } from "@/components/modules/HomeworkModule";
import { MarksModule } from "@/components/modules/MarksModule";
import { TranscriptModule } from "@/components/modules/TranscriptModule";
import { SetupModule } from "@/components/modules/SetupModule";
import { ReportsModule } from "@/components/modules/ReportsModule";
import { UsersModule } from "@/components/modules/UsersModule";
import { LoginScreen } from "@/components/LoginScreen";

// Modules
import { StudentDashboardModule } from "@/components/modules/StudentDashboardModule";
import { DirectorDashboardModule } from "@/components/modules/DirectorDashboardModule";
import { GuardianPortalModule } from "@/components/modules/GuardianPortalModule";
import { AnonymousSuggestionsModule } from "@/components/modules/AnonymousSuggestionsModule";
import { SuggestionsReviewModule } from "@/components/modules/SuggestionsReviewModule";
import { TimetableModule } from "@/components/modules/TimetableModule";
import { AssignmentsModule } from "@/components/modules/AssignmentsModule";
import { WorkloadModule } from "@/components/modules/WorkloadModule";
import { AttendanceModule } from "@/components/modules/AttendanceModule";
import { CsvImportModule } from "@/components/modules/CsvImportModule";
import { KnowledgeBaseModule } from "@/components/modules/KnowledgeBaseModule";
import { AnnouncementsModule } from "@/components/modules/AnnouncementsModule";
import { EventsClubsModule } from "@/components/modules/EventsClubsModule";
import { ProjectsModule } from "@/components/modules/ProjectsModule";
import { FacilitiesSupportModule } from "@/components/modules/FacilitiesSupportModule";

export default function Home() {
  const { role, user, isLoading, hasTab } = useAuth();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("dashboard");

  // Determine what to render based on activeTab and role
  const renderActiveModule = () => {
    // A tab whose module is switched off (FEATURES) behaves like the dashboard.
    const tab = hasTab(activeTab) ? activeTab : "dashboard";
    switch (tab) {
      case "dashboard":
        if (role === "admin") {
          return <DirectorDashboardModule onNavigateToSuggestions={() => setActiveTab("suggestions-review")} />;
        }
        if (role === "parent" && hasTab("guardian")) {
          return <GuardianPortalModule />;
        }
        if (role === "teacher") {
          return <AssignmentsModule />;
        }
        return <StudentDashboardModule onNavigate={(tab) => setActiveTab(tab)} />;

      case "homework":
        return role === "student" || role === "teacher" || role === "admin" ? <HomeworkModule /> : <StudentDashboardModule onNavigate={(tab) => setActiveTab(tab)} />;

      case "marks":
        return role === "student" || role === "teacher" || role === "admin" ? <MarksModule /> : <StudentDashboardModule onNavigate={(tab) => setActiveTab(tab)} />;

      case "transcript":
        return role === "student" || role === "teacher" || role === "admin" ? <TranscriptModule /> : <StudentDashboardModule onNavigate={(tab) => setActiveTab(tab)} />;

      case "setup":
        return role === "admin" ? <SetupModule /> : <StudentDashboardModule onNavigate={(tab) => setActiveTab(tab)} />;

      case "reports":
        return role === "admin" || role === "teacher" ? <ReportsModule /> : <StudentDashboardModule onNavigate={(tab) => setActiveTab(tab)} />;

      case "account":
        return <AccountModule />;

      case "users":
        return role === "admin" ? <UsersModule /> : <StudentDashboardModule onNavigate={(tab) => setActiveTab(tab)} />;

      case "suggestions":
        return <AnonymousSuggestionsModule />;

      case "suggestions-review":
        return <SuggestionsReviewModule />;

      case "timetable":
        return <TimetableModule />;

      case "assignments":
        return <AssignmentsModule />;

      case "workload":
        return <WorkloadModule />;

      case "attendance":
        return <AttendanceModule />;

      case "csv-import":
        return <CsvImportModule />;

      case "policies":
        return <KnowledgeBaseModule />;

      case "announcements":
        return <AnnouncementsModule />;

      case "events":
        return <EventsClubsModule />;

      case "projects":
        return <ProjectsModule />;

      case "facilities":
        return <FacilitiesSupportModule />;

      case "guardian":
        return <GuardianPortalModule />;

      case "analytics":
        return <DirectorDashboardModule onNavigateToSuggestions={() => setActiveTab("suggestions-review")} />;

      default:
        return <StudentDashboardModule onNavigate={(tab) => setActiveTab(tab)} />;
    }
  };

  if (isLoading) return <div className="min-h-screen bg-slate-50 dark:bg-slate-950" />;
  if (!user) return <LoginScreen />;

  // After an import / admin reset the user must choose their own password before anything else.
  if (user.mustChangePassword) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
        <Navbar />
        <main className="max-w-md w-full mx-auto p-6 space-y-4">
          <p role="alert" className="text-sm rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-300 text-amber-800 dark:text-amber-300 p-3">{t.admin.mustChangeBanner}</p>
          <AccountModule />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      <Navbar />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {/* Mobile Tab Quick Selector */}
          <div className="md:hidden mb-4">
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200"
            >
              <option value="dashboard">{t.nav.dashboard}</option>
              <option value="homework">{t.homework.title}</option>
              <option value="marks">{t.marks.title}</option>
              {role === "admin" && <option value="setup">{t.admin.setup}</option>}
              {(role === "admin" || role === "teacher") && <option value="reports">{t.admin.reports}</option>}
              <option value="transcript">{t.transcript.title}</option>
              <option value="account">{t.auth.account}</option>
              {role === "admin" && <option value="users">{t.nav.userManagement}</option>}
              <option value="timetable">{t.nav.timetable}</option>
              <option value="assignments">{t.nav.assignments}</option>
              {hasTab("workload") && <option value="workload">{t.nav.workload}</option>}
              <option value="attendance">{t.nav.attendance}</option>
              {hasTab("suggestions") && <option value="suggestions">{t.nav.anonymousSuggestion}</option>}
              {role === "admin" && hasTab("suggestions-review") ? (
                <option value="suggestions-review">Anonim Takliflar (Ko'rib chiqish)</option>
              ) : null}
              {role === "admin" ? (
                <option value="csv-import">CSV Import</option>
              ) : null}
              <option value="announcements">{t.nav.announcements}</option>
              {hasTab("policies") && <option value="policies">{t.nav.knowledgeBase}</option>}
              {hasTab("events") && <option value="events">{t.nav.events}</option>}
              {hasTab("projects") && <option value="projects">{t.nav.projects}</option>}
              {hasTab("facilities") && <option value="facilities">{t.nav.facilities}</option>}
            </select>
          </div>

          {renderActiveModule()}
        </main>
      </div>
    </div>
  );
}
