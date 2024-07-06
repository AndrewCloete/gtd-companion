import * as _ from "lodash/fp";
import { format } from "date-fns";

import * as m from "./model";

export class DayBlock {
  tasks: m.Task[];

  constructor(tasks: m.Task[]) {
    this.tasks = tasks;
  }
  static fromTasks(tasks: m.Task[]): DayBlock[] {
    const day_groups = Object.values(m.Tasks.groupByDay(tasks));
    return day_groups.map((t: m.Task[]) => {
      return new DayBlock(t);
    });
  }

  date(): m.TaskDate | undefined {
    if (this.tasks.length == 0) {
      return undefined;
    }
    return this.tasks[0].dates.first();
  }

  fmtDay(): string | undefined {
    const d = this.date()?.date;
    if (!d) {
      return;
    }
    return format(d, "EEEEEE d MMM");
  }

  key(): string {
    const d = this.date()?.date;
    if (!d) {
      return "nodate";
    }
    return m.TaskDate.toYYYY_MM_DD(d);
  }
}

export class WeekBlock {
  tasks: DayBlock[];

  constructor(tasks: DayBlock[]) {
    this.tasks = tasks;
  }

  static fromTasks(tasks: m.Task[]): WeekBlock[] {
    const week_groups = Object.values(m.Tasks.groupByWeek(tasks));
    return week_groups.map((t: m.Task[]) => {
      return new WeekBlock(DayBlock.fromTasks(t));
    });
  }

  weekBookends(): m.WeekBookends | undefined {
    if (this.tasks.length == 0) {
      return undefined;
    }
    return this.tasks[0].date()?.weekBookends();
  }

  fmtWeekBookends(): string | undefined {
    const bookends = this.weekBookends();
    if (!bookends) {
      return undefined;
    }
    return [bookends?.monday, bookends?.sunday]
      .map(m.TaskDate.toMM_DD)
      .join(" - ");
  }

  key(): string {
    const bookends = this.weekBookends();
    if (!bookends) {
      return "nobookends";
    }
    return [bookends.monday, bookends.sunday]
      .map((date) => m.TaskDate.toYYYY_MM_DD(date))
      .join("");
  }
}
