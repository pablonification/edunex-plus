// App models: what the screens show, already joined and cleaned. The engine
// builds them from vendor data; the renderer only ever sees these. Each area
// keeps its models in its own file under ./models; this file joins them.
import { z } from "zod";
import { alertsDatasets } from "./models/alerts";
import { appDatasets } from "./models/app";
import { coursePageDatasets } from "./models/course-page";
import { edunexDatasets } from "./models/edunex";
import { itbDatasets } from "./models/itb";
import { plannerDatasets } from "./models/planner";
import { sixDatasets } from "./models/six";
import { sixRecordsDatasets } from "./models/six-records";
import { tasksDatasets } from "./models/tasks";

export * from "./models/alerts";
export * from "./models/app";
export * from "./models/base";
export * from "./models/course-page";
export * from "./models/edunex";
export * from "./models/itb";
export * from "./models/planner";
export * from "./models/six";
export * from "./models/six-records";
export * from "./models/tasks";

/** Every dataset the engine publishes, by name ("<source>.<what>"). */
export const Datasets = {
  ...edunexDatasets,
  ...tasksDatasets,
  ...coursePageDatasets,
  ...sixDatasets,
  ...sixRecordsDatasets,
  ...itbDatasets,
  ...plannerDatasets,
  ...alertsDatasets,
  ...appDatasets,
} as const satisfies Record<string, z.ZodType>;
export type DatasetName = keyof typeof Datasets;
export type DatasetValue<N extends DatasetName> = z.infer<(typeof Datasets)[N]>;
