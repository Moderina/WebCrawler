import axios from "axios";
import { parse } from 'node-html-parser';

let visited = [];
let startTime;

async function fetchPage(url) {
    const response = await axios.get(url, { timeout: 5000 });
    return response.data;
}

function extractLinks(html) {
    const html_page = parse(html);
    const links = [];

    html_page.querySelectorAll("a").forEach(a => {
        const href = a.getAttribute("href");
        if (href && href.startsWith("http")) {
            links.push(href);
        }
    });
    // console.log(links)

    return links;
}

async function dfs(url, depth, maxDepth, timeLimit) {
    if ( visited.includes(url) || depth > maxDepth || Date.now() - startTime > timeLimit) 
        return;

    visited.push(url);

    try {
        const html = await fetchPage(url);

        const links = extractLinks(html);
        for (const link of links) {
            await dfs(link, depth+1, maxDepth, timeLimit);
        }
    } catch {}
}


const url = 'https://www.zsmonki.pl/';
const base_depth = 0;
const max_depth = 2;
const max_time = 8000; //milisekundy

await dfs(url, base_depth, max_depth, max_time);
console.log(visited)