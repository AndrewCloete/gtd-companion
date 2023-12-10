import "./App.css";
import * as _ from "lodash/fp";

import { useEffect, useState } from "react";
import env from "./.env.json";

type Tab = "ByProject" | "ByContext";

const statuses = ["Todo", "Wip", "NoStatus", "Review"] as const;
type TaskStatus = (typeof statuses)[number];
type Project = string;
type Context = string;
type TaskDates = { start: string; due: string };
type Task = {
  description: string;
  project: Project;
  status: TaskStatus;
  contexts: Context[];
  dates: TaskDates | undefined;
};

type ByProject = Map<Project, Task[]>;
type ByContext = Map<Context, Task[]>;

function todayDate(): string {
  let rightNow = new Date();
  return rightNow.toISOString().slice(0, 10).replace(/-/g, "");
}

function toByProject(tasks: Task[]): ByProject {
  return tasks.reduce((results: ByProject, task: Task) => {
    const p = task.project;
    if (!results.has(p)) {
      results.set(p, []);
    }
    //@ts-ignore
    results.set(p, [...results.get(p), task]);
    return results;
  }, new Map());
}

function toByContext(tasks: Task[]): ByContext {
  return tasks.reduce((results: ByContext, task: Task) => {
    task.contexts.forEach((c) => {
      if (!results.has(c)) {
        results.set(c, []);
      }
      //@ts-ignore
      results.get(c).push(task);
    });
    return results;
  }, new Map());
}

// function toSortByStatus(tasks: Task[]): Task[] {
//   return _.sortBy((t: Task) => {t.status}, tasks)
// }

function StatusSelector(props: {
  selectedStatuses: TaskStatus[];
  setSelectedStatuses: (statusus: TaskStatus[]) => void;
}) {
  function has(status: TaskStatus) {
    return props.selectedStatuses.includes(status);
  }

  function handelSelected(status: TaskStatus) {
    return () => {
      if (has(status))
        props.setSelectedStatuses(
          props.selectedStatuses.filter((s) => s != status)
        );
      else props.setSelectedStatuses([...props.selectedStatuses, status]);
    };
  }

  return (
    <div>
      {statuses.map((s) => {
        return (
          <label key={s}>
            <input
              type="checkbox"
              checked={has(s as TaskStatus)}
              onChange={handelSelected(s as TaskStatus)}
            />
            {s}
          </label>
        );
      })}
    </div>
  );
}

function DatePicker(props: {
  date: string;
  setDate: (date: string) => void;
  hasDue: boolean;
  setHasDue: (hasDue: boolean) => void;
}) {
  function handleChange(event: any) {
    props.setDate(event.target.value);
  }
  function clear(): void {
    props.setDate("");
  }
  function today(): void {
    props.setDate(todayDate());
  }

  return (
    <div>
      <button onClick={today}>Today</button>
      <button onClick={clear}>Clear</button>
      <input type="text" value={props.date} onChange={handleChange} />
      <label>
        <input
          type="checkbox"
          checked={props.hasDue}
          onChange={() => props.setHasDue(!props.hasDue)}
        />
        HasDue
      </label>
    </div>
  );
}

function CompStatus(props: { status: string; text: string }) {
  return <span className={"Status_" + props.status}>{props.text}</span>;
}

function CompTask(props: { task: Task; hideContext?: boolean }) {
  function displayDate(date: string) {
    return date.slice(0, 4) + "-" + date.slice(4, 6) + "-" + date.slice(6, 8);
  }

  function TaskDate(props: { date: string | undefined; diff?: number, className: string }) {
    return props.date ? (
      <span>
        {" "}
        <span className={props.className}>{displayDate(props.date)}{props.diff ? " (" + props.diff + ")" : null}</span>{" "}
      </span>
    ) : null;
  }
  function StartDate(props: { task: Task }) {
    return (
      <TaskDate date={props.task.dates?.start} className="DateStart"></TaskDate>
    );
  }
  function DueDate(props: { task: Task }) {
    let dueDate = props.task.dates?.due;
    if (!dueDate) {
      return null;
    }
    let daysDiff = Number(dueDate) - Number(todayDate());
    function getDueClass(diff: Number) {
      if (daysDiff < 0) {
        return "DateDueOver";
      }
      if (daysDiff > 0) {
        return "DateDueFuture";
      }
      return "DateDueToday";
    }
    return (
      <TaskDate date={dueDate} className={getDueClass(daysDiff)} diff={daysDiff}></TaskDate>
    );
  }

  return (
    <div>
      <span>
        <CompStatus
          status={props.task.status}
          text={props.task.description}
        ></CompStatus>
      </span>

      <StartDate task={props.task}></StartDate>
      <DueDate task={props.task}></DueDate>

      {!props.hideContext
        ? props.task.contexts.map((c) => {
            return (
              <span className="Context" key={c}>
                {c}{" "}
              </span>
            );
          })
        : null}
    </div>
  );
}

