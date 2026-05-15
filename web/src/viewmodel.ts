import * as _ from "lodash/fp";
import { addWeeks, format } from "date-fns";

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
    return this.tasks[0].dates.priority();
  }

  fmtDay(): string | undefined {
    const d = this.date()?.date;
    if (!d) {
      return;
    }
    return format(d, "EEEEEE d MMM");
  }

  onlySundayTask(): boolean {
    return this.tasks.length == 1 && this.tasks[0].isSunday();
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
  /** When there are no tasks but we still need a week header (e.g. “this week”). */
  bookends?: m.WeekBookends;

  constructor(tasks: DayBlock[], bookends?: m.WeekBookends) {
    this.tasks = tasks;
    this.bookends = bookends;
  }

  /**
   * Build the week timeline for the schedule panel (RHS).
   *
   * Shows every calendar week from the anchor week (`anchorDate`, usually today)
   * forward through the latest week that has at least one dated task. Empty weeks
   * in between are still listed (placeholder headers only) so weeks never skip
   * (e.g. you will not see week 0 and week 2 without week 1 in between).
   *
   * Task weeks that fall entirely before the anchor week are omitted; only the
   * “from now onward” span is listed.
   */
  static fromTasks(tasks: m.Task[], anchorDate: Date = new Date()): WeekBlock[] {
    const week_groups = Object.values(m.Tasks.groupByWeek(tasks));
    const blocksFromTasks: WeekBlock[] = week_groups.map((weekTasks: m.Task[]) => {
      return new WeekBlock(DayBlock.fromTasks(weekTasks));
    });

    const anchorBookends = m.TaskDate.weekBookendsForDate(anchorDate);
    if (!anchorBookends) {
      /* Unusual; fall back to only weeks inferred from task data (no fill). */
      return blocksFromTasks.filter((b) => b.weekBookends());
    }

    const startMonday = anchorBookends.monday;
    const startMs = startMonday.getTime();

    /** Latest task week on/after the anchor (defines how far forward we render). */
    let endMs = startMs;

    /** Existing blocks keyed by that week’s Monday 00:00 local (epoch ms). */
    const byMonday = new Map<number, WeekBlock>();
    for (const b of blocksFromTasks) {
      const be = b.weekBookends();
      if (!be) {
        continue;
      }
      const ms = be.monday.getTime();
      byMonday.set(ms, b);
    }

    for (const b of blocksFromTasks) {
      const be = b.weekBookends();
      if (!be) {
        continue;
      }
      const ms = be.monday.getTime();
      if (ms >= startMs && ms > endMs) {
        endMs = ms;
      }
    }

    /** Walk consecutive weeks [startMonday … endMs]; insert placeholders for gaps. */
    const filled: WeekBlock[] = [];
    for (
      let cursor = new Date(startMonday);
      cursor.getTime() <= endMs;
      cursor = addWeeks(cursor, 1)
    ) {
      const t = cursor.getTime();
      const existing = byMonday.get(t);
      if (existing) {
        filled.push(existing);
        continue;
      }
      const placeholderEnds = m.TaskDate.weekBookendsForDate(cursor);
      if (placeholderEnds) {
        filled.push(new WeekBlock([], placeholderEnds));
      }
    }

    return filled;
  }

  weekBookends(): m.WeekBookends | undefined {
    if (this.bookends) {
      return this.bookends;
    }
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

  weeksAway(d: Date): number | undefined {
    const bookends = this.weekBookends();
    const weeks = m.TaskDate.diffInWeeks(bookends?.monday, d);
    if (!weeks) {
      return undefined;
    }
    return Math.ceil(weeks);
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
