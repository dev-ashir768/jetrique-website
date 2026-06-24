"use client";

import * as React from "react";
import { DayPicker, useNavigation } from "react-day-picker";
import { setMonth, setYear } from "date-fns";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Clean month/year dropdown header
function CalendarCaption({ displayMonth }: { displayMonth: Date }) {
  const { goToMonth, nextMonth, previousMonth } = useNavigation();

  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1919 }, (_, i) => currentYear - i);

  return (
    <div className="flex items-center justify-between px-1 pb-2">
      <button type="button" disabled={!previousMonth}
        onClick={() => previousMonth && goToMonth(previousMonth)}
        className="h-7 w-7 flex items-center justify-center rounded-[6px] border border-neutral-200 hover:border-[#8cc63f]/40 hover:bg-[#f0f9e8] transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
        <ChevronLeft className="size-3.5 text-neutral-600" />
      </button>

      <div className="flex items-center gap-1.5">
        <select
          value={displayMonth.getMonth()}
          onChange={(e) => goToMonth(setMonth(displayMonth, Number(e.target.value)))}
          className="text-xs font-semibold text-neutral-700 border border-neutral-200 rounded-[6px] px-2 py-1 focus:outline-none focus:border-[#8cc63f]/50 bg-white cursor-pointer appearance-none pr-5 bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23888%22 stroke-width=%222%22><polyline points=%226 9 12 15 18 9%22/></svg>')] bg-no-repeat bg-[right_4px_center]">
          {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
        </select>
        <select
          value={displayMonth.getFullYear()}
          onChange={(e) => goToMonth(setYear(displayMonth, Number(e.target.value)))}
          className="text-xs font-semibold text-neutral-700 border border-neutral-200 rounded-[6px] px-2 py-1 focus:outline-none focus:border-[#8cc63f]/50 bg-white cursor-pointer appearance-none pr-5 bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23888%22 stroke-width=%222%22><polyline points=%226 9 12 15 18 9%22/></svg>')] bg-no-repeat bg-[right_4px_center]">
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <button type="button" disabled={!nextMonth}
        onClick={() => nextMonth && goToMonth(nextMonth)}
        className="h-7 w-7 flex items-center justify-center rounded-[6px] border border-neutral-200 hover:border-[#8cc63f]/40 hover:bg-[#f0f9e8] transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
        <ChevronRight className="size-3.5 text-neutral-600" />
      </button>
    </div>
  );
}

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3 select-none", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-3",
        caption: "flex justify-center relative items-center",
        caption_label: "hidden",
        nav: "hidden",
        nav_button: "hidden",
        table: "w-full border-collapse",
        head_row: "flex",
        head_cell: "text-neutral-400 rounded-md w-9 font-normal text-[10px] uppercase tracking-wide text-center",
        row: "flex w-full mt-1",
        cell: "h-9 w-9 text-center text-sm p-0 relative",
        day: cn("h-9 w-9 p-0 font-normal rounded-[6px] hover:bg-[#f0f9e8] transition-colors"),
        day_selected: "!bg-[#8cc63f] text-white hover:!bg-[#7ab535] focus:!bg-[#8cc63f]",
        day_today: "bg-neutral-100 font-semibold",
        day_outside: "text-neutral-300 opacity-40",
        day_disabled: "text-neutral-300 opacity-30 cursor-not-allowed",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        Caption: ({ displayMonth }) => <CalendarCaption displayMonth={displayMonth} />,
      }}
      {...props}
    />
  );
}
