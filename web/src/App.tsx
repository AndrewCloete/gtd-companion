import "./App.css";
import * as _ from "lodash/fp";
import { isValid, parse } from "date-fns";
import {
  setProject,
  unsetProject,
  setContext,
  unsetContext,
} from "./redux/projectFilter";
import { useAppSelector, useAppDispatch } from "./hooks";

import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import env from "./config.json";
import * as m from "./model";
import * as vm from "./viewmodel";
import {
  applyTaskNavRowFocus,
  collectSearchMatchIndices,
  getLeftPaneNavRows,
  copyNavRowToClipboard,
} from "./taskVimNav";

const SECTION_LAYOUT_STORAGE_KEY = "gtd.sectionLayout.v1";

type SectionLayoutV1 = {
  order: string[];
  hidden: string[];
  isolate?: string | null;
};

function loadSectionLayoutV1(): SectionLayoutV1 {
  try {
    const raw = localStorage.getItem(SECTION_LAYOUT_STORAGE_KEY);
    if (!raw) {
      return { order: [], hidden: [], isolate: null };
    }
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object") {
      return { order: [], hidden: [], isolate: null };
    }
    const rec = p as SectionLayoutV1;
    const order = Array.isArray(rec.order)
      ? rec.order.filter((x): x is string => typeof x === "string")
      : [];
    const hidden = Array.isArray(rec.hidden)
      ? rec.hidden.filter((x): x is string => typeof x === "string")
      : [];
    const isolate = typeof rec.isolate === "string" ? rec.isolate : null;
    return { order, hidden, isolate };
  } catch {
    return { order: [], hidden: [], isolate: null };
  }
}

function saveSectionLayoutV1(
  order: string[],
  hidden: Set<string>,
  isolate: string | null
): void {
  try {
    localStorage.setItem(
      SECTION_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        order,
        hidden: [...hidden],
        isolate,
      })
    );
  } catch {
    /* quota / private mode */
  }
}

const TAG_LAYOUT_STORAGE_KEY = "gtd.tagLayout.v1";

type TagLayoutV1 = {
  order: string[];
  hidden: string[];
  isolate?: string | null;
};

function loadTagLayoutV1(): TagLayoutV1 {
  try {
    const raw = localStorage.getItem(TAG_LAYOUT_STORAGE_KEY);
    if (!raw) {
      return { order: [], hidden: [], isolate: null };
    }
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object") {
      return { order: [], hidden: [], isolate: null };
    }
    const rec = p as TagLayoutV1;
    const order = Array.isArray(rec.order)
      ? rec.order.filter((x): x is string => typeof x === "string")
      : [];
    const hidden = Array.isArray(rec.hidden)
      ? rec.hidden.filter((x): x is string => typeof x === "string")
      : [];
    const isolate = typeof rec.isolate === "string" ? rec.isolate : null;
    return { order, hidden, isolate };
  } catch {
    return { order: [], hidden: [], isolate: null };
  }
}

function saveTagLayoutV1(
  order: string[],
  hidden: Set<string>,
  isolate: string | null
): void {
  try {
    localStorage.setItem(
      TAG_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        order,
        hidden: [...hidden],
        isolate,
      })
    );
  } catch {
    /* quota / private mode */
  }
}

type TaskGroupBy = "Project" | "Tags"

/** Tag bucket ids aligned with `Task.explodeByContext` / TasksByTag (`none` = untagged). */
function taskTagGroupKeys(task: m.Task): string[] {
  if (task.data.contexts.length === 0) {
    return ["none"];
  }
  return task.cleanContexts();
}

/** Left-pane tag rules: optional isolate (solo one tag); else hide-only-hidden buckets. */
function filterTasksForLeftPaneTagMenu(
  tasks: m.Task[],
  tagHidden: Set<string>,
  tagIsolated: string | null
): m.Task[] {
  if (tagIsolated !== null) {
    return tasks.filter((task) =>
      taskTagGroupKeys(task).includes(tagIsolated)
    );
  }
  if (tagHidden.size === 0) {
    return tasks;
  }
  return tasks.filter((task) => {
    const keys = taskTagGroupKeys(task);
    return keys.some((k) => !tagHidden.has(k));
  });
}

