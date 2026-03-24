import axios from 'axios';

export const API_BASE = process.env.REACT_APP_API_URL || '/api';

/**
 * Run detection on an image file.
 */
export async function detectImage(file, query, options = {}) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('query', query);
  fd.append('use_sam', options.useSam ?? true);
  fd.append('show_boxes', options.showBoxes ?? true);
  fd.append('show_masks', options.showMasks ?? true);
  fd.append('box_threshold', options.boxThreshold ?? 0.25);
  fd.append('text_threshold', options.textThreshold ?? 0.25);
  fd.append('high_recall', options.highRecall ?? true);

  const { data } = await axios.post(`${API_BASE}/detect-image`, fd, {
    timeout: 120_000,
  });
  return data;
}

/**
 * Submit a video for detection.  Returns { job_id }.
 */
export async function detectVideo(file, query, options = {}) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('query', query);
  fd.append('use_sam', options.useSam ?? false);
  fd.append('use_tracking', options.useTracking ?? true);
  fd.append('show_boxes', options.showBoxes ?? true);
  fd.append('show_masks', options.showMasks ?? false);
  fd.append('box_threshold', options.boxThreshold ?? 0.25);
  fd.append('text_threshold', options.textThreshold ?? 0.25);
  fd.append('high_recall', options.highRecall ?? true);

  const { data } = await axios.post(`${API_BASE}/detect-video`, fd, {
    timeout: 30_000,
  });
  return data;
}

/**
 * Poll job status until done or error.
 * Calls progressCallback(pct) on each update.
 */
export async function pollJobStatus(jobId, progressCallback, intervalMs = 2000) {
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const { data } = await axios.get(`${API_BASE}/job/${jobId}/status`);
        if (progressCallback) progressCallback(data.progress || 0);

        if (data.status === 'done') return resolve(data);
        if (data.status === 'error') return reject(new Error(data.error || 'Job failed'));

        setTimeout(poll, intervalMs);
      } catch (err) {
        reject(err);
      }
    };
    poll();
  });
}
