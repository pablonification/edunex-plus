// Every home-screen widget's name, as app.config.ts declares it and Android knows it (the widget's class). "Now" and
// "Today" are on Students' home screens already: never rename a widget, or the placed ones go blank.
export const WIDGET_NAMES = ["Now", "Today", "Due", "Attendance", "Exam", "Next", "Services", "Course"] as const;

export type WidgetName = (typeof WIDGET_NAMES)[number];

export const isWidgetName = (name: string): name is WidgetName => (WIDGET_NAMES as readonly string[]).includes(name);
