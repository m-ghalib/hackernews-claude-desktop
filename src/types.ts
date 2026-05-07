// Shared types for the HackerNews MCP server

export interface HNItem {
  id: number;
  type?: string;
  by?: string;
  time?: number;
  text?: string;
  url?: string;
  title?: string;
  score?: number;
  descendants?: number;
  kids?: number[];
  parent?: number;
  deleted?: boolean;
  dead?: boolean;
}

export interface HNUser {
  id: string;
  karma: number;
  about?: string;
  created: number;
  submitted?: number[];
}

export interface AlgoliaHit {
  objectID: string;
  title?: string;
  url?: string;
  author?: string;
  points?: number;
  num_comments?: number;
  created_at?: string;
  created_at_i?: number;
  story_text?: string;
  comment_text?: string;
  parent_id?: number;
  story_id?: number;
  story_title?: string;
  story_url?: string;
  _tags?: string[];
}

export interface AlgoliaResponse {
  hits: AlgoliaHit[];
  nbHits: number;
  page: number;
  nbPages: number;
  hitsPerPage: number;
}

export interface ErrorEnvelope {
  error: {
    code: "UPSTREAM_5XX" | "TIMEOUT" | "NOT_FOUND" | "INVALID_INPUT" | "PARSE_FAILED" | "UNKNOWN";
    message: string;
    retryable: boolean;
  };
}

export interface NormalizedStory {
  id: number;
  title?: string;
  url?: string;
  author?: string;
  points?: number;
  num_comments?: number;
  created_at?: string;
  type?: string;
  text?: string;
}

export interface NormalizedComment {
  id: number;
  author?: string;
  text?: string;
  created_at?: string;
  parent?: number;
  comments?: NormalizedComment[];
  truncated?: boolean;
}