function CompByProject(props: { project: Project; tasks: Task[] }) {
  return (
    <div className="project">
      <div className="block1">
        <span className="Project_text">{props.project}</span>
      </div>
      <div className="block2">
        {props.tasks.map((t) => {
          return (
            <div key={t.description}>
              <CompTask task={t}></CompTask>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CompByProjects(props: { tasks: Task[] }) {
  const byProject = toByProject(props.tasks);
  return (
    <div>
      {Array.from(byProject).map(([project, subTasks]) => {
        return (
          <div key={project}>
            <CompByProject project={project} tasks={subTasks}></CompByProject>
          </div>
        );
      })}
    </div>
  );
}

function CompByContexts(props: { tasks: Task[] }) {
  const byContext = toByContext(props.tasks);
  return (
    <div>
      {Array.from(byContext).map(([context, subTasks]) => {
        return (
          <div key={context}>
            <div className="Context">{context}</div>
            <CompByProjects tasks={subTasks}></CompByProjects>
          </div>
        );
      })}
    </div>
  );
}

async function getTasks(): Promise<Task[]> {
  const url = `${env.scheme}://${env.host}`;
  const requestOptionsFetch = {
    method: "GET",
    headers: {
      Authorization: "Basic " + btoa(env.user + ":" + env.psw),
    },
  };
  //@ts-ignore
  const response = await fetch(url + "/tasks", requestOptionsFetch);
  const tasks = (await response.json()) as Task[];
  return tasks;
  return [];
}

function App() {
  let [tasks, setTasks] = useState<Task[]>([]);
  let [selectedTab, setSelectedTab] = useState<Tab>("ByProject");
  let [selectedStatuses, setSelectedStatuses] = useState<TaskStatus[]>(
    statuses.map((s) => s)
  );
  let [startDate, setStartDate] = useState<string>("");
  let [hasDue, setHasDue] = useState<boolean>(false);
  function filteredTasks(): Task[] {
    let ftasks = _.sortBy((t: Task) => t.dates?.due, tasks);

    ftasks = _.filter((t: Task) => selectedStatuses.includes(t.status) || !!t.dates, ftasks);
    function startDateFilter(t: Task) {
      if (!startDate || startDate.length != 8) {
        return true;
      }
      if (!t.dates || !t.dates.start) {
        return true;
      }
      return Number(t.dates.start) < Number(startDate);
    }
    ftasks = _.filter(startDateFilter, ftasks);

    if (!hasDue) {
      return ftasks;
    }

    ftasks = _.filter((t: Task) => !!t.dates?.due, ftasks);
    return ftasks;
  }
  async function loadTasks() {
    const networkTasks = await getTasks();
    setTasks(networkTasks);
  }

  useEffect(() => {
    loadTasks();
  }, []);

  return (
    <div className="App">
      {/* <header className="App-header">
      </header> */}
      <StatusSelector
        selectedStatuses={selectedStatuses}
        setSelectedStatuses={setSelectedStatuses}
      ></StatusSelector>
      <DatePicker
        date={startDate}
        setDate={setStartDate}
        hasDue={hasDue}
        setHasDue={setHasDue}
      ></DatePicker>
      <button onClick={() => setSelectedTab("ByProject")}>ByProject</button>
      <button onClick={() => setSelectedTab("ByContext")}>ByContext</button>
      <button onClick={() => loadTasks()}>Load</button>
      {selectedTab == "ByProject" ? (
        <CompByProjects tasks={filteredTasks()}></CompByProjects>
      ) : (
        <CompByContexts tasks={filteredTasks()}></CompByContexts>
      )}
    </div>
  );
}

export default App;
