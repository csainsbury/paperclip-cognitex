import { useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Calendar, AlertCircle } from "lucide-react";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { StatusBadge } from "../components/StatusBadge";
import { PriorityIcon } from "../components/PriorityIcon";
import { Identity } from "../components/Identity";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Issue } from "@paperclipai/shared";

type DueDateGroup = "overdue" | "today" | "upcoming" | "no_date";

function getDueDateGroup(dueDate: Date | null | undefined): DueDateGroup {
  if (!dueDate) return "no_date";
  const now = new Date();
  const due = new Date(dueDate);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  if (due < todayStart) return "overdue";
  if (due < todayEnd) return "today";
  return "upcoming";
}

const GROUP_LABELS: Record<DueDateGroup, string> = {
  overdue: "Overdue",
  today: "Due Today",
  upcoming: "Upcoming",
  no_date: "No Due Date",
};

const GROUP_ORDER: DueDateGroup[] = ["overdue", "today", "upcoming", "no_date"];

function formatDate(date: Date | null | undefined): string {
  if (!date) return "";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(date),
  );
}

const ALL_STATUSES = ["backlog", "todo", "in_progress", "in_review", "blocked"];
const ALL_PRIORITIES = ["critical", "high", "medium", "low"];

export function Tasks() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  useEffect(() => {
    setBreadcrumbs([{ label: "Tasks" }]);
  }, [setBreadcrumbs]);

  const { data: issues, isLoading, error } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () =>
      issuesApi.list(selectedCompanyId!, {
        status: ALL_STATUSES.join(","),
      }),
    enabled: !!selectedCompanyId,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const agentMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const agent of agents ?? []) {
      map.set(agent.id, agent.name);
    }
    return map;
  }, [agents]);

  const filtered = useMemo(() => {
    let list = (issues ?? []).filter(
      (i) => i.status !== "done" && i.status !== "cancelled",
    );
    if (statusFilter !== "all") {
      list = list.filter((i) => i.status === statusFilter);
    }
    if (priorityFilter !== "all") {
      list = list.filter((i) => i.priority === priorityFilter);
    }
    if (assigneeFilter !== "all") {
      list = list.filter((i) => i.assigneeAgentId === assigneeFilter);
    }
    return list;
  }, [issues, statusFilter, priorityFilter, assigneeFilter]);

  const grouped = useMemo(() => {
    const groups = new Map<DueDateGroup, Issue[]>();
    for (const group of GROUP_ORDER) {
      groups.set(group, []);
    }
    for (const issue of filtered) {
      const group = getDueDateGroup((issue as Issue & { dueDate?: Date | null }).dueDate);
      groups.get(group)!.push(issue);
    }
    return groups;
  }, [filtered]);

  const assignableAgents = useMemo(
    () => (agents ?? []).filter((a) => filtered.some((i) => i.assigneeAgentId === a.id)),
    [agents, filtered],
  );

  if (!selectedCompanyId) {
    return <EmptyState icon={ClipboardList} message="Select a company to view tasks." />;
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        Loading tasks…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-destructive">
        Failed to load tasks.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <h1 className="text-lg font-semibold">Tasks</h1>
        <div className="flex items-center gap-2">
          {/* Status filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-xs w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Priority filter */}
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="h-8 text-xs w-36">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              {ALL_PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Assignee filter */}
          {assignableAgents.length > 0 && (
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="h-8 text-xs w-40">
                <SelectValue placeholder="Assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All assignees</SelectItem>
                {assignableAgents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {filtered.length === 0 ? (
          <EmptyState icon={ClipboardList} message="No tasks match the current filters." />
        ) : (
          <div className="divide-y divide-border">
            {GROUP_ORDER.map((group) => {
              const groupIssues = grouped.get(group) ?? [];
              if (groupIssues.length === 0) return null;
              return (
                <div key={group}>
                  {/* Group header */}
                  <div className="flex items-center gap-2 px-6 py-2 bg-muted/30 sticky top-0 z-10">
                    {group === "overdue" && (
                      <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                    )}
                    {group !== "overdue" && (
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span
                      className={
                        "text-xs font-semibold " +
                        (group === "overdue" ? "text-destructive" : "text-muted-foreground")
                      }
                    >
                      {GROUP_LABELS[group]}
                    </span>
                    <span className="text-xs text-muted-foreground">({groupIssues.length})</span>
                  </div>

                  {/* Rows */}
                  {groupIssues.map((issue) => {
                    const assigneeName = issue.assigneeAgentId
                      ? agentMap.get(issue.assigneeAgentId)
                      : null;
                    const dueDate = (issue as Issue & { dueDate?: Date | null }).dueDate;

                    return (
                      <Link
                        key={issue.id}
                        to={`/issues/${issue.id}`}
                        className="flex items-center gap-3 px-6 py-3 hover:bg-accent/40 transition-colors group"
                      >
                        {/* Priority */}
                        <PriorityIcon priority={issue.priority} className="shrink-0" />

                        {/* Title + identifier */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs text-muted-foreground shrink-0 font-mono">
                              {issue.identifier}
                            </span>
                            <span className="text-sm truncate group-hover:text-foreground">
                              {issue.title}
                            </span>
                          </div>
                          {issue.description && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {issue.description.slice(0, 120)}
                            </p>
                          )}
                        </div>

                        {/* Status */}
                        <StatusBadge status={issue.status} />

                        {/* Assignee */}
                        {assigneeName && (
                          <Identity name={assigneeName} size="xs" className="shrink-0" />
                        )}

                        {/* Due date */}
                        <span
                          className={
                            "text-xs shrink-0 w-28 text-right " +
                            (group === "overdue"
                              ? "text-destructive font-medium"
                              : "text-muted-foreground")
                          }
                        >
                          {dueDate ? formatDate(dueDate) : "—"}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
