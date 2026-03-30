import axios from "axios";
import { SubmitRequest, SubmitResponse } from "../types";

export const SUBMIT_URL = "http://98.92.116.47:8080/api/code/submit";

export const submitCode = async (payload: SubmitRequest): Promise<SubmitResponse> => {
  const response = await axios.post<SubmitResponse>(SUBMIT_URL, payload);
  return response.data;
};


