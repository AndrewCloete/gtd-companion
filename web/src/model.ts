import { Dictionary } from "lodash";
import { format } from "date-fns";
import * as _ from "lodash/fp";

export namespace Data {
  const statuses = [
    "Todo",
    "Wip",
    "NoStatus",
    "Review",
    "Sunday",
    "Today",
  ] as const;
  type TaskStatus = (typeof statuses)[number];

  export const statusRank: Record<TaskStatus, Number> = {
    Wip: 1,
    Review: 2,
    Todo: 3,
    NoStatus: 4,
    Sunday: 5,
    Today: 6,
  };
  export type Project = string;
  export type Context = string;

  export type TaskDates = {
    start?: string;
    due?: string;
    visible?: string;
  };

  export type Task = {
    description: string;
    project: Project;
    status: TaskStatus;
    contexts: Context[];
    dates: TaskDates | undefined;
  };
}

const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export type Dow = (typeof daysOfWeek)[number];

export type WeekBookends = { monday: Date; sunday: Date };

const dateKinds = ["START", "VISIBLE", "DUE", , "TEST"] as const;
export type DateKind = (typeof dateKinds)[number];
export class TaskDate {
  date: Date | undefined;
  kind: DateKind;
  constructor(dateStr: string | undefined, kind: DateKind) {
    this.date = TaskDate.toDate(dateStr);
    this.kind = kind;
  }
  static toUnixMs(noDashDate: string): number {
    return Date.parse(
      noDashDate.slice(0, 4) +
        "-" +
        noDashDate.slice(4, 6) +
        "-" +
        noDashDate.slice(6, 8),
    );
  }
  static toDate(noDashDate: string | undefined): Date | undefined {
    if (!noDashDate) {
      return;
    }
    return new Date(TaskDate.toUnixMs(noDashDate));
  }

  static index(dow: Dow) {
    return daysOfWeek.indexOf(dow);
  }

  static diffInDays(
    d1: TaskDate | undefined,
    d2: TaskDate | undefined,
  ): number | undefined {
    if (!d1 || !d2) {
      return;
    }
    if (!d1.date || !d2.date) {
      return;
    }
    const diffMs = d1.date.getTime() - d2.date.getTime();
    return diffMs / (1000 * 3600 * 24);
  }

  weekBookends(): WeekBookends | undefined {
    if (!this.date) {
      return;
    }
    const dayOfWeek = this.date.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(this.date);
    monday.setDate(this.date.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6); // Set to Sunday of the current week
    return { monday, sunday };
  }

  dow(): number | undefined {
    return this.date?.getDay();
  }

  dowStr(): string | undefined {
    if (!this.date) {
      return;
    }
    return daysOfWeek[this.date.getDay()];
  }

  isDow(dow: Dow): boolean {
    return this.dowStr() == dow;
  }

  static toYMD(date: Date): { year: string; month: string; day: string } {
    const year = "" + date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return { year, month, day };
  }
  static toYYYYMMDD(date: Date): string {
    return format(date, "yyyyMMdd");
  }
  static toYYYY_MM_DD(date: Date): string {
    return format(date, "yyyy-MM-dd");
  }
  static toMM_DD(date: Date): string {
    return format(date, "d MMM");
  }

  toYYYYMMDD(): string | undefined {
    if (!this.date) {
      return undefined;
    }
    return TaskDate.toYYYYMMDD(this.date);
  }
  toYYYY_MM_DD(): string | undefined {
    if (!this.date) {
      return undefined;
    }
    return TaskDate.toYYYY_MM_DD(this.date);
  }
}
export class TaskDates {
  dates: TaskDate[];
  constructor(data: Data.TaskDates | undefined) {
    this.dates = [
      new TaskDate(data?.start, "START"),
      new TaskDate(data?.due, "DUE"),
      new TaskDate(data?.visible, "VISIBLE"),
    ].filter((d) => d.date);
  }

  first(): TaskDate | undefined {
    return _.minBy((d: TaskDate) => d.date)(this.dates);
  }

  get(kind: DateKind): TaskDate | undefined {
    const kindMatch = this.dates.filter((d) => {
      return d.kind == kind;
    });
    if (kindMatch.length > 1) {
      throw `More than one entry for date kind ${kind}`;
    }
    if (kindMatch.length < 1) {
      return undefined;
    }
    return kindMatch[0];
  }

  isVisible(d: Date | undefined): boolean {
    if (!d) {
      return true;
    }
    const visible_date = this.get("VISIBLE")?.date;
    if (!visible_date) {
      return true;
    }
    return visible_date <= d;
  }

  diff(k1: DateKind, k2: DateKind): number | undefined {
    return TaskDate.diffInDays(this.get(k1), this.get(k2));
  }

