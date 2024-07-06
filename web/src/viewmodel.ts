import { Dictionary } from "lodash";
import * as _ from "lodash/fp";

import * as m from "./model";
export class DayTasks {
  tasks: m.Task[];

  constructor(tasks: m.Task[]) {
    this.tasks = tasks;
  }
  static fromTasks(tasks: m.Task[]): DayTasks[] {
    const day_groups = Object.values(m.Tasks.groupByDay(tasks));
    return day_groups.map((t: m.Task[]) => {
      return new DayTasks(t);
    });
  }

  date(): m.TaskDate | undefined {
    if (this.tasks.length == 0) {
      return undefined;
    }
    this.tasks[0].dates.first();
  }
}

export class WeekTasks {
  tasks: DayTasks[];

  constructor(tasks: DayTasks[]) {
    this.tasks = tasks;
  }

  static fromTasks(tasks: m.Task[]): WeekTasks[] {
    const week_groups = Object.values(m.Tasks.groupByWeek(tasks));
    return week_groups.map((t: m.Task[]) => {
      return new WeekTasks(DayTasks.fromTasks(t));
    });
  }
}
