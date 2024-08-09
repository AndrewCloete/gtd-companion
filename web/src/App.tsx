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

import { useEffect, useState, useCallback } from "react";

import env from "./.env.prod.json";
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

function TasksByTag(props: { tasks: m.Task[] }) {
  const groups = _.groupBy((t: m.Task) => t.singleContext())(props.tasks);
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
  let [dateStr, setDateStr] = useState<string | undefined>();

  useEffect(() => {
    if (props.date) {
      setDateStr(m.TaskDate.fmt(props.date, "yyyyMMdd"));
    }
  }, []);

  function handleChange(event: any) {
    let val = event.target.value;
    console.log(val);
    setDateStr(val);
    const newDate = parse(val, "yyyyMMdd", new Date());
    if (isValid(newDate)) {
      console.log(newDate);
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
    <div>
      <button onClick={today}>Today</button>
      <button onClick={clear}>Clear</button>
      <input type="text" value={dateStr} onChange={handleChange} />
    </div>
  );
}

type Range = { range_key: string; start: number; end: number };

function App() {
  const dispatch = useAppDispatch();
  let [gtdTasks, setTasks] = useState<m.Tasks>(m.Tasks.empty());
  let [ranges, setRanges] = useState<Range[]>([]);
  let [visibleDate, setVisibleDate] = useState<Date | undefined>(getToday());

  async function loadTasks() {
    const networkTasks = await getTasks();
    setTasks(networkTasks.split_with_due());
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

  const projectFilter = useAppSelector((state) => state.taskFilter.project);
  const contextFilter = useAppSelector((state) => state.taskFilter.context);

  useEffect(() => {
    function vertical_range(range_key: string): Range | undefined {
      function get_top(id: string): number | undefined {
        const element = document.getElementById(id);
        if (!element) {
          return undefined;
        }
        const { top } = element.getBoundingClientRect();
        return top;
      }
      const start = get_top(`${range_key} (start)`);
      const end = get_top(`${range_key} (end)`);
      if (!start || !end) {
        return undefined;
      }
      return { range_key, start, end };
    }
    setRanges(
      gtdTasks
        .range_keys()
        .map((rk) => vertical_range(rk))
        .filter((r: Range | undefined): r is Range => {
          return r !== undefined;
        }),
    );

    return;
  }, [gtdTasks, projectFilter, contextFilter]);

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
    gtdTasks
      .filter_by_project(projectFilter)
      .filter_by_context(contextFilter)
      .filter_by_visibility(visibleDate).tasks,
  );
  const todoSplit = m.Tasks.statusSplit(["Todo"], no_date);
  const noStatusSplit = m.Tasks.statusSplit(
    ["NoStatus"],
    todoSplit.other_status,
  );

  const withMeta = m.Tasks.addMetaTasks(has_date);
  const week_blocks = vm.WeekBlock.fromTasks(withMeta);

  return (
    <div className="App">
      <div className="Split">
        <div>
          <DatePicker date={visibleDate} setDate={setVisibleDate}></DatePicker>
          <div>
            <button onClick={() => dispatch(unsetProject())}>Clear</button>
            <span>{projectFilter}</span>
          </div>
          <div>
            <button onClick={() => dispatch(unsetContext())}>Clear</button>
            <span>{contextFilter}</span>
          </div>
          <NoScheduleBlock tasks={wip}></NoScheduleBlock>
          <WeekBlocks week_blocks={week_blocks}></WeekBlocks>
          <h2>Todo</h2>
          <NoScheduleBlock
            tasks={m.Tasks.tasksBy_Status(todoSplit.has_status)}
          ></NoScheduleBlock>
          <h2>Backlog</h2>
          <NoScheduleBlock
            tasks={m.Tasks.tasksBy_Status(noStatusSplit.has_status)}
          ></NoScheduleBlock>
        </div>
        <div style={{ minWidth: "30px" }}>
          {ranges.map((r) => {
            console.log(r);
            const height = Math.abs(r.start - r.end);
            return (
              <div
                style={{
                  position: "absolute",
                  top: `${r.start}px`,
                  height: `${height}px`,
                  width: "17px", // width of the box
                  // background: "var(--darker)",
                  background: "var(--darker)",
                  transform: "translateX(-50%)", // center the box horizontally
                  textAlign: "center",
                  display: "flex",
                  padding: "2px",
                }}
              >
                <span
                  style={{
                    // position: "absolute",
                    // top: "50%",
                    // left: "50%",
                    writingMode: "vertical-lr",
                    // transform: "rotate(90deg) translate(-50%, -50%)",
                    whiteSpace: "nowrap",
                    color: "white",
                  }}
                >
                  {r.range_key}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default App;
