import { supabase } from "../../lib/supabase";

const STORAGE_API_BASE = `${import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "")}/storage/v1`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

/** Encode each path segment for Storage `/object/{bucket}/...` URLs. */
function encodeObjectPath(path: string): string {
  const clean = path.replace(/^\/+/, "").replace(/\/+/g, "/");
  return clean
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/");
}

/**
 * Upload a file to Supabase Storage with XHR upload progress (matches client FormData shape).
 * Mirrors `@supabase/storage-js` upload for `File` bodies.
 */
export async function uploadStorageObjectWithProgress(
  bucket: string,
  /** Path inside bucket, e.g. `userId/uuid.jpg` */
  objectPath: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Not signed in");

  const finalPath = `${bucket}/${objectPath.replace(/^\/+/, "").replace(/\/+/g, "/")}`;
  const url = `${STORAGE_API_BASE}/object/${encodeObjectPath(finalPath)}`;

  const body = new FormData();
  body.append("cacheControl", "3600");
  body.append("", file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", ANON_KEY);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / Math.max(e.total, 1)) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(new Error(xhr.responseText?.slice(0, 200) || `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(body);
  });
}
