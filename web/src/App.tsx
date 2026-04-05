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
  useMemo,
  useRef,
  useState,
} from "react";

import env from "./config.json";
import * as m from "./model";
import * as vm from "./viewmodel";

type TaskGroupBy = "Project" | "Tags"

function getToday(): Date {
  return new Date();
}
function getTodayStr(): string {
  return m.TaskDate.toYYYYMMDD(getToday());
}

function get_url() {
  return `${env.scheme}://${window.location.hostname}:${env.backend_port}`;
}

function open_in_editor(task: m.Task) {
  if (!task.data.file_path || !task.data.line) return;
  const scheme = (env as any).editor_scheme ?? "vscode";
  window.location.href = `${scheme}://file/${task.data.file_path}:${task.data.line}`;
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
            <div key={task.key()}>
              <div
                id={task.cleanDescription()}
                key={task.key()}
                className={`Description TaskType_${task.classify()}`}
                onClick={(e) => open_in_editor(task)}
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
            <div key={task.key()}>
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
                onClick={(e) => open_in_editor(task)}
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

function TasksByGroup(props: { tasks: m.Task[], groupby: TaskGroupBy }) {
  return (
    props.groupby === "Project" ? <TasksByProject tasks={props.tasks} /> : <TasksByTag tasks={props.tasks} />
  )
}

function TasksByTag(props: { tasks: m.Task[] }) {
  const groups = _.groupBy((t: m.Task) => t.data.single_context)(props.tasks.flatMap(t => t.explodeByContext()));
  return (
    <div>
      {Object.entries(groups).map((entry) => {
        return (
          <ContextBlock
            key={entry[0]}
            context={entry[0]}
            tasks={entry[1]}
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

function NoScheduleBlock(props: { tasks: m.Task[], groupby: TaskGroupBy }) {
  const { has_date, no_date } = m.Tasks.dateSplit(props.tasks);
  function NoScheduleTask(props: { task: m.Task }) {
    const dispatch = useAppDispatch();
    const date = props.task.dates.priority();
    const diffInDays = date?.diffInDays(getToday());

    return (
      <div className="TaskLine">
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
          onClick={() => open_in_editor(props.task)}
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
      <TasksByGroup tasks={no_date} groupby={props.groupby}></TasksByGroup>
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
  let [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());
  let [sectionDropdownOpen, setSectionDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const prevSectionIdsRef = useRef<Set<string>>(new Set());

  function flipGroupBy() {
    setGroupBy((g) => (g === "Project" ? "Tags" : "Project"));
  }

  function toggleSection(id: string) {
    setVisibleSections((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function loadTasks() {
    const networkTasks = await getTasks();
    setTasks(networkTasks.split_with_due());
  }

  function connect() {
    const WS_URL = `${env.ws_scheme}://${window.location.hostname}:${env.backend_port}/ws`;
    const ws = new WebSocket(WS_URL);
    ws.addEventListener("open", (event) => {
      ws.send("Connection established");
    });

    ws.addEventListener("message", (event) => {
      console.log("Message from server ", event.data);
      loadTasks();
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
    loadTasks();
    connect();
    return;
  }, []);

  // Sets the date back to today every 1 minute to ensure invisible tasks are always surfaced
  useEffect(() => {
    const intervalId = setInterval(() => {
      setVisibleDate(getToday())
    }, 60000);
    return () => clearInterval(intervalId);
  }, []);

  // Close section dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSectionDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const projectFilter = useAppSelector((state) => state.taskFilter.project);
  const contextFilter = useAppSelector((state) => state.taskFilter.context);

  const handleKeyPress = useCallback((event: any) => {
    if (event.key == "r") {
      loadTasks();
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyPress);
    return () => {
      document.removeEventListener("keydown", handleKeyPress);
    };
  }, [handleKeyPress]);

  const discoveryStatuses = useMemo(() => {
    const tasks = gtdTasks
      .filter_by_project(projectFilter)
      .filter_by_context(contextFilter)
      .tasks;
    return _.uniq(tasks.map((t) => t.data.status));
  }, [gtdTasks, projectFilter, contextFilter]);

  const sectionIds = useMemo(
    () => m.Tasks.discoverLeftPaneSectionIds(discoveryStatuses),
    [discoveryStatuses]
  );

  const sectionDescriptors = useMemo(
    () =>
      sectionIds.map((id) => ({
        id,
        label: m.Tasks.leftPaneSectionLabel(id),
      })),
    [sectionIds]
  );

  useEffect(() => {
    const allowed = new Set(sectionIds);
    const prevAllowed = prevSectionIdsRef.current;
    setVisibleSections((prev) => {
      const next = new Set<string>();
      for (const id of allowed) {
        if (!prevAllowed.has(id) || prev.has(id)) {
          next.add(id);
        }
      }
      return next;
    });
    prevSectionIdsRef.current = allowed;
  }, [sectionIds]);

  const filteredVisibleTasks = gtdTasks
    .filter_by_project(projectFilter)
    .filter_by_context(contextFilter)
    .filter_by_visibility(visibleDate).tasks;

  const { wip, week, month, has_date, no_date } =
    m.Tasks.subdivide(filteredVisibleTasks);
  const todoSplit = m.Tasks.statusSplit(["Todo"], no_date);
  const noStatusSplit = m.Tasks.statusSplit(["NoStatus"], todoSplit.other_status);
  const withMeta = m.Tasks.addMetaTasks(has_date);
  const week_blocks = vm.WeekBlock.fromTasks(withMeta);

  const leftPaneBuckets = {
    wip,
    week,
    month,
    todo: todoSplit.has_status,
    backlog: noStatusSplit.has_status,
    visibleTasks: filteredVisibleTasks,
  };

  const show = (id: string) => visibleSections.has(id);

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

        <div className="ToolbarDropdown" ref={dropdownRef}>
          <button onClick={() => setSectionDropdownOpen((o) => !o)}>
            Sections {sectionDropdownOpen ? "▴" : "▾"}
          </button>
          {sectionDropdownOpen && (
            <div className="DropdownPanel">
              {sectionDescriptors.map(({ id, label }) => (
                <div key={id} className="DropdownItem" onClick={() => toggleSection(id)}>
                  <span className="DropdownCheck">{visibleSections.has(id) ? "×" : " "}</span>
                  {label}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="MainContent">
        <div className="LeftPane">
          {sectionDescriptors.map(({ id, label }) =>
            show(id) ? (
              <div key={id}>
                <h2>{label}</h2>
                <NoScheduleBlock
                  tasks={m.Tasks.tasksBy_Status(
                    m.Tasks.leftPaneSectionTasks(id, leftPaneBuckets)
                  )}
                  groupby={groupBy}
                />
              </div>
            ) : null
          )}
        </div>
        <div className="RightPane">
          <WeekBlocks week_blocks={week_blocks} />
        </div>
      </div>
    </div>
  );
}

export default App;
