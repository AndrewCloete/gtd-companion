import "./App.css";
import * as _ from "lodash/fp";

import { useEffect, useState, useCallback } from "react";

import env from "./.env.json";
import * as m from "./model";

const tabs = ["Flat", "ByProject", "ByContext"] as const;
type Tab = (typeof tabs)[number];

type ByProject = Map<m.Data.Project, m.Task[]>;
type ByContext = Map<m.Data.Context, m.Task[]>;

function todayDate(): string {
  let rightNow = new Date();
  return rightNow.toISOString().slice(0, 10).replace(/-/g, "");
}

function toByProject(tasks: m.Task[]): ByProject {
  return tasks.reduce((results: ByProject, task: m.Task) => {
    const p = task.project;
    if (!results.has(p)) {
      results.set(p, []);
    }
    //@ts-ignore
    results.set(p, [...results.get(p), task]);
    return results;
  }, new Map());
}

function toByContext(tasks: m.Task[]): ByContext {
  return tasks.reduce((results: ByContext, task: m.Task) => {
    if (task.data.contexts.length == 0) {
      if (!results.has("none")) {
        results.set("none", []);
      }
      //@ts-ignore
      results.get("none").push(task);
    }
    task.data.contexts.forEach((c) => {
      if (!results.has(c)) {
        results.set(c, []);
      }
      //@ts-ignore
      results.get(c).push(task);
    });
    return results;
  }, new Map());
}

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
          props.selectedStatuses.filter((s) => s != status),
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
  date: string | undefined;
  setDate: (date: string) => void;
  hasDue: boolean;
  setHasDue: (hasDue: boolean) => void;
  noDue: boolean;
  setNoDue: (noDue: boolean) => void;
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
      <label>
        <input
          type="checkbox"
          checked={props.noDue}
          onChange={() => props.setNoDue(!props.noDue)}
        />
        NoDue
      </label>
    </div>
  );
}

function CompStatus(props: { status: string; text: string }) {
  function cleanText(txt: string) {
    return txt.replace("- ", "").replace("* ", "");
  }
  return (
    <span className={"Status_" + props.status}>{cleanText(props.text)}</span>
  );
}

function CompTask(props: { task: m.Task; hideContext?: boolean }) {
  function displayDate(date: string | undefined) {
    if (!date) {
      return "";
    }
    return date.slice(0, 4) + "-" + date.slice(4, 6) + "-" + date.slice(6, 8);
  }

  function TaskDow(props: { task: m.Task }) {
    return (
      <span className="TaskDow">
        {" "}
        {getDayOfWeek(firstTaskDate(props.task.dates))}
      </span>
    );
  }

  function TaskDate(props: {
    date: string | undefined;
    diff?: number;
    className: string;
  }) {
    return (
      <span>
        {" "}
        <span className={props.className + " TaskDate"}>
          {displayDate(props.date)}
          <span className="SmallDate">
            {" "}
            {props.diff ? " (" + props.diff + ")" : null}
          </span>
        </span>{" "}
      </span>
    );
    // return props.date ?  : null;
  }
  function getDueClass(diff: number | undefined) {
    if (diff == undefined) {
      return "DateDueNone";
    }
    if (diff < 0) {
      return "DateDueOver";
    }
    if (diff > 0) {
      return "DateDueFuture";
    }
    return "DateDueToday";
  }
  function StartDate(props: { task: m.Task }) {
    let startDate = props.task.dates?.start;
    let daysDiff = noDashDaysDiff(startDate, todayDate());
    return (
      <TaskDate
        date={startDate}
        className={getDueClass(daysDiff)}
        diff={daysDiff}
      ></TaskDate>
    );
  }
  function VisibleDate(props: { task: m.Task }) {
    return (
      <TaskDate
        date={props.task.dates?.visible}
        className="DateStart"
      ></TaskDate>
    );
  }
  function Duration(props: { task: m.Task }) {
    let daysDiff = noDashDaysDiff(
      props.task.dates?.due,
      props.task.dates?.start,
    );
    return <div className="DurationCell">{daysDiff}</div>;
  }
  function DueDate(props: { task: m.Task }) {
    let dueDate = props.task.dates?.due;
    let daysDiff = noDashDaysDiff(dueDate, todayDate());
    return (
      <TaskDate
        date={dueDate}
        className={getDueClass(daysDiff)}
        diff={daysDiff}
      ></TaskDate>
    );
  }

  function dowClass(): string {
    if (props.task.metaTask) {
      return "DowMeta";
    }
    const firstDate = firstTaskDate(props.task.dates);
    if (isSat(firstDate)) {
      return "DowSat";
    }
    if (isSun(firstDate)) {
      return "DowSun";
    }
    return "Dow";
  }

  return (
    <div className={"CompTask " + dowClass()}>
      <TaskDow task={props.task}></TaskDow>
      <div className="TextCell">
        <CompStatus
          status={props.task.status}
          text={props.task.description}
        ></CompStatus>
      </div>
      <span className="ContextCell">
        {!props.hideContext
          ? props.task.contexts.map((c) => {
              return (
                <span key={c}>
                  <span className="Context">{c.replace("#x", "")}</span>{" "}
                </span>
              );
            })
          : null}
      </span>
      <StartDate task={props.task}></StartDate>
      <Duration task={props.task}></Duration>
      <DueDate task={props.task}></DueDate>
      <VisibleDate task={props.task}></VisibleDate>
    </div>
  );
}

