import type { Feature } from "../types";
import { disableVideoLoop } from "./disable-video-loop";
import { replyFiltering } from "./reply-filtering";

export const features: Feature[] = [replyFiltering, disableVideoLoop];
