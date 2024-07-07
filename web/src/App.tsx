import "./App.css";
import * as _ from "lodash/fp";
import { format } from "date-fns";

import { useEffect, useState, useCallback } from "react";

import env from "./.env.json";
import * as m from "./model";
import * as vm from "./viewmodel";
import { json } from "stream/consumers";

function getToday(): Date {
  return new Date();
}
function getTodayStr(): string {
  return m.TaskDate.toYYYYMMDD(getToday());
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

function DayTask(props: { task: m.Task }) {
  return (
    <div className="TaskLine">
      <div className="Project">
        <span>{props.task.cleanProjext()}</span>
      </div>
      <div className={`Description TaskType_${props.task.classify()}`}>
        {props.task.cleanDescription()}
      </div>
    </div>
  );
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
  return (
    <div className="TaskLine">
      <div className="Project">
        <span>{props.project}</span>
      </div>
      <div>
        {props.tasks.map((task) => {
          return (
            <div key={task.key()}>
              <div
                key={task.key()}
                className={`Description TaskType_${task.classify()}`}
              >
                {task.cleanDescription()}
              </div>
              <span className="Contexts">{task.cleanContexts().join(" ")}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  <div className="DayTasks"></div>;
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

function NoScheduleBlock(props: { tasks: m.Task[] }) {
  const { has_date, no_date } = m.Tasks.dateSplit(props.tasks);
  function NoScheduleTask(props: { task: m.Task }) {
    const date = props.task.dates.first();
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
          <span>{props.task.cleanProjext()}</span>
        </div>
        <div
          className={`Description Status_${props.task.data.status} TaskType_${props.task.classify()}`}
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
      <TasksByProject tasks={no_date}></TasksByProject>
    </div>
  );
}
function DatePicker(props: {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
}) {
  function handleChange(event: any) {
    props.setDate(event.target.value);
  }
  function clear(): void {
    props.setDate(undefined);
  }
  function today(): void {
    props.setDate(getToday());
  }

  return (
    <div>
      <button onClick={today}>Today</button>
      <button onClick={clear}>Clear</button>
      <input
        type="text"
        value={m.TaskDate.fmt(props.date, "yyyyMMdd")}
        onChange={handleChange}
      />
    </div>
  );
}

function App() {
  let [gtdTasks, setTasks] = useState<m.Tasks>(m.Tasks.empty());
  let [visibleDate, setVisibleDate] = useState<Date | undefined>(getToday());

  async function loadTasks() {
    const networkTasks = await getTasks();
    setTasks(networkTasks);
  }

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
      setTimeout(function() {
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

  const handleKeyPress = useCallback((event: any) => {
    if (event.key == "r") {
      loadTasks();
    }
  }, []);

  useEffect(() => {
    // attach the event listener
    document.addEventListener("keydown", handleKeyPress);

    // remove the event listener
    return () => {
      document.removeEventListener("keydown", handleKeyPress);
    };
  }, [handleKeyPress]);

  const { tasks, wip, non_wip, has_date, no_date } = m.Tasks.subdivide(
    m.Tasks.visibilityFilter(gtdTasks.tasks, visibleDate),
  );
  const { has_status, other_status } = m.Tasks.statusSplit(["Todo"], no_date);

  const withMeta = m.Tasks.addMetaTasks(has_date);
  const week_blocks = vm.WeekBlock.fromTasks(withMeta);

  return (
    <div className="App">
      <DatePicker date={visibleDate} setDate={setVisibleDate}></DatePicker>
      <NoScheduleBlock tasks={wip}></NoScheduleBlock>
      <WeekBlocks week_blocks={week_blocks}></WeekBlocks>
      <NoScheduleBlock
        tasks={m.Tasks.tasksBy_Status(has_status)}
      ></NoScheduleBlock>
      <NoScheduleBlock
        tasks={m.Tasks.tasksBy_Status(other_status)}
      ></NoScheduleBlock>
    </div>
  );

  // return (
  //   <div className="App">
  //     {/* <header className="App-header">
  //     </header> */}
  //     <StatusSelector
  //       selectedStatuses={selectedStatuses}
  //       setSelectedStatuses={setSelectedStatuses}
  //     ></StatusSelector>
  //     <DatePicker
  //       date={visibleDate}
  //       setDate={setVisibleDate}
  //       hasDue={hasDue}
  //       setHasDue={setHasDue}
  //       noDue={noDue}
  //       setNoDue={setNoDue}
  //     ></DatePicker>
  //     {tabs.map((t) => {
  //       return (
  //         <button key={t} onClick={() => setSelectedTab(t)}>
  //           {t}
  //         </button>
  //       );
  //     })}
  //     <button onClick={() => loadTasks()}>Load</button>
  //     {((tab: Tab) => {
  //       switch (tab) {
  //         case "ByProject":
  //           return <CompByProjects tasks={filteredTasks()}></CompByProjects>;
  //         case "ByContext":
  //           return <CompByContexts tasks={filteredTasks()}></CompByContexts>;
  //         default:
  //           return <WipFirst tasks={filteredTasks()}></WipFirst>;
  //       }
  //     })(selectedTab)}
  //   </div>
  // );
}

export default App;
