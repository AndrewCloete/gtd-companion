import "./App.css";
import * as _ from "lodash/fp";

import { useEffect, useState, useCallback } from "react";

import env from "./.env.json";
import * as m from "./model";
import * as vm from "./viewmodel";

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

function App() {
  let [tasks, setTasks] = useState<m.Task[]>([]);
  let [visibleDate, setVisibleDate] = useState<Date>(getToday());

  async function loadTasks() {
    const networkTasks = await getTasks();
    setTasks(networkTasks.tasks);
    const { tasks, wip, non_wip, has_date, no_date } =
      networkTasks.subdivide(visibleDate);

    const week_tasks = vm.WeekTasks.fromTasks(m.Tasks.addMetaTasks(has_date));
    console.log(week_tasks);
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

  return <div className="App">a</div>;

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
