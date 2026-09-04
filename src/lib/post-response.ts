import "server-only";

import { after } from "next/server";
import { logSafeError } from "@/lib/secret-redaction";

type PostResponseTask = {
  name: string;
  run: () => Promise<unknown>;
};

export function schedulePostResponseTasks(scope: string, tasks: PostResponseTask[]) {
  after(async () => {
    const outcomes = await Promise.allSettled(tasks.map((task) => task.run()));

    outcomes.forEach((outcome, index) => {
      if (outcome.status === "rejected") {
        logSafeError(`${scope}: ${tasks[index].name} failed.`, outcome.reason);
      }
    });
  });
}
