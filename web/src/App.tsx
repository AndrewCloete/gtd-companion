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
      <span className={`Description TaskType_${props.task.classify()}`}>
        {props.task.cleanDescription()}
      </span>
    </div>
  );
}

function DayBlock(props: { block: vm.DayBlock }) {
  const date = props.block.date();
  const diffInDays = date?.diffInDays(getToday());

  function diffInDaysClass() {
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

  return (
    <div className="DayBlock">
      <div className={`DayBlockDate ${diffInDaysClass()}`}>
        <div>{date?.fmt("EEEEEE")}</div>
        <div className="Date">{date?.fmt("d MMM")}</div>
        <div>({diffInDays})</div>
        <div></div>
      </div>
      <div className="DayTasks">
        {props.block.tasks.map((task) => {
          return <DayTask key={task.key()} task={task}></DayTask>;
        })}
      </div>
    </div>
  );
}

function WeekBlock(props: { week_block: vm.WeekBlock }) {
  return (
    <div className="WeekBlock">
      <span className="WeekRange">{props.week_block.fmtWeekBookends()}</span>
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

function App() {
  let [gtdTasks, setTasks] = useState<m.Tasks>(m.Tasks.empty());
  let [visibleDate, setVisibleDate] = useState<Date>(getToday());

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

  const { tasks, wip, non_wip, has_date, no_date } =
    gtdTasks.subdivide(visibleDate);

  const withMeta = m.Tasks.addMetaTasks(has_date);
  const week_blocks = vm.WeekBlock.fromTasks(withMeta);

  return (
    <div className="App">
      <WeekBlocks week_blocks={week_blocks}></WeekBlocks>
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