  durationDays() {
    return this.diff("DUE", "START");
  }
}

export class Task {
  data: Data.Task;
  dates: TaskDates;

  constructor(data: Data.Task) {
    this.data = data;
    this.dates = new TaskDates(data.dates);
  }

  cleanDescription() {
    return this.data.description.replace("- ", "").replace("* ", "");
  }

  contextsWithNone(): Data.Context[] {
    if (this.data.contexts.length == 0) {
      return ["(none)"];
    }
    return this.data.contexts;
  }

  key(): string {
    return (
      this.data.description +
      this.data.contexts.join() +
      (this.data.dates?.due || "") +
      (this.data.dates?.start || "") +
      (this.data.dates?.visible || "")
    );
  }
}

export class Tasks {
  tasks: Task[];

  static empty(): Tasks {
    return new Tasks([]);
  }

  static fromData(data: Data.Task[]): Tasks {
    return new Tasks(
      data.map((d) => {
        return new Task(d);
      }),
    );
  }

  constructor(tasks: Task[]) {
    this.tasks = Tasks.tasksBy_FirstDate(tasks);
  }

  static groupByWeek(t: Task[]): Dictionary<Task[]> {
    return _.groupBy((t: Task) => {
      return t.dates.first()?.weekBookends()?.monday;
    })(t);
  }

  static groupByDay(t: Task[]) {
    return _.groupBy((t: Task) => {
      return t.dates.first()?.date;
    })(t);
  }

  subdivide(visbility_date: Date | undefined): {
    tasks: Task[];
    wip: Task[];
    non_wip: Task[];
    has_date: Task[];
    no_date: Task[];
  } {
    const tasks = _.filter<Task>((t: Task) => {
      return t.dates.isVisible(visbility_date);
    })(this.tasks);

    const [wip, non_wip] = tasks.reduce<[Task[], Task[]]>(
      ([pass, fail], task) => {
        if (task.data.status == "Wip" || task.data.status == "Review") {
          pass.push(task);
        } else {
          fail.push(task);
        }
        return [pass, fail];
      },
      [[], []],
    );

    const [has_date, no_date] = non_wip.reduce<[Task[], Task[]]>(
      ([pass, fail], task) => {
        if (task.dates.first()) {
          pass.push(task);
        } else {
          fail.push(task);
        }
        return [pass, fail];
      },
      [[], []],
    );
    return { tasks, wip, non_wip, has_date, no_date };
  }
  static tasksBy_FirstDate(tasks: Task[]): Task[] {
    return _.sortBy((t: Task) => t.dates.first()?.date, tasks);
  }

  static tasksBy_Status(tasks: Task[]): Task[] {
    return _.sortBy((t: Task) => {
      return Data.statusRank[t.data.status];
    }, tasks);
  }

  static tasksBy_Project(tasks: Task[]): Task[] {
    return _.sortBy((t: Task) => t.data.project, tasks);
  }

  static tasksBy_Context(tasks: Task[]): Task[] {
    let expanded = tasks.flatMap((t) => {
      if (t.data.contexts.length == 0) {
        return [t];
      }
      return t.data.contexts.map((c) => {
        let copy = _.cloneDeep(t);
        copy.data.contexts = [c];
        return copy;
      });
    });
    return _.sortBy((t: Task) => t.data.contexts[0], expanded);
  }

  static addMetaTasks(tasks: Task[]): Task[] {
    function generateSundayDates(dates: Date[]): Date[] {
      const sundays: Date[] = [];
      const startDate = new Date(
        Math.min(...dates.map((date) => date.getTime())),
      );
      const endDate = new Date(
        Math.max(...dates.map((date) => date.getTime())),
      );

      let current = new Date(startDate);
      // Move the current date to the first Sunday
      current.setDate(current.getDate() + ((7 - current.getDay()) % 7));

      while (current <= endDate) {
        sundays.push(new Date(current)); // Push a copy of the current date to the array
        current.setDate(current.getDate() + 7); // Move to the next Sunday
      }

      return sundays;
    }

    function isDefined(d: Date | undefined): d is Date {
      return d !== undefined;
    }

    const input_dates: Date[] = tasks
      .map((t) => t.dates.first()?.date)
      .filter(isDefined);

    const sundayTasks: Task[] = generateSundayDates(input_dates).map(
      (sunday) => {
        return new Task({
          project: "",
          status: "Sunday",
          description: "",
          contexts: [],
          dates: {
            start: TaskDate.toYYYYMMDD(sunday),
            due: TaskDate.toYYYYMMDD(sunday),
          },
        });
      },
    );
    return Tasks.tasksBy_FirstDate([...tasks, ...sundayTasks]);
  }
}
