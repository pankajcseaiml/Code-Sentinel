import { atom } from "jotai";
import type { SerializableAliveTask } from "../../../../../../server/service/opencode/taskTypes";

export const aliveTasksAtom = atom<SerializableAliveTask[]>([]);
