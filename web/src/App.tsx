import "./App.css";
import * as _ from "lodash/fp";

import { useEffect, useState } from "react";

type Tab = "ByProject" | "ByContext";

const statuses = ["Todo", "Wip", "NoStatus", "Review"] as const;
type TaskStatus = (typeof statuses)[number];
type Project = string;
type Context = string;
type Task = {
  description: string;
  project: Project;
  status: TaskStatus;
  contexts: Context[];
};

type ByProject = Map<Project, Task[]>;
type ByContext = Map<Context, Task[]>;

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

function CompStatus(props: { status: string; text: string }) {
  return <span className={"Status_" + props.status}>{props.text}</span>;
}

function CompTask(props: { task: Task; hideContext?: boolean }) {
  return (
    <div>
      <span>
        <CompStatus
          status={props.task.status}
          text={props.task.description}
        ></CompStatus>
      </span>

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
      <div className="block1"><span className="Project_text">{props.project}</span></div>
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
  const requestOptions = {
    method: "GET",
  };
  const response = await fetch("http://localhost:8083/tasks", requestOptions);
  const tasks = (await response.json()) as Task[];
  return tasks;
}

function App() {
  let [tasks, setTasks] = useState<Task[]>([]);
  let [selectedTab, setSelectedTab] = useState<Tab>("ByProject");
  let [selectedStatuses, setSelectedStatuses] = useState<TaskStatus[]>(
    statuses.map((s) => s)
  );
  function filteredTasks(): Task[] {
    return _.filter((t: Task) => selectedStatuses.includes(t.status), tasks);
  }
  async function loadTasks(){
      const networkTasks = await getTasks();
      setTasks(networkTasks);
  }

  useEffect(() => {
    loadTasks()
  }, []);

  return (
    <div className="App">
      {/* <header className="App-header">
      </header> */}
      <StatusSelector
        selectedStatuses={selectedStatuses}
        setSelectedStatuses={setSelectedStatuses}
      ></StatusSelector>
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
