import axios from "axios";
import { SubmitRequest, SubmitResponse } from "../types";

export const SUBMIT_URL = `${process.env.REACT_APP_API_BASE_URL}/api/code/submit`;

export const submitCode = async (payload: SubmitRequest): Promise<SubmitResponse> => {
  const response = await axios.post<SubmitResponse>(SUBMIT_URL, payload);
  return response.data;
};


