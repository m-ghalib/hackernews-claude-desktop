// Cheerio-based HTML scraping for HN pages
// HN HTML structure (verified against live pages 2026-05-07):
//
//   <tr class="athing submission" id="48037128">
//     <td class="title"><span class="titleline"><a href="URL">TITLE</a></span></td>
//   </tr>
//   <tr>  <!-- no class; immediately follows athing -->
//     <td class="subtext">
//       <span class="subline">
//         <span class="score">N points</span>
//         by <a class="hnuser" href="user?id=USERNAME">USERNAME</a>
//         <span class="age" title="ISO_DATE"><a href="item?id=ID">X hours ago</a></span>
//         <a href="item?id=ID">N comments</a>
//       </span>
//     </td>
//   </tr>
//   <tr class="spacer" style="height:5px"></tr>

import { load, type CheerioAPI } from "cheerio";

export interface ParsedItem {
  id: number;
  title: string;
  url?: string;
  author?: string;
  points?: number;
  num_comments?: number;
  posted_at?: string;
}

export function parseHNListPage(html: string): { items: ParsedItem[]; hasMore: boolean } {
  const $ = load(html);
  const items: ParsedItem[] = [];

  $("tr.athing.submission").each((_i, el) => {
    const id = parseInt($(el).attr("id") ?? "", 10);
    if (isNaN(id)) return;

    // Title and URL
    const titleEl = $(el).find("span.titleline > a").first();
    const title = titleEl.text().trim();
    const href = titleEl.attr("href");
    // HN sometimes uses relative URLs like "item?id=..." for text posts
    const url = href && !href.startsWith("item?") ? href : undefined;

    // The subtext row is the next sibling tr (no class or spacer class)
    // We walk siblings to find the td.subtext
    const subtextRow = $(el).nextAll("tr").first();
    const subtextEl = subtextRow.find("td.subtext, td.subline").first();

    const scoreText = subtextEl.find("span.score").text();
    const points = scoreText ? parseInt(scoreText, 10) : undefined;

    const author = subtextEl.find("a.hnuser").first().text().trim() || undefined;

    // posted_at from span.age title attribute (ISO datetime)
    const ageTitle = subtextEl.find("span.age").attr("title");
    // title format: "2012-09-10T18:50:31 1347303031" — take the ISO part
    const posted_at = ageTitle ? ageTitle.split(" ")[0] : undefined;

    // Comments count — last link in subtext that links to item?id=
    let num_comments: number | undefined;
    subtextEl.find("a").each((_j, a) => {
      const href = $(a).attr("href") ?? "";
      if (href.startsWith("item?id=")) {
        const text = $(a).text();
        const m = text.match(/(\d+)\s+comment/);
        if (m) num_comments = parseInt(m[1], 10);
        else if (text === "discuss") num_comments = 0;
      }
    });

    if (id && title) {
      items.push({ id, title, url, author, points, num_comments, posted_at });
    }
  });

  // Detect pagination: HN uses a "More" link at the bottom
  const hasMore = $("a.morelink").length > 0;

  return { items, hasMore };
}

// Log structure to stderr for debugging when parse fails
export function debugParseFailure(html: string): void {
  const $ = load(html);
  console.error("[hn-html] Parse debug — athing rows:", $("tr.athing").length);
  console.error("[hn-html] Parse debug — athing.submission rows:", $("tr.athing.submission").length);
  console.error("[hn-html] Parse debug — first 500 chars:", html.slice(0, 500));
}