function CompByProject(props: { project: Project; tasks: m.Task[] }) {
  return (
    <div className="project">
      <div className="block1">
        <span className="Project_text">{props.project}</span>
      </div>
      <div className="block2">
        {props.tasks.map((t) => {
          return (
            <div key={taskKey(t)}>
              <CompTask task={t}></CompTask>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CompByProjects(props: { tasks: m.Task[] }) {
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

function CompByContexts(props: { tasks: m.Task[] }) {
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

function Flat(props: { tasks: Task[] }) {
  return (
    <div>
      {props.tasks.map((task: Task) => {
        return (
          <div key={taskKey(task)}>
            <CompByProjects tasks={[task]}></CompByProjects>
          </div>
        );
      })}
    </div>
  );
}

function WipFirst(props: { tasks: Task[] }) {
  let has_date_with_meta = addMetaTasks(has_date);

  return (
    <div>
      <div className="Group">
        <Flat tasks={wip}></Flat>
      </div>
      <div className="Group">
        <Flat tasks={has_date_with_meta}></Flat>
      </div>
      <Flat tasks={toSortByStatus(no_date)}></Flat>
    </div>
  );
}

async function getTasks(): Promise<m.Tasks> {
  const url = `${env.scheme}://${env.host}`;
  const requestOptionsFetch = {
    method: "GET",
    headers: {
      Authorization: "Basic " + btoa(env.user + ":" + env.psw),
    },
  };
  //@ts-ignore
  const response = await fetch(url + "/tasks", requestOptionsFetch);
  const tasks_data = (await response.json()) as m.Data.Task[];
  return m.Tasks.fromData(tasks_data);
}

function App() {
  let [tasks, setTasks] = useState<Task[]>([]);
  let [selectedTab, setSelectedTab] = useState<Tab>("Flat");
  let [selectedStatuses, setSelectedStatuses] = useState<TaskStatus[]>(
    statuses.map((s) => s),
  );
  let [visibleDate, setVisibleDate] = useState<string>(todayDate());
  let [hasDue, setHasDue] = useState<boolean>(false);
  let [noDue, setNoDue] = useState<boolean>(false);

  function connect() {
    const WS_URL = `${env.ws_scheme}://${env.host}/ws`;
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

  const handleKeyPress = useCallback(
    (event: any) => {
      if (event.key == "r") {
        loadTasks();
      }
      if (event.key == "d") {
        setHasDue(!hasDue);
      }
    },
    [hasDue],
  );

  useEffect(() => {
    // attach the event listener
    document.addEventListener("keydown", handleKeyPress);

    // remove the event listener
    return () => {
      document.removeEventListener("keydown", handleKeyPress);
    };
  }, [handleKeyPress]);

  function filteredTasks(): Task[] {
    let ftasks = tasksByFirstDate(tasks);

    ftasks = _.filter(
      (t: Task) => selectedStatuses.includes(t.status) || !!t.dates,
      ftasks,
    );
    function startDateFilter(t: Task) {
      if (!visibleDate || visibleDate.length != 8) {
        return true;
      }
      if (!t.dates || !t.dates.visible) {
        return true;
      }
      return Number(t.dates.visible) <= Number(visibleDate);
    }
    ftasks = _.filter(startDateFilter, ftasks);

    if (hasDue) {
      return _.filter((t: Task) => !!t.dates?.due, ftasks);
    }
    if (noDue) {
      return _.filter((t: Task) => !t.dates?.due, ftasks);
    }
    return ftasks;
  }
  async function loadTasks() {
    const networkTasks = await getTasks();
    setTasks(networkTasks);
  }

  return (
    <div className="App">
      {/* <header className="App-header">
      </header> */}
      <StatusSelector
        selectedStatuses={selectedStatuses}
        setSelectedStatuses={setSelectedStatuses}
      ></StatusSelector>
      <DatePicker
        date={visibleDate}
        setDate={setVisibleDate}
        hasDue={hasDue}
        setHasDue={setHasDue}
        noDue={noDue}
        setNoDue={setNoDue}
      ></DatePicker>
      {tabs.map((t) => {
        return (
          <button key={t} onClick={() => setSelectedTab(t)}>
            {t}
          </button>
        );
      })}
      <button onClick={() => loadTasks()}>Load</button>
      {((tab: Tab) => {
        switch (tab) {
          case "ByProject":
            return <CompByProjects tasks={filteredTasks()}></CompByProjects>;
          case "ByContext":
            return <CompByContexts tasks={filteredTasks()}></CompByContexts>;
          default:
            return <WipFirst tasks={filteredTasks()}></WipFirst>;
        }
      })(selectedTab)}
    </div>
  );
}

export default App;