function getToday(): Date {
  return new Date();
}
function getTodayStr(): string {
  return m.TaskDate.toYYYYMMDD(getToday());
}

function get_url() {
  return `${env.scheme}://${window.location.hostname}:${env.backend_port}`;
}

function copy_to_clipboard(task: m.Task) {
  if (!task.data.file_path || !task.data.line) return;
  navigator.clipboard.writeText(`${task.data.file_path}:${task.data.line}`).catch(() => {});
}

function taskNavRowAttrs(task: m.Task) {
  return {
    "data-task-nav-row": "",
    "data-nav-file": task.data.file_path ?? "",
    "data-nav-line": task.data.line != null ? String(task.data.line) : "",
    "data-nav-search": `${task.cleanProjext()} ${task.cleanDescription()}`.toLowerCase(),
  };
}

async function getTasks(): Promise<m.Tasks> {
  const requestOptionsFetch = {
    method: "GET",
    headers: {
      Authorization: "Basic " + btoa(env.user + ":" + env.psw),
    },
  };
  //@ts-ignore
  const response = await fetch(get_url() + "/tasks", requestOptionsFetch);
  const tasks_data = (await response.json()) as m.Data.Task[];
  return m.Tasks.fromData(tasks_data);
}

function diffInDaysClass(diffInDays: number | undefined) {
  if (diffInDays == undefined) {
    return "DayDiff_NONE";
  }
  if (diffInDays < 0) {
    return "DayDiff_NEGATIVE";
  }
  if (diffInDays == 0) {
    return "DayDiff_TODAY";
  }
  if (diffInDays == 0) {
    return "DayDiff_POSITIVE";
  }
}
function ProjectBlock(props: { project: string; tasks: m.Task[] }) {
  const dispatch = useAppDispatch();
  return (
    <div className="TaskLine">
      <div className="Project">
        <span onClick={() => dispatch(setProject(props.project))}>
          {props.project}
        </span>
      </div>
      <div>
        {props.tasks.map((task) => {
          return (
            <div key={task.key()} className="TaskNavRow" {...taskNavRowAttrs(task)}>
              <div
                id={task.cleanDescription()}
                key={task.key()}
                className={`Description TaskType_${task.classify()}`}
                onClick={() => copy_to_clipboard(task)}
              >
                {task.cleanDescription()}
              </div>
              {task.cleanContexts().map((c) => {
                return (
                  <span
                    className="Contexts"
                    key={c}
                    onClick={() => dispatch(setContext(c))}
                  >
                    {c + " "}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ContextBlock(props: { context: string; tasks: m.Task[] }) {
  const dispatch = useAppDispatch();
  return (
    <div className="TaskLine">
      <div className="Project">
        <span onClick={() => dispatch(setContext(props.context))}>
          {props.context}
        </span>
      </div>
      <div>
        {props.tasks.map((task) => {
          return (
            <div key={task.key()} className="TaskNavRow" {...taskNavRowAttrs(task)}>
              <span
                className="Contexts"
                onClick={() => dispatch(setProject(task.cleanProjext()))}
              >
                {task.cleanProjext() + " "}
              </span>
              <div
                id={task.cleanDescription()}
                key={task.key()}
                className={`Description TaskType_${task.classify()}`}
                onClick={() => copy_to_clipboard(task)}
              >
                {task.cleanDescription()}
              </div>
              {task.cleanContexts().map((c) => {
                return (
                  c == props.context ? (null) : (
                    <span
                      className="ContextsExtra"
                      key={c}
                      onClick={() => dispatch(setContext(c))}
                    >
                      {c + " "}
                    </span>
                  )
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TasksByGroup(props: {
  tasks: m.Task[];
  groupby: TaskGroupBy;
  tagDescriptors: { id: string }[];
  tagVisible: (id: string) => boolean;
}) {
  return props.groupby === "Project" ? (
    <TasksByProject tasks={props.tasks} />
  ) : (
    <TasksByTag
      tasks={props.tasks}
      tagDescriptors={props.tagDescriptors}
      tagVisible={props.tagVisible}
    />
  );
}

function TasksByTag(props: {
  tasks: m.Task[];
  tagDescriptors: { id: string }[];
  tagVisible: (id: string) => boolean;
}) {
  const groups = _.groupBy((t: m.Task) => t.data.single_context)(
    props.tasks.flatMap((t) => t.explodeByContext())
  );
  const present = new Set(Object.keys(groups));
  const orderedIds = [
    ...props.tagDescriptors.map((d) => d.id).filter((id) => present.has(id)),
    ...[...present].filter(
      (id) => !props.tagDescriptors.some((d) => d.id === id)
    ),
  ];
  return (
    <div>
      {orderedIds.map((id) => {
        if (!props.tagVisible(id)) {
          return null;
        }
        const blockTasks = groups[id];
        if (!blockTasks?.length) {
          return null;
        }
        return (
          <ContextBlock
            key={id}
            context={id}
            tasks={blockTasks}
          ></ContextBlock>
        );
      })}
    </div>
  );
}

function TasksByProject(props: { tasks: m.Task[] }) {
  const groups = _.groupBy((t: m.Task) => t.cleanProjext())(props.tasks);
  return (
    <div>
      {Object.entries(groups).map((entry) => {
        return (
          <ProjectBlock
            key={entry[0]}
            project={entry[0]}
            tasks={entry[1]}
          ></ProjectBlock>
        );
      })}
    </div>
  );
}

function DayBlock(props: { block: vm.DayBlock }) {
  const date = props.block.date();
  const diffInDays = date?.diffInDays(getToday());

  return (
    <div className="DayBlock">
      <div className={`TaskDate DayBlockDate ${diffInDaysClass(diffInDays)}`}>
        <div>{date?.fmt("EEEEEE")}</div>
        <div className="Date">{date?.fmt("d MMM")}</div>
        <div className="DateDiff">{diffInDays}</div>
        <div></div>
      </div>
      <TasksByProject tasks={props.block.tasks}></TasksByProject>
    </div>
  );
}

function WeekBlock(props: { week_block: vm.WeekBlock }) {
  return (
    <div className="WeekBlock">
      <div className="WeekRangeDiv">
        <span className="WeeksAway">
          {props.week_block.weeksAway(getToday())}
        </span>
        <span className="WeekRange">{props.week_block.fmtWeekBookends()}</span>
      </div>
      {props.week_block.tasks.map((day_block) => {
        return day_block.onlySundayTask() ? undefined : (
          <DayBlock key={day_block.key()} block={day_block}></DayBlock>
        );
      })}
    </div>
  );
}

function WeekBlocks(props: { week_blocks: vm.WeekBlock[] }) {
  return (
    <div className="WeekBlocks">
      {props.week_blocks.map((week_block) => {
        return (
          <WeekBlock key={week_block.key()} week_block={week_block}></WeekBlock>
        );
      })}
    </div>
  );
}

function NoScheduleBlock(props: {
  tasks: m.Task[];
  groupby: TaskGroupBy;
  tagDescriptors: { id: string }[];
  tagVisible: (id: string) => boolean;
}) {
  const { has_date, no_date } = m.Tasks.dateSplit(props.tasks);
  function NoScheduleTask(props: { task: m.Task }) {
    const dispatch = useAppDispatch();
    const date = props.task.dates.priority();
    const diffInDays = date?.diffInDays(getToday());

    return (
      <div className="TaskLine TaskNavRow" {...taskNavRowAttrs(props.task)}>
        <div
          className={`TaskDate NoScheduleBlockDate ${diffInDaysClass(diffInDays)}`}
        >
          <span className="Dow">{date?.fmt("EEEEEE")}</span>
          <span className="Date">{date?.fmt("dd MMM")}</span>

          <span className="Diff">
            {diffInDays ? <span>({diffInDays})</span> : undefined}
          </span>
        </div>
        <div className="Project">
          <span onClick={() => dispatch(setProject(props.task.cleanProjext()))}>
            {props.task.cleanProjext()}
          </span>
        </div>
        <div
          className={`Description Status_${props.task.data.status} TaskType_${props.task.classify()}`}
          onClick={() => copy_to_clipboard(props.task)}
        >
          {props.task.cleanDescription()}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="NoScheduleBlock">
        {has_date.map((task) => {
          return <NoScheduleTask key={task.key()} task={task}></NoScheduleTask>;
        })}
      </div>
      <TasksByGroup
        tasks={no_date}
        groupby={props.groupby}
        tagDescriptors={props.tagDescriptors}
        tagVisible={props.tagVisible}
      ></TasksByGroup>
    </div>
  );
}
function DatePicker(props: {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
}) {
  const value = props.date ? m.TaskDate.fmt(props.date, "yyyy-MM-dd") : "";

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const val = event.target.value;
    if (!val) {
      props.setDate(undefined);
      return;
    }
    const newDate = parse(val, "yyyy-MM-dd", new Date());
    if (isValid(newDate)) {
      props.setDate(newDate);
    }
  }

  function clear(): void {
    props.setDate(undefined);
  }
  function today(): void {
    props.setDate(getToday());
  }

  return (
    <>
      <button onClick={today}>Today</button>
      <button onClick={clear}>All</button>
      <input
        className="ToolbarInput ToolbarDateInput"
        type="date"
        value={value}
        onChange={handleChange}
      />
    </>
  );
}

function App() {
  const dispatch = useAppDispatch();
  let [gtdTasks, setTasks] = useState<m.Tasks>(m.Tasks.empty());
  let [visibleDate, setVisibleDate] = useState<Date | undefined>(getToday());
  let [groupBy, setGroupBy] = useState<TaskGroupBy>("Project");
  let [sectionOrder, setSectionOrder] = useState<string[]>(
    () => loadSectionLayoutV1().order
  );
  let [sectionHidden, setSectionHidden] = useState<Set<string>>(() => {
    const { hidden } = loadSectionLayoutV1();
    return new Set(hidden);
  });
  let [sectionIsolated, setSectionIsolated] = useState<string | null>(
    () => loadSectionLayoutV1().isolate ?? null
  );
  let [sectionDropdownOpen, setSectionDropdownOpen] = useState(false);
  let [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const sectionDropdownRef = useRef<HTMLDivElement>(null);
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const sectionDragSourceRef = useRef<string | null>(null);
  const tagDragSourceRef = useRef<string | null>(null);
  let [tagOrder, setTagOrder] = useState<string[]>(() => loadTagLayoutV1().order);
  let [tagHidden, setTagHidden] = useState<Set<string>>(() => {
    const { hidden } = loadTagLayoutV1();
    return new Set(hidden);
  });
  let [tagIsolated, setTagIsolated] = useState<string | null>(
    () => loadTagLayoutV1().isolate ?? null
  );

  const [taskNavFocusIndex, setTaskNavFocusIndex] = useState(-1);
  /** `null` = not typing a /search; `""` = waiting for first character */
  const [taskNavSearchBuffer, setTaskNavSearchBuffer] = useState<string | null>(
    null
  );
  const [taskNavSearchMatches, setTaskNavSearchMatches] = useState<number[]>(
    []
  );
  const [taskNavSearchMatchI, setTaskNavSearchMatchI] = useState(0);

  function flipGroupBy() {
    setGroupBy((g) => (g === "Project" ? "Tags" : "Project"));
  }

  function toggleSectionVisibility(id: string) {
    setSectionHidden((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSectionIsolate(id: string) {
    setSectionIsolated((prev) => (prev === id ? null : id));
  }

  function toggleTagIsolate(id: string) {
    setTagIsolated((prev) => (prev === id ? null : id));
  }

  function moveSectionOrder(dragId: string, targetId: string) {
    if (dragId === targetId) {
      return;
    }
    setSectionOrder((prev) => {
      const next = [...prev];
      const i = next.indexOf(dragId);
      const j = next.indexOf(targetId);
      if (i < 0 || j < 0) {
        return prev;
      }
      next.splice(i, 1);
      next.splice(j, 0, dragId);
      return next;
    });
  }

  function toggleTagVisibility(id: string) {
    setTagHidden((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function moveTagOrder(dragId: string, targetId: string) {
    if (dragId === targetId) {
      return;
    }
    setTagOrder((prev) => {
      const next = [...prev];
      const i = next.indexOf(dragId);
      const j = next.indexOf(targetId);
      if (i < 0 || j < 0) {
        return prev;
      }
      next.splice(i, 1);
      next.splice(j, 0, dragId);
      return next;
    });
  }

  const loadTasksCb = useCallback(async () => {
    const networkTasks = await getTasks();
    setTasks(networkTasks.split_with_due());
  }, []);

  function connect() {
    const WS_URL = `${env.ws_scheme}://${window.location.hostname}:${env.backend_port}/ws`;
    const ws = new WebSocket(WS_URL);
    ws.addEventListener("open", (event) => {
      ws.send("Connection established");
    });

    ws.addEventListener("message", (event) => {
      console.log("Message from server ", event.data);
      loadTasksCb();
    });

    ws.addEventListener("close", (event) => {
      console.log(
        "Socket is closed. Reconnect will be attempted in 1 second.",
        event.reason,
      );
      setTimeout(function () {
        connect();
      }, 1000);
    });

    ws.addEventListener("error", (event) => {
      console.error("Socket encountered error: ", event, "Closing socket");
      ws.close();
    });
  }

  useEffect(() => {
    loadTasksCb();
    connect();
    return;
  }, [loadTasksCb]);

  // Sets the date back to today every 1 minute to ensure invisible tasks are always surfaced
  useEffect(() => {
    const intervalId = setInterval(() => {
      setVisibleDate(getToday())
    }, 60000);
    return () => clearInterval(intervalId);
  }, []);

  // Close toolbar dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const t = e.target as Node;
      if (sectionDropdownRef.current?.contains(t)) {
        return;
      }
      if (tagDropdownRef.current?.contains(t)) {
        return;
      }
      setSectionDropdownOpen(false);
      setTagDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const projectFilter = useAppSelector((state) => state.taskFilter.project);
  const contextFilter = useAppSelector((state) => state.taskFilter.context);

  useLayoutEffect(() => {
    applyTaskNavRowFocus(leftPaneRef.current, taskNavFocusIndex);
  }, [taskNavFocusIndex, gtdTasks]);

  useEffect(() => {
    function vimNavKeydown(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (!t) {
        return;
      }
      const tag = t.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        t.isContentEditable
      ) {
        return;
      }

      if (sectionDropdownOpen || tagDropdownOpen) {
        return;
      }

      if (e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }

      if (taskNavSearchBuffer !== null) {
        if (e.key === "Escape") {
          e.preventDefault();
          setTaskNavSearchBuffer(null);
          return;
        }
        if (e.key === "Enter") {
          if (e.repeat) {
            return;
          }
          e.preventDefault();
          const pattern = taskNavSearchBuffer.trim().toLowerCase();
          setTaskNavSearchBuffer(null);
          const rows = getLeftPaneNavRows(leftPaneRef.current);
          const matches = collectSearchMatchIndices(rows, pattern);
          setTaskNavSearchMatches(matches);
          setTaskNavSearchMatchI(0);
          if (matches.length > 0) {
            setTaskNavFocusIndex(matches[0]);
          }
          return;
        }
        if (e.key === "Backspace") {
          e.preventDefault();
          setTaskNavSearchBuffer((b) => (b!.length <= 1 ? "" : b!.slice(0, -1)));
          return;
        }
        if (e.key.length === 1) {
          e.preventDefault();
          setTaskNavSearchBuffer((b) => (b ?? "") + e.key);
        }
        return;
      }

      if (e.key === "/" && !e.shiftKey) {
        e.preventDefault();
        setTaskNavSearchBuffer("");
        return;
      }

      if (e.key === "n" && taskNavSearchMatches.length > 0) {
        e.preventDefault();
        const nextI =
          (taskNavSearchMatchI + 1) % taskNavSearchMatches.length;
        setTaskNavSearchMatchI(nextI);
        setTaskNavFocusIndex(taskNavSearchMatches[nextI]);
        return;
      }

      if (e.key === "j") {
        e.preventDefault();
        const rows = getLeftPaneNavRows(leftPaneRef.current);
        if (rows.length === 0) {
          return;
        }
        setTaskNavFocusIndex((i) =>
          i < 0 ? 0 : Math.min(i + 1, rows.length - 1)
        );
        return;
      }

      if (e.key === "k") {
        e.preventDefault();
        setTaskNavFocusIndex((i) => (i <= 0 ? 0 : i - 1));
        return;
      }

      if (e.key === "Enter") {
        if (e.repeat) {
          return;
        }
        const highlighted = leftPaneRef.current?.querySelector<HTMLElement>(
          ".TaskNavFocused[data-task-nav-row]"
        );
        if (highlighted) {
          e.preventDefault();
          e.stopPropagation();
          copyNavRowToClipboard(highlighted);
        }
        return;
      }

      if (e.key === "Escape") {
        setTaskNavFocusIndex(-1);
        setTaskNavSearchMatches([]);
        setTaskNavSearchMatchI(0);
        return;
      }

      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        loadTasksCb();
      }
    }

    window.addEventListener("keydown", vimNavKeydown, true);
    return () => window.removeEventListener("keydown", vimNavKeydown, true);
  }, [
    sectionDropdownOpen,
    tagDropdownOpen,
    taskNavSearchBuffer,
    taskNavSearchMatches,
    taskNavSearchMatchI,
    taskNavFocusIndex,
    loadTasksCb,
  ]);

  const discoveryStatuses = useMemo(() => {
    const tasks = gtdTasks
      .filter_by_project(projectFilter)
      .filter_by_context(contextFilter)
      .tasks;
    return _.uniq(tasks.map((t) => t.data.status));
  }, [gtdTasks, projectFilter, contextFilter]);

  useEffect(() => {
    if (discoveryStatuses.length === 0) {
      return;
    }
    const discSet = new Set(discoveryStatuses);
    setSectionOrder((prev) => {
      const pruned = prev.filter((id) => discSet.has(id));
      const seen = new Set(pruned);
      for (const id of discoveryStatuses) {
        if (!seen.has(id)) {
          pruned.push(id);
          seen.add(id);
        }
      }
      return pruned;
    });
    setSectionHidden((prev) => {
      const next = new Set(prev);
      for (const id of prev) {
        if (!discSet.has(id)) {
          next.delete(id);
        }
      }
      return next;
    });
    setSectionIsolated((prev) =>
      prev !== null && !discSet.has(prev) ? null : prev
    );
  }, [discoveryStatuses]);

  useEffect(() => {
    saveSectionLayoutV1(sectionOrder, sectionHidden, sectionIsolated);
  }, [sectionOrder, sectionHidden, sectionIsolated]);

  const discSet = useMemo(() => new Set(discoveryStatuses), [discoveryStatuses]);

  const sectionDescriptors = useMemo(
    () =>
      sectionOrder
        .filter((id) => discSet.has(id))
        .map((id) => ({ id, label: id })),
    [sectionOrder, discSet]
  );

  const discoveryContexts = useMemo(() => {
    const tasks = gtdTasks.filter_by_project(projectFilter).tasks;
    return _.uniq(
      tasks.flatMap((t) =>
        t.explodeByContext().map((x) => x.data.single_context ?? "")
      )
    ).filter((id) => id.length > 0);
  }, [gtdTasks, projectFilter]);

  useEffect(() => {
    if (discoveryContexts.length === 0) {
      return;
    }
    const discCtx = new Set(discoveryContexts);
    setTagOrder((prev) => {
      const pruned = prev.filter((id) => discCtx.has(id));
      const seen = new Set(pruned);
      for (const id of discoveryContexts) {
        if (!seen.has(id)) {
          pruned.push(id);
          seen.add(id);
        }
      }
      return pruned;
    });
    setTagHidden((prev) => {
      const next = new Set(prev);
      for (const id of prev) {
        if (!discCtx.has(id)) {
          next.delete(id);
        }
      }
      return next;
    });
    setTagIsolated((prev) =>
      prev !== null && !discCtx.has(prev) ? null : prev
    );
  }, [discoveryContexts]);

  useEffect(() => {
    saveTagLayoutV1(tagOrder, tagHidden, tagIsolated);
  }, [tagOrder, tagHidden, tagIsolated]);

  const tagDiscSet = useMemo(
    () => new Set(discoveryContexts),
    [discoveryContexts]
  );

  const tagDescriptors = useMemo(
    () =>
      tagOrder.filter((id) => tagDiscSet.has(id)).map((id) => ({ id })),
    [tagOrder, tagDiscSet]
  );

  const effectiveSectionVisible = (id: string) =>
    sectionIsolated !== null ? id === sectionIsolated : !sectionHidden.has(id);
  const effectiveTagVisible = (id: string) =>
    tagIsolated !== null ? id === tagIsolated : !tagHidden.has(id);

  const filteredVisibleTasks = useMemo(
    () =>
      gtdTasks
        .filter_by_project(projectFilter)
        .filter_by_context(contextFilter)
        .filter_by_visibility(visibleDate).tasks,
    [gtdTasks, projectFilter, contextFilter, visibleDate]
  );

  const leftPaneTasks = useMemo(
    () =>
      filterTasksForLeftPaneTagMenu(
        filteredVisibleTasks,
        tagHidden,
        tagIsolated
      ),
    [filteredVisibleTasks, tagHidden, tagIsolated]
  );

  const visibleTasksByStatus = useMemo(
    () => _.groupBy((t: m.Task) => t.data.status)(leftPaneTasks),
    [leftPaneTasks]
  );

  useLayoutEffect(() => {
    const rows = getLeftPaneNavRows(leftPaneRef.current);
    setTaskNavFocusIndex((i) => {
      if (rows.length === 0) {
        return -1;
      }
      if (i >= rows.length) {
        return rows.length - 1;
      }
      return i;
    });
  }, [
    leftPaneTasks,
    sectionDescriptors,
    groupBy,
    tagDescriptors,
    sectionHidden,
    sectionIsolated,
    tagHidden,
    tagIsolated,
  ]);

  const { has_date } = m.Tasks.dateSplit(filteredVisibleTasks);
  const withMeta = m.Tasks.addMetaTasks(has_date);
  const week_blocks = vm.WeekBlock.fromTasks(withMeta);

  const show = (id: string) => effectiveSectionVisible(id);

  return (
    <div className="App">
      <div className="Toolbar">
        <DatePicker date={visibleDate} setDate={setVisibleDate} />

        <span className="ToolbarSep">|</span>

        {projectFilter
          ? <span className="FilterChip" onClick={() => dispatch(unsetProject())}>
              {projectFilter} ×
            </span>
          : <span className="ToolbarDim">project</span>
        }

        {contextFilter
          ? <span className="FilterChip" onClick={() => dispatch(unsetContext())}>
              {contextFilter} ×
            </span>
          : <span className="ToolbarDim">context</span>
        }

        <span className="ToolbarSep">|</span>

        <button onClick={flipGroupBy}>{groupBy}</button>

        <span className="ToolbarSep">|</span>

        <div className="ToolbarDropdown" ref={sectionDropdownRef}>
          <button onClick={() => setSectionDropdownOpen((o) => !o)}>
            Sections {sectionDropdownOpen ? "▴" : "▾"}
          </button>
          {sectionDropdownOpen && (
            <div className="DropdownPanel">
              {sectionDescriptors.map(({ id, label }) => (
                <div
                  key={id}
                  className="DropdownItem"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from = sectionDragSourceRef.current;
                    sectionDragSourceRef.current = null;
                    if (from) {
                      moveSectionOrder(from, id);
                    }
                  }}
                >
                  <span
                    className="DropdownDragHandle DropdownDragHandleDraggable"
                    draggable
                    title="Drag to reorder"
                    onDragStart={(e) => {
                      sectionDragSourceRef.current = id;
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", id);
                    }}
                    onDragEnd={() => {
                      sectionDragSourceRef.current = null;
                    }}
                  >
                    ⋮⋮
                  </span>
                  <button
                    type="button"
                    className={`DropdownSolo${
                      sectionIsolated === id ? " DropdownSoloActive" : ""
                    }`}
                    onClick={() => toggleSectionIsolate(id)}
                    title="Isolate — show only this section (click again to clear)"
                    aria-pressed={sectionIsolated === id}
                    aria-label={`Isolate section ${label}`}
                  >
                    S
                  </button>
                  <button
                    type="button"
                    className="DropdownCheck"
                    onClick={() => toggleSectionVisibility(id)}
                    aria-pressed={effectiveSectionVisible(id)}
                    aria-label={
                      effectiveSectionVisible(id)
                        ? `Hide ${label} section`
                        : `Show ${label} section`
                    }
                  >
                    {effectiveSectionVisible(id) ? "×" : "○"}
                  </button>
                  <span className="DropdownLabel">{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="ToolbarDropdown" ref={tagDropdownRef}>
          <button onClick={() => setTagDropdownOpen((o) => !o)}>
            Tags {tagDropdownOpen ? "▴" : "▾"}
          </button>
          {tagDropdownOpen && (
            <div className="DropdownPanel">
              {tagDescriptors.map(({ id }) => (
                <div
                  key={id}
                  className="DropdownItem"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from = tagDragSourceRef.current;
                    tagDragSourceRef.current = null;
                    if (from) {
                      moveTagOrder(from, id);
                    }
                  }}
                >
                  <span
                    className="DropdownDragHandle DropdownDragHandleDraggable"
                    draggable
                    title="Drag to reorder"
                    onDragStart={(e) => {
                      tagDragSourceRef.current = id;
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", id);
                    }}
                    onDragEnd={() => {
                      tagDragSourceRef.current = null;
                    }}
                  >
                    ⋮⋮
                  </span>
                  <button
                    type="button"
                    className={`DropdownSolo${
                      tagIsolated === id ? " DropdownSoloActive" : ""
                    }`}
                    onClick={() => toggleTagIsolate(id)}
                    title="Isolate — show only this tag (click again to clear)"
                    aria-pressed={tagIsolated === id}
                    aria-label={`Isolate tag ${id}`}
                  >
                    S
                  </button>
                  <button
                    type="button"
                    className="DropdownCheck"
                    onClick={() => toggleTagVisibility(id)}
                    aria-pressed={effectiveTagVisible(id)}
                    aria-label={
                      effectiveTagVisible(id)
                        ? `Hide tasks grouped under tag ${id}`
                        : `Show tasks grouped under tag ${id}`
                    }
                  >
                    {effectiveTagVisible(id) ? "×" : "○"}
                  </button>
                  <span className="DropdownLabel">{id}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="MainContent">
        <div className="LeftPane" ref={leftPaneRef}>
          {sectionDescriptors.map(({ id, label }) =>
            show(id) ? (
              <div key={id} className="LeftPaneSection">
                <h2>{label}</h2>
                <NoScheduleBlock
                  tasks={m.Tasks.tasksBy_PriorityDate(
                    visibleTasksByStatus[id] ?? []
                  )}
                  groupby={groupBy}
                  tagDescriptors={tagDescriptors}
                  tagVisible={effectiveTagVisible}
                />
              </div>
            ) : null
          )}
        </div>
        <div className="RightPane">
          <WeekBlocks week_blocks={week_blocks} />
        </div>
      </div>

      {taskNavSearchBuffer !== null ? (
        <div className="VimSearchCmd" role="status" aria-live="polite">
          /{taskNavSearchBuffer}
          <span className="VimSearchCursor">▍</span>
        </div>
      ) : null}
    </div>
  );
}

export default App;
