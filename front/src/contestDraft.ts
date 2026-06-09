import { CreateContestData } from "./api/contestApi";

let _draft: CreateContestData | null = null;

export const setContestDraft = (data: CreateContestData): void => { _draft = data; };
export const getContestDraft = (): CreateContestData | null => _draft;
export const clearContestDraft = (): void => { _draft = null; };
