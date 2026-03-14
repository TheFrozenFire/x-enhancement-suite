/**
 * Prevents videos from automatically looping on X/Twitter.
 *
 * X handles looping via JS: on the `ended` event it seeks to 0 and calls play().
 * We let that happen, then pause on the next animation frame so the video sits
 * at the start, ready for the user to manually replay if they want.
 */

import type { BehaviorPlugin, CacheService } from "../plugin-types";

const LOG = "[XES:disable-video-loop]";
const MARKER = "data-xes-no-loop";

let observer: MutationObserver | null = null;

function handleEnded(this: HTMLVideoElement) {
  console.log(LOG, "Video ended, scheduling pause");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      this.pause();
      console.log(LOG, "Paused after auto-restart, currentTime:", this.currentTime);
    });
  });
}

function bindVideo(video: HTMLVideoElement) {
  if (video.hasAttribute(MARKER)) return;
  video.setAttribute(MARKER, "1");
  video.addEventListener("ended", handleEnded);
  console.log(LOG, "Bound anti-loop listener to video");
}

function unbindVideo(video: HTMLVideoElement) {
  if (!video.hasAttribute(MARKER)) return;
  video.removeAttribute(MARKER);
  video.removeEventListener("ended", handleEnded);
}

function scanVideos(root: Element | Document) {
  for (const video of root.querySelectorAll<HTMLVideoElement>("video")) {
    bindVideo(video);
  }
}

const disableVideoLoop: BehaviorPlugin = {
  id: "disable-video-loop",
  name: "Disable Video Loop",
  description: "Prevents videos from automatically looping when they reach the end",
  category: "Media",
  defaultEnabled: true,
  depends: [],

  init(_cache: CacheService) {
    console.log(LOG, "Init");
    scanVideos(document);

    observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node instanceof HTMLElement) {
            if (node.tagName === "VIDEO") {
              bindVideo(node as HTMLVideoElement);
            } else {
              scanVideos(node);
            }
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  },

  cleanup() {
    console.log(LOG, "Cleanup");
    observer?.disconnect();
    observer = null;
    for (const video of document.querySelectorAll<HTMLVideoElement>(
      `video[${MARKER}]`
    )) {
      unbindVideo(video);
    }
  },
};

export default disableVideoLoop;
