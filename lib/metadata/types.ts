export type Metadata = {
  title: string;
  og_image_url: string | null;
  favicon_url: string | null;
};

export interface CacheEntry<T> {
  data: T;
  expiry: number;
}

export interface FetchResult {
  html: string;
  finalUrl: string;
}
