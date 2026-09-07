import axios from "axios";
import { getApiBaseUrl } from "./baseUrl";

const client = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
});

export default client;
